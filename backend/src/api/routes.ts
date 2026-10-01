/**
 * LedgerFlow API Routes — TASK 001 Security Implementation
 *
 * Three-tier routing architecture:
 *
 *   PUBLIC (no authentication):
 *     POST /auth/register
 *     POST /auth/login
 *     POST /auth/sso        ← returns 501 (disabled)
 *
 *   AUTHENTICATED (JWT required, no company context):
 *     GET  /auth/me
 *     GET  /businesses
 *     POST /businesses
 *
 *   COMPANY-SCOPED (JWT + company membership required):
 *     Everything else
 *     Additional authorize() checks where applicable
 *
 * SECURITY INVARIANTS:
 *   - req.body.companyId is NEVER used as authorization source
 *   - Resource :id routes ALWAYS verify resource.company_id === req.companyId
 *   - Voucher DELETE is blocked (405 — posted vouchers are immutable)
 *   - Audit actor always uses req.user.userId
 *   - No "first company" fallback exists
 *   - getUserFromToken and resolveCompanyId (old helpers) are NOT exported
 */

import crypto from 'node:crypto';
import { Router, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { PostingEngine } from '../domain/posting/posting-engine.js';
import { ReportEngine } from '../reports/report-engine.js';
import { GstEngine } from '../domain/tax/gst-engine.js';
import { InventoryEngine } from '../domain/inventory/valuation.js';
import { initializeBusiness } from '../database/seed.js';

import { AuthController } from '../controllers/auth.controller.js';
import { BusinessController } from '../controllers/business.controller.js';

import {
  authenticate,
  resolveCompanyContext,
  authorize,
  assertResourceOwnership,
  SecureRequest
} from '../middleware/security.js';

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();

  // Reusable middleware chains
  const withAuth = authenticate(db);
  const withCompany = [authenticate(db), resolveCompanyContext(db)];
  const withAccountant = [...withCompany, authorize('ACCOUNTANT', 'ADMIN', 'OWNER')];
  const withAdmin = [...withCompany, authorize('ADMIN', 'OWNER')];
  const withOwner = [...withCompany, authorize('OWNER')];

  // --------------------------------------------------------------------------
  // PUBLIC ROUTES (no authentication)
  // --------------------------------------------------------------------------
  const authController = new AuthController(db);
  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);
  router.post('/auth/sso', authController.sso); // Returns 501

  // --------------------------------------------------------------------------
  // AUTHENTICATED — No company context required
  // --------------------------------------------------------------------------
  router.get('/auth/me', withAuth, authController.getMe);

  const businessController = new BusinessController(db);
  router.get('/businesses', withAuth, businessController.getBusinesses);
  router.post('/businesses', withAuth, businessController.createBusiness);

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Financial Years
  // --------------------------------------------------------------------------
  router.get('/companies/current', ...withCompany, businessController.getCurrentCompanyInfo);
  router.put('/companies/current', ...withAdmin, businessController.updateCurrentCompany);
  router.post('/companies/:id/delete', withAuth, businessController.deleteCompany);

  router.get('/financial-years', ...withCompany, businessController.getFinancialYears);
  router.post('/financial-years', ...withAdmin, businessController.createFinancialYear);
  router.put('/financial-years/:fyId', ...withAdmin, businessController.updateFinancialYearStatus);

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Masters (Ledgers)
  // --------------------------------------------------------------------------

  router.get('/masters/ledgers', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT l.*, g.group_name, g.nature
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND l.is_active = 1
        ORDER BY l.ledger_name ASC
      `).all(req.companyId!);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/ledgers', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const { groupId, ledgerName, code, openingBalancePaise, openingBalanceType } = req.body;
      const companyId = req.companyId!;

      if (!ledgerName || typeof ledgerName !== 'string' || !ledgerName.trim()) {
        return res.status(400).json({ error: 'Ledger name is required and must be a non-empty string.' });
      }

      if (!groupId || typeof groupId !== 'string' || !groupId.trim()) {
        return res.status(400).json({ error: 'Ledger group is required.' });
      }

      const validGroup = db.prepare(`
        SELECT 1 FROM ledger_groups
        WHERE group_id = ? AND (company_id = ? OR company_id IS NULL)
      `).get(groupId.trim(), companyId);

      if (!validGroup) {
        return res.status(400).json({ error: `Ledger group '${groupId}' not found or belongs to another company.` });
      }

      const balType = openingBalanceType !== undefined && openingBalanceType !== null && String(openingBalanceType).trim() !== ''
        ? String(openingBalanceType).trim()
        : 'DR';

      if (balType !== 'DR' && balType !== 'CR') {
        return res.status(400).json({ error: `Invalid opening balance type '${openingBalanceType}'. Must be DR or CR.` });
      }

      const ledgerId = 'led_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);

      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ledgerId, companyId, groupId.trim(), ledgerName.trim(), code ? String(code).trim() : null, Math.round(Number(openingBalancePaise) || 0), balType);

      res.status(201).json({ ledgerId, ledgerName: ledgerName.trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/groups', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM ledger_groups WHERE company_id = ? OR company_id IS NULL ORDER BY group_name ASC').all(req.companyId!);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Masters (Parties)
  // --------------------------------------------------------------------------

  router.get('/masters/parties', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const type = req.query.type as string;
      let query = `
        SELECT p.*, pa.address_line1, pa.address_line2, pa.city, pa.state, pa.state_code, pa.pincode,
               l.opening_balance_paise, l.opening_balance_type,
               (COALESCE(l.opening_balance_paise * (CASE WHEN l.opening_balance_type = 'DR' THEN 1 ELSE -1 END), 0) +
                COALESCE((SELECT SUM(le.debit_paise - le.credit_paise) FROM ledger_entries le WHERE le.ledger_id = p.ledger_id), 0)) as current_balance_paise
        FROM parties p
        JOIN ledgers l ON p.ledger_id = l.ledger_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE p.company_id = ?
      `;
      const params: any[] = [req.companyId!];
      if (type) {
        query += ` AND (p.party_type = ? OR p.party_type = 'BOTH')`;
        params.push(type);
      }
      query += ` ORDER BY p.party_name ASC`;
      const rows = db.prepare(query).all(...params);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/parties', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const {
        partyName, partyType, gstin, pan, phone, email, contactPerson,
        bankingName, bankingAccountNo, bankingIfsc,
        addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise
      } = req.body;

      if (!partyName || !partyName.trim()) {
        return res.status(400).json({ error: 'Party Name is required.' });
      }

      let derivedPan = pan;
      if (!derivedPan && gstin && gstin.length === 15) {
        derivedPan = gstin.substring(2, 12);
      }

      db.exec('BEGIN TRANSACTION;');
      const partyId = 'party_' + Date.now().toString(36);
      const ledgerId = 'led_pty_' + Date.now().toString(36);
      const companyId = req.companyId!;

      const groupSearch = partyType === 'SUPPLIER' ? '%Creditor%' : '%Debtor%';
      const foundGroup = db.prepare('SELECT group_id FROM ledger_groups WHERE (company_id = ? OR company_id IS NULL) AND group_name LIKE ? LIMIT 1')
        .get(companyId, groupSearch) as { group_id: string } | undefined;
      const groupId = foundGroup?.group_id || (partyType === 'SUPPLIER' ? `${companyId}_grp_creditors` : `${companyId}_grp_debtors`);
      const balType = partyType === 'SUPPLIER' ? 'CR' : 'DR';

      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(ledgerId, companyId, groupId, partyName.trim(), openingBalancePaise || 0, balType);

      db.prepare(`
        INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person, banking_name, banking_account_no, banking_ifsc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(partyId, companyId, ledgerId, partyType, partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null, bankingName || null, bankingAccountNo || null, bankingIfsc || null);

      db.prepare(`
        INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, address_line2, city, state, state_code, pincode, is_default)
        VALUES (?, ?, 'BOTH', ?, ?, ?, ?, ?, ?, 1)
      `).run(
        'addr_' + Date.now().toString(36),
        partyId,
        addressLine1 || 'Main Business Address',
        addressLine2 || null,
        city || '',
        state || 'Tamil Nadu',
        stateCode || '33',
        pincode || ''
      );

      db.exec('COMMIT;');
      res.status(201).json({ partyId, partyName: partyName.trim(), ledgerId });
    } catch (err: any) {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/masters/parties/:id', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const partyId = req.params.id;
      const {
        partyName, partyType, gstin, pan, phone, email, contactPerson,
        bankingName, bankingAccountNo, bankingIfsc,
        addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise
      } = req.body;

      // Resource ownership check
      const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId) as any;
      if (!party || !assertResourceOwnership(res, party.company_id, req.companyId!)) return;

      db.exec('BEGIN TRANSACTION;');

      db.prepare(`
        UPDATE parties SET
          party_name = COALESCE(?, party_name),
          party_type = COALESCE(?, party_type),
          gstin = ?,
          pan = ?,
          phone = ?,
          email = ?,
          contact_person = ?,
          banking_name = ?,
          banking_account_no = ?,
          banking_ifsc = ?
        WHERE party_id = ?
      `).run(
        partyName ? partyName.trim() : null,
        partyType || null,
        gstin || null,
        pan || null,
        phone || null,
        email || null,
        contactPerson || null,
        bankingName || null,
        bankingAccountNo || null,
        bankingIfsc || null,
        partyId
      );

      if (partyName && party.ledger_id) {
        if (openingBalancePaise !== undefined && openingBalancePaise !== null) {
          const currentBal = db.prepare('SELECT opening_balance_paise FROM ledgers WHERE ledger_id = ?').get(party.ledger_id) as any;
          if (currentBal && Math.round(Number(openingBalancePaise)) !== Number(currentBal.opening_balance_paise)) {
            const txCount = (db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE ledger_id = ?').get(party.ledger_id) as any)?.cnt || 0;
            const vchCount = (db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE party_id = ?').get(partyId) as any)?.cnt || 0;
            const closedFy = db.prepare('SELECT 1 FROM financial_years WHERE company_id = ? AND status = "CLOSED" LIMIT 1').get(req.companyId!);
            if (txCount > 0 || vchCount > 0 || closedFy) {
              db.exec('ROLLBACK;');
              return res.status(400).json({
                error: `Cannot modify opening balance for party '${party.party_name}': financial transactions already exist or prior financial periods are closed. Use an accounting adjustment voucher instead.`
              });
            }
          }
        }

        db.prepare(`
          UPDATE ledgers SET
            ledger_name = ?,
            opening_balance_paise = COALESCE(?, opening_balance_paise)
          WHERE ledger_id = ?
        `).run(partyName.trim(), openingBalancePaise ?? null, party.ledger_id);
      }

      const existingAddr = db.prepare('SELECT address_id FROM party_addresses WHERE party_id = ? LIMIT 1').get(partyId) as any;
      if (existingAddr) {
        db.prepare(`
          UPDATE party_addresses SET
            address_line1 = COALESCE(?, address_line1),
            address_line2 = ?,
            city = COALESCE(?, city),
            state = COALESCE(?, state),
            state_code = COALESCE(?, state_code),
            pincode = COALESCE(?, pincode)
          WHERE address_id = ?
        `).run(
          addressLine1 || null,
          addressLine2 || null,
          city || null,
          state || null,
          stateCode || null,
          pincode || null,
          existingAddr.address_id
        );
      } else if (addressLine1 || city || state) {
        db.prepare(`
          INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, address_line2, city, state, state_code, pincode, is_default)
          VALUES (?, ?, 'BOTH', ?, ?, ?, ?, ?, ?, 1)
        `).run(
          'addr_' + Date.now().toString(36),
          partyId,
          addressLine1 || 'Main Business Address',
          addressLine2 || null,
          city || '',
          state || 'Tamil Nadu',
          stateCode || '33',
          pincode || ''
        );
      }

      db.exec('COMMIT;');
      res.json({ success: true, message: 'Party updated successfully.' });
    } catch (err: any) {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/masters/parties/:id', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const partyId = req.params.id;
      const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId) as any;
      if (!party || !assertResourceOwnership(res, party.company_id, req.companyId!)) return;

      const voucherCount = (db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE party_id = ?').get(partyId) as any)?.cnt || 0;

      let openingBal = 0;
      let allocCount = 0;
      let leCount = 0;
      if (party.ledger_id) {
        const ledgerRow = db.prepare('SELECT opening_balance_paise FROM ledgers WHERE ledger_id = ?').get(party.ledger_id) as any;
        openingBal = ledgerRow?.opening_balance_paise || 0;
        allocCount = (db.prepare('SELECT COUNT(*) as cnt FROM bill_allocations WHERE ledger_id = ?').get(party.ledger_id) as any)?.cnt || 0;
        leCount = (db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE ledger_id = ?').get(party.ledger_id) as any)?.cnt || 0;
      }

      if (voucherCount > 0 || Math.abs(openingBal) > 0 || allocCount > 0 || leCount > 0) {
        return res.status(400).json({
          error: `Cannot delete party '${party.party_name}' with existing transactions or opening balance.`
        });
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare('DELETE FROM party_addresses WHERE party_id = ?').run(partyId);
        db.prepare('DELETE FROM parties WHERE party_id = ?').run(partyId);
        if (party.ledger_id) {
          db.prepare('DELETE FROM ledgers WHERE ledger_id = ?').run(party.ledger_id);
        }
        db.exec('COMMIT;');
        res.json({ success: true, message: 'Party deleted successfully.' });
      } catch (delErr: any) {
        try { db.exec('ROLLBACK;'); } catch (_) {}
        res.status(500).json({ error: delErr.message });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Masters (Stock Items)
  // --------------------------------------------------------------------------

  router.get('/masters/items', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT si.*, u.symbol as unit_symbol
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.company_id = ? AND si.is_active = 1
        ORDER BY si.item_name ASC
      `).all(req.companyId!);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/items', ...withAccountant, (req: SecureRequest, res: Response) => {
    const b = req.body;
    const companyId = req.companyId!;

    if (!b.itemName || !b.itemName.trim()) {
      return res.status(400).json({ error: 'Item name is required.' });
    }

    if (b.unitId !== undefined && b.unitId !== null && String(b.unitId).trim() !== '') {
      const validUnit = db.prepare(`
        SELECT 1 FROM units WHERE unit_id = ? AND (company_id = ? OR company_id IS NULL)
      `).get(String(b.unitId).trim(), companyId);
      if (!validUnit) {
        return res.status(400).json({ error: `Unit '${b.unitId}' not found or belongs to another company.` });
      }
    }

    db.exec('BEGIN TRANSACTION;');
    try {
      const existing = db.prepare(`
        SELECT item_id, item_name, serial_numbers, purchase_rate_paise, selling_rate_paise
        FROM stock_items
        WHERE company_id = ? AND (LOWER(item_name) = LOWER(?) OR (sku IS NOT NULL AND sku != '' AND LOWER(sku) = LOWER(?)))
        LIMIT 1
      `).get(companyId, b.itemName.trim(), (b.sku || '').trim()) as any;

      let godownId = b.godownId;
      if (!godownId || godownId === 'godown_main') {
        const defGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(companyId) as any;
        godownId = defGodown?.godown_id || `${companyId}_godown_main`;
      }

      const qty = Number(b.quantityToAdd ?? b.openingQty ?? 0);
      const rate = Number(b.purchaseRatePaise ?? b.openingRatePaise ?? 0);
      const sellRate = Number(b.sellingRatePaise || 0);

      if (existing) {
        let updatedSerials = existing.serial_numbers || '';
        if (b.serialNumbers && b.serialNumbers.trim()) {
          updatedSerials = updatedSerials
            ? `${updatedSerials}, ${b.serialNumbers.trim()}`
            : b.serialNumbers.trim();

          const serialsArr = b.serialNumbers.split(',').map((s: string) => s.trim()).filter(Boolean);
          for (const s of serialsArr) {
            db.prepare('INSERT OR IGNORE INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, ?)')
              .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2,6), existing.item_id, s, 'AVAILABLE');
          }
        }

        db.prepare(`
          UPDATE stock_items SET
            is_active = 1,
            hsn_sac = COALESCE(?, hsn_sac),
            gst_rate = COALESCE(?, gst_rate),
            purchase_rate_paise = CASE WHEN ? > 0 THEN ? ELSE purchase_rate_paise END,
            selling_rate_paise = CASE WHEN ? > 0 THEN ? ELSE selling_rate_paise END,
            reorder_level = COALESCE(?, reorder_level),
            serial_numbers = ?,
            has_serial_no = CASE WHEN ? = 1 OR ? IS NOT NULL THEN 1 ELSE has_serial_no END
          WHERE item_id = ?
        `).run(
          b.hsnSac || null,
          b.gstRate || null,
          rate, rate,
          sellRate, sellRate,
          b.reorderLevel || null,
          updatedSerials || null,
          b.hasSerialNo ? 1 : 0,
          b.serialNumbers || null,
          existing.item_id
        );

        if (qty !== 0) {
          const today = new Date().toISOString().split('T')[0];
          const dateFy = db.prepare(`
            SELECT fy_id, status, name FROM financial_years 
            WHERE company_id = ? AND ? BETWEEN start_date AND end_date LIMIT 1
          `).get(companyId, today) as any;

          if (!dateFy) {
            db.exec('ROLLBACK;');
            return res.status(400).json({
              error: `Cannot adjust stock: No financial year found covering date '${today}'. Please create the appropriate financial year first.`
            });
          }
          if (dateFy.status !== 'OPEN') {
            db.exec('ROLLBACK;');
            return res.status(400).json({
              error: `Cannot adjust stock: Financial Year '${dateFy.name}' is ${dateFy.status}. Stock adjustments are prohibited in closed or locked periods.`
            });
          }

          const invRow = db.prepare(`
            SELECT ledger_id FROM ledgers 
            WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Inventory%') 
            LIMIT 1
          `).get(companyId, `${companyId}_led_inventory`) as any;
          const inventoryLedgerId = invRow?.ledger_id || `${companyId}_led_inventory`;

          const cogsRow = db.prepare(`
            SELECT ledger_id FROM ledgers 
            WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Cost of Goods%' OR ledger_name LIKE '%COGS%') 
            LIMIT 1
          `).get(companyId, `${companyId}_led_cogs`) as any;
          const cogsLedgerId = cogsRow?.ledger_id || `${companyId}_led_cogs`;

          if (qty > 0) {
            const summary = InventoryEngine.getItemStockSummary(db, existing.item_id, today);
            const effectiveRate = rate > 0
              ? rate
              : (summary.weightedAverageRatePaise > 0
                  ? summary.weightedAverageRatePaise
                  : (Number(existing.purchase_rate_paise) || 0));
            const valPaise = Math.round(qty * effectiveRate);
            PostingEngine.postVoucher(db, {
              companyId,
              fyId: dateFy.fy_id,
              voucherType: 'STOCK_JOURNAL',
              voucherDate: today,
              narration: `Stock adjustment inflow for '${existing.item_name}'`,
              status: 'POSTED',
              lines: [{
                itemId: existing.item_id,
                godownId,
                quantity: qty,
                ratePaise: effectiveRate,
                movementType: 'IN'
              }],
              customLedgerLines: [
                {
                  ledgerId: inventoryLedgerId,
                  debitPaise: valPaise,
                  creditPaise: 0,
                  particulars: `Inventory Asset Inflow - ${existing.item_name}`
                },
                {
                  ledgerId: cogsLedgerId,
                  debitPaise: 0,
                  creditPaise: valPaise,
                  particulars: `Stock Adjustment Inflow - ${existing.item_name}`
                }
              ]
            });
          } else {
            const absQty = Math.abs(qty);
            const allowNegative = b.allowNegativeStock === true;
            const avail = InventoryEngine.validateStockAvailability(db, existing.item_id, godownId, absQty, allowNegative);
            if (!avail.isValid) {
              db.exec('ROLLBACK;');
              return res.status(400).json({
                error: `Insufficient stock for item '${existing.item_name}' in godown '${godownId}'. Available: ${avail.currentQty}, Requested reduction: ${absQty}.`
              });
            }

            const summary = InventoryEngine.getItemStockSummary(db, existing.item_id, today);
            const unitCost = summary.weightedAverageRatePaise > 0 ? summary.weightedAverageRatePaise : (rate > 0 ? rate : (Number(existing.purchase_rate_paise) || 0));
            const valPaise = Math.round(absQty * unitCost);

            PostingEngine.postVoucher(db, {
              companyId,
              fyId: dateFy.fy_id,
              voucherType: 'STOCK_JOURNAL',
              voucherDate: today,
              narration: `Stock adjustment reduction for '${existing.item_name}'`,
              status: 'POSTED',
              allowNegativeStock: allowNegative,
              lines: [{
                itemId: existing.item_id,
                godownId,
                quantity: absQty,
                ratePaise: unitCost,
                movementType: 'OUT'
              }],
              customLedgerLines: [
                {
                  ledgerId: cogsLedgerId,
                  debitPaise: valPaise,
                  creditPaise: 0,
                  particulars: `Stock Adjustment Reduction - ${existing.item_name}`
                },
                {
                  ledgerId: inventoryLedgerId,
                  debitPaise: 0,
                  creditPaise: valPaise,
                  particulars: `Inventory Asset Reduction - ${existing.item_name}`
                }
              ]
            });
          }
        }

        db.exec('COMMIT;');
        return res.status(200).json({
          itemId: existing.item_id,
          itemName: existing.item_name,
          updated: true,
          message: `Stock updated successfully for '${existing.item_name}'. ${qty !== 0 ? `Adjusted by ${qty} units.` : 'Details updated.'}`
        });
      }

      let unitId = b.unitId ? String(b.unitId).trim() : null;
      if (!unitId || unitId === 'unit_nos') {
        const defUnit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(companyId) as any;
        unitId = defUnit?.unit_id || unitId || 'unit_nos';
      }

      const itemId = 'item_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level, serial_numbers, has_serial_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, companyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '84713010',
        unitId, b.gstRate !== undefined && b.gstRate !== null ? Number(b.gstRate) : 18.00, b.cessRate || 0,
        rate, sellRate,
        qty, rate, b.reorderLevel || 0,
        b.serialNumbers || null, b.hasSerialNo ? 1 : 0
      );

      if (qty > 0) {
        PostingEngine.recordOpeningStock(db, {
          companyId,
          itemId,
          itemName: b.itemName.trim(),
          godownId,
          quantity: qty,
          ratePaise: rate,
          userId: (req as any).user?.username || 'system'
        });
      }

      if (b.serialNumbers && b.serialNumbers.trim()) {
        const serialsArr = b.serialNumbers.split(',').map((s: string) => s.trim()).filter(Boolean);
        for (const s of serialsArr) {
          db.prepare('INSERT OR IGNORE INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, ?)')
            .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2,6), itemId, s, 'AVAILABLE');
        }
      }

      db.exec('COMMIT;');
      return res.status(201).json({ itemId, itemName: b.itemName, updated: false, message: `Created stock item '${b.itemName}'.` });
    } catch (err: any) {
      try {
        db.exec('ROLLBACK;');
      } catch { /* ignore rollback error */ }
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/items/:id/serials', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      // Verify item belongs to company
      const item = db.prepare('SELECT item_id, company_id, serial_numbers FROM stock_items WHERE item_id = ?').get(req.params.id) as any;
      if (!item || !assertResourceOwnership(res, item.company_id, req.companyId!)) return;

      const rows = db.prepare(`
        SELECT serial_number FROM stock_item_serials
        WHERE item_id = ? AND status = 'AVAILABLE'
      `).all(req.params.id) as any[];

      let list = rows.map((r: any) => r.serial_number);
      if (list.length === 0 && item.serial_numbers) {
        const soldRows = db.prepare(`
          SELECT serial_number FROM stock_item_serials
          WHERE item_id = ? AND status = 'SOLD'
        `).all(req.params.id) as any[];
        const soldSet = new Set(soldRows.map((r: any) => r.serial_number));

        list = item.serial_numbers
          .split(/[\n,]+/)
          .map((s: string) => s.trim())
          .filter((s: string) => Boolean(s) && !soldSet.has(s));
      }
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/masters/items/:id', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const b = req.body;
      const companyId = req.companyId!;
      // Resource ownership check
      const item = db.prepare('SELECT * FROM stock_items WHERE item_id = ?').get(req.params.id) as any;
      if (!item || !assertResourceOwnership(res, item.company_id, companyId)) return;

      let unitId = item.unit_id || 'unit_nos';
      if (b.unitId !== undefined && b.unitId !== null && String(b.unitId).trim() !== '') {
        const validUnit = db.prepare(`
          SELECT 1 FROM units WHERE unit_id = ? AND (company_id = ? OR company_id IS NULL)
        `).get(String(b.unitId).trim(), companyId);
        if (!validUnit) {
          return res.status(400).json({ error: `Unit '${b.unitId}' not found or belongs to another company.` });
        }
        unitId = String(b.unitId).trim();
      }

      const itemName = b.itemName !== undefined ? (String(b.itemName).trim() || item.item_name) : item.item_name;
      const itemCode = b.itemCode !== undefined ? (b.itemCode || null) : item.item_code;
      const sku = b.sku !== undefined ? (b.sku || null) : item.sku;
      const hsnSac = b.hsnSac !== undefined ? (b.hsnSac || null) : (item.hsn_sac || '84713010');
      const gstRate = b.gstRate !== undefined && b.gstRate !== null ? Number(b.gstRate) : (item.gst_rate ?? 18.00);
      const cessRate = b.cessRate !== undefined && b.cessRate !== null ? Number(b.cessRate) : (item.cess_rate ?? 0);
      const purchaseRatePaise = b.purchaseRatePaise !== undefined && b.purchaseRatePaise !== null ? Number(b.purchaseRatePaise) : (item.purchase_rate_paise ?? 0);
      const sellingRatePaise = b.sellingRatePaise !== undefined && b.sellingRatePaise !== null ? Number(b.sellingRatePaise) : (item.selling_rate_paise ?? 0);
      const reorderLevel = b.reorderLevel !== undefined && b.reorderLevel !== null ? Number(b.reorderLevel) : (item.reorder_level ?? 0);

      db.prepare(`
        UPDATE stock_items SET
          item_name = ?, item_code = ?, sku = ?, hsn_sac = ?,
          unit_id = ?, gst_rate = ?, cess_rate = ?,
          purchase_rate_paise = ?, selling_rate_paise = ?,
          reorder_level = ?
        WHERE item_id = ?
      `).run(
        itemName, itemCode, sku, hsnSac,
        unitId, gstRate, cessRate,
        purchaseRatePaise, sellingRatePaise,
        reorderLevel,
        req.params.id
      );
      res.json({ success: true, message: 'Stock item updated successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/masters/items/:id', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const itemId = req.params.id;
      const item = db.prepare('SELECT item_id, company_id FROM stock_items WHERE item_id = ?').get(itemId) as any;
      if (!item || !assertResourceOwnership(res, item.company_id, req.companyId!)) return;

      const lineCount = (db.prepare('SELECT COUNT(*) as cnt FROM voucher_lines WHERE item_id = ?').get(itemId) as any)?.cnt || 0;
      const stockEntryCount = (db.prepare('SELECT COUNT(*) as cnt FROM stock_entries WHERE item_id = ?').get(itemId) as any)?.cnt || 0;

      if (lineCount > 0 || stockEntryCount > 0) {
        db.prepare('UPDATE stock_items SET is_active = 0 WHERE item_id = ?').run(itemId);
        return res.json({ success: true, message: 'Stock item deactivated successfully (historical transactions preserved).' });
      }

      db.exec('BEGIN TRANSACTION;');
      try {
        db.prepare('DELETE FROM stock_item_serials WHERE item_id = ?').run(itemId);
        db.prepare('DELETE FROM stock_items WHERE item_id = ?').run(itemId);
        db.exec('COMMIT;');
        res.json({ success: true, message: 'Stock item removed successfully.' });
      } catch (delErr: any) {
        try { db.exec('ROLLBACK;'); } catch (_) {}
        res.status(500).json({ error: delErr.message });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/godowns', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM godowns WHERE company_id = ? OR company_id IS NULL ORDER BY godown_name ASC').all(req.companyId!);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/units', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM units WHERE company_id = ? OR company_id IS NULL ORDER BY unit_name ASC').all(req.companyId!);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Vouchers
  // --------------------------------------------------------------------------

  router.get('/vouchers/next-number', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { fyId, type } = req.query as { fyId: string; type: string };
      // Verify FY belongs to company
      if (fyId) {
        const fy = db.prepare('SELECT fy_id FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, req.companyId!) as any;
        if (!fy) return res.status(400).json({ error: 'Invalid financial year for this company.' });
      }
      const nextNum = PostingEngine.getNextVoucherNumber(db, req.companyId!, fyId, type);
      res.json({ nextVoucherNumber: nextNum });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vouchers', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { type, fromDate, toDate } = req.query as any;
      let query = `
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.party_type
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ?
      `;
      const params: any[] = [req.companyId!];
      if (type) {
        query += ` AND v.voucher_type = ?`;
        params.push(type);
      }
      if (fromDate) {
        query += ` AND v.voucher_date >= ?`;
        params.push(fromDate);
      }
      if (toDate) {
        query += ` AND v.voucher_date <= ?`;
        params.push(toDate);
      }
      query += ` ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 100`;
      const rows = db.prepare(query).all(...params);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vouchers/:id', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const voucher = db.prepare(`
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.phone as party_phone,
               pa.address_line1, pa.city, pa.state, pa.state_code, pa.pincode
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE v.voucher_id = ?
      `).get(req.params.id) as any;

      if (!voucher || !assertResourceOwnership(res, voucher.company_id, req.companyId!)) return;

      const lines = db.prepare(`
        SELECT vl.*, si.item_name, si.hsn_sac, u.symbol as unit_symbol, g.godown_name
        FROM voucher_lines vl
        LEFT JOIN stock_items si ON vl.item_id = si.item_id
        LEFT JOIN units u ON si.unit_id = u.unit_id
        LEFT JOIN godowns g ON vl.godown_id = g.godown_id
        WHERE vl.voucher_id = ?
        ORDER BY vl.line_number ASC
      `).all(req.params.id);

      const ledgerEntries = db.prepare(`
        SELECT le.*, l.ledger_name
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        WHERE le.voucher_id = ?
      `).all(req.params.id);

      const stockEntries = db.prepare(`
        SELECT se.*, si.item_name, g.godown_name
        FROM stock_entries se
        JOIN stock_items si ON se.item_id = si.item_id
        JOIN godowns g ON se.godown_id = g.godown_id
        WHERE se.voucher_id = ?
      `).all(req.params.id);

      res.json({ voucher, lines, ledgerEntries, stockEntries });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/vouchers', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;

      // Resolve FY — strictly validate against company and voucherDate
      const vDate = req.body.voucherDate || new Date().toISOString().split('T')[0];
      let fyId = req.body.fyId;

      if (fyId) {
        const explicitFy = db.prepare('SELECT fy_id, status, name, start_date, end_date FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, companyId) as any;
        if (!explicitFy) {
          return res.status(400).json({ error: `Financial year '${fyId}' not found for this company.` });
        }
        if (vDate < explicitFy.start_date || vDate > explicitFy.end_date) {
          return res.status(400).json({
            error: `Voucher date ${vDate} is outside specified Financial Year '${explicitFy.name || fyId}' (${explicitFy.start_date} to ${explicitFy.end_date}).`
          });
        }
        if (explicitFy.status !== 'OPEN') {
          return res.status(400).json({ error: `Financial Year '${explicitFy.name || fyId}' is ${explicitFy.status}. Posting prohibited.` });
        }
      } else {
        const dateFy = db.prepare(`
          SELECT fy_id, status, name, start_date, end_date FROM financial_years 
          WHERE company_id = ? AND ? BETWEEN start_date AND end_date LIMIT 1
        `).get(companyId, vDate) as any;

        if (!dateFy) {
          return res.status(400).json({
            error: `No financial year found covering voucher date '${vDate}'. Please create the appropriate financial year first.`
          });
        }
        if (dateFy.status !== 'OPEN') {
          return res.status(400).json({
            error: `Financial Year '${dateFy.name}' covering date '${vDate}' is ${dateFy.status}. Posting prohibited.`
          });
        }
        fyId = dateFy.fy_id;
      }

      // Build payload — use server-resolved companyId, never trust body.companyId
      const payload = {
        ...req.body,
        companyId,
        fyId,
        createdBy: req.user!.userId  // Always use authenticated user ID
      };

      const result = PostingEngine.postVoucher(db, payload);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * PUT /vouchers/:id — Edit a voucher
   *
   * IMMUTABILITY POLICY:
   * Posted vouchers cannot be silently overwritten. The edit operation:
   *   1. Verifies the voucher belongs to req.companyId
   *   2. Cancels the original (creates reversal ledger entries)
   *   3. Records the cancellation with the authenticated user ID
   *   4. Creates a new replacement voucher
   *   5. Links replacement to original via reference_number
   *
   * The original voucher record is preserved in CANCELLED status.
   * The full accounting trail (original + reversal + replacement) remains reconstructable.
   *
   * NOTE: Hard-delete of original voucher record was the pre-existing behavior.
   * This implementation preserves the original record (status=CANCELLED) per immutability rules.
   */
  router.put('/vouchers/:id', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;
      const voucherId = req.params.id;
      const fyId = req.body.fyId;

      if (!fyId) return res.status(400).json({ error: 'Financial year ID is required for editing a voucher.' });

      // Verify voucher ownership
      const vch = db.prepare('SELECT voucher_id, company_id, status, voucher_number FROM vouchers WHERE voucher_id = ?').get(voucherId) as any;
      if (!vch || !assertResourceOwnership(res, vch.company_id, companyId)) return;

      // Verify FY belongs to company
      const fy = db.prepare('SELECT fy_id FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, companyId) as any;
      if (!fy) return res.status(400).json({ error: 'Invalid financial year for this company.' });

      // 006-A: Atomic voucher amendment inside single transaction
      const payload = {
        ...req.body,
        companyId,
        fyId,
        createdBy: req.user!.userId,
        referenceNumber: req.body.referenceNumber || `AMEND-${vch.voucher_number}`
      };

      const result = PostingEngine.amendVoucher(db, voucherId, payload);
      res.status(200).json({
        voucherId: result.replacementVoucherId,
        voucherNumber: result.replacementVoucherNumber,
        totalAmountPaise: result.totalAmountPaise,
        status: result.status,
        amendedVoucherId: voucherId
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /vouchers/:id/cancel — Cancel a posted voucher
   * Requires ADMIN role. Authenticated actor is recorded in audit log.
   */
  router.post('/vouchers/:id/cancel', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const vch = db.prepare('SELECT voucher_id, company_id FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
      if (!vch || !assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

      const { reason } = req.body;
      PostingEngine.cancelVoucher(db, req.companyId!, req.params.id, req.user!.userId, reason || 'Cancelled by user');
      res.json({ success: true, message: 'Voucher cancelled and accounting effects reversed.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /vouchers/:id/post — Promote a DRAFT voucher to POSTED
   * Requires ACCOUNTANT, ADMIN, or OWNER role.
   */
  router.post('/vouchers/:id/post', ...withAccountant, (req: SecureRequest, res: Response) => {
    try {
      const vch = db.prepare('SELECT voucher_id, company_id FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
      if (!vch || !assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

      const result = PostingEngine.postDraftVoucher(db, req.companyId!, req.params.id, req.user!.userId);
      res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * DELETE /vouchers/:id — BLOCKED
   *
   * Posted vouchers are immutable accounting records.
   * Use POST /vouchers/:id/cancel to reverse accounting effects.
   * Returns 405 Method Not Allowed.
   */
  router.delete('/vouchers/:id', ...withAdmin, (req: SecureRequest, res: Response) => {
    // Verify ownership first before revealing policy
    const vch = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
    if (!vch || !assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

    res.status(405).json({
      error: 'Direct voucher deletion is not permitted. Posted vouchers are permanent accounting records. Use the cancel operation to reverse accounting effects.'
    });
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Reports (all require authentication + company membership)
  // --------------------------------------------------------------------------

  router.get('/reports/dashboard', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;
      const today = new Date().toISOString().split('T')[0];

      const todaySales = db.prepare(`
        SELECT COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND voucher_type = 'SALES' AND voucher_date = ? AND status = 'POSTED'
      `).get(companyId, today) as { total: number };

      const todayPurchases = db.prepare(`
        SELECT COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND voucher_type = 'PURCHASE' AND voucher_date = ? AND status = 'POSTED'
      `).get(companyId, today) as { total: number };

      // DEF-REP-10: Include opening balances in receivables, payables, and cash/bank, and expose bank overdraft accurately
      const receivables = db.prepare(`
        SELECT COALESCE(SUM(
          COALESCE(l.opening_balance_paise * (CASE WHEN l.opening_balance_type = 'DR' THEN 1 ELSE -1 END), 0) +
          COALESCE(le.net_dr, 0)
        ), 0) as balance
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        LEFT JOIN (
          SELECT le.ledger_id, SUM(le.debit_paise - le.credit_paise) as net_dr
          FROM ledger_entries le
          JOIN vouchers v ON le.voucher_id = v.voucher_id
          WHERE v.status = 'POSTED'
          GROUP BY le.ledger_id
        ) le ON l.ledger_id = le.ledger_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%debtor%' OR g.group_name LIKE '%Debtor%')
      `).get(companyId) as { balance: number };

      const payables = db.prepare(`
        SELECT COALESCE(SUM(
          COALESCE(l.opening_balance_paise * (CASE WHEN l.opening_balance_type = 'CR' THEN 1 ELSE -1 END), 0) +
          COALESCE(le.net_cr, 0)
        ), 0) as balance
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        LEFT JOIN (
          SELECT le.ledger_id, SUM(le.credit_paise - le.debit_paise) as net_cr
          FROM ledger_entries le
          JOIN vouchers v ON le.voucher_id = v.voucher_id
          WHERE v.status = 'POSTED'
          GROUP BY le.ledger_id
        ) le ON l.ledger_id = le.ledger_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%creditor%' OR g.group_name LIKE '%Creditor%')
      `).get(companyId) as { balance: number };

      const cashBank = db.prepare(`
        SELECT COALESCE(SUM(
          COALESCE(l.opening_balance_paise * (CASE WHEN l.opening_balance_type = 'DR' THEN 1 ELSE -1 END), 0) +
          COALESCE(le.net_dr, 0)
        ), 0) as balance
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        LEFT JOIN (
          SELECT le.ledger_id, SUM(le.debit_paise - le.credit_paise) as net_dr
          FROM ledger_entries le
          JOIN vouchers v ON le.voucher_id = v.voucher_id
          WHERE v.status = 'POSTED'
          GROUP BY le.ledger_id
        ) le ON l.ledger_id = le.ledger_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%cash%' OR l.group_id LIKE '%bank%' OR g.group_name LIKE '%Cash%' OR g.group_name LIKE '%Bank%')
      `).get(companyId) as { balance: number };

      const stockSummary = ReportEngine.getStockSummary(db, companyId);
      const totalStockValPaise = stockSummary.reduce((sum, item) => sum + item.totalValuePaise, 0);

      const recentVouchers = db.prepare(`
        SELECT v.voucher_id, v.voucher_number, v.voucher_type, v.voucher_date, v.total_amount_paise, p.party_name
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ? AND v.status = 'POSTED'
        ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 5
      `).all(companyId);

      // DEF-REP-09: Stock alerts use actual stock quantity compared against actual reorder level
      const stockAlerts = stockSummary
        .filter(item => (item.reorderLevel > 0 && item.quantity <= item.reorderLevel) || item.quantity <= 0)
        .slice(0, 5)
        .map(item => ({
          name: item.itemName,
          qty: `${item.quantity} Units`,
          status: item.quantity <= 0 ? 'critical' : 'warning'
        }));

      const trendData = db.prepare(`
        SELECT
          substr(voucher_date, 1, 7) as month,
          voucher_type,
          COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND status = 'POSTED' AND voucher_type IN ('SALES', 'PURCHASE')
        GROUP BY substr(voucher_date, 1, 7), voucher_type
        ORDER BY month ASC
      `).all(companyId) as { month: string; voucher_type: string; total: number }[];

      res.json({
        todaySalesPaise: todaySales.total,
        todayPurchasesPaise: todayPurchases.total,
        receivablesPaise: Math.max(0, receivables.balance),
        payablesPaise: Math.max(0, payables.balance),
        cashBankPaise: cashBank.balance, // DEF-REP-10: Expose overdraft / negative balance accurately
        stockValuePaise: totalStockValPaise,
        stockAlerts,
        trendData,
        recentVouchers
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/daybook', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { fromDate, toDate } = req.query as any;
      const today = new Date().toISOString().split('T')[0];
      const data = ReportEngine.getDayBook(db, req.companyId!, fromDate || '2000-01-01', toDate || today);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/ledger/:id', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      // Verify the ledger belongs to the company
      const ledger = db.prepare('SELECT ledger_id, company_id FROM ledgers WHERE ledger_id = ?').get(req.params.id) as any;
      if (!ledger || !assertResourceOwnership(res, ledger.company_id, req.companyId!)) return;

      const { fromDate, toDate } = req.query as any;
      const today = new Date().toISOString().split('T')[0];
      const data = ReportEngine.getLedgerStatement(db, req.companyId!, req.params.id, fromDate || '2000-01-01', toDate || today);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/trial-balance', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { asOnDate } = req.query as any;
      const data = ReportEngine.getTrialBalance(db, req.companyId!, asOnDate || new Date().toISOString().split('T')[0]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/profit-loss', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { fromDate, toDate } = req.query as any;
      const today = new Date().toISOString().split('T')[0];
      const data = ReportEngine.getProfitAndLoss(db, req.companyId!, fromDate || '2000-01-01', toDate || today);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/balance-sheet', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { asOnDate } = req.query as any;
      const data = ReportEngine.getBalanceSheet(db, req.companyId!, asOnDate || new Date().toISOString().split('T')[0]);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/stock-summary', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { asOfDate } = req.query as any;
      const data = ReportEngine.getStockSummary(db, req.companyId!, asOfDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/outstanding', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { type, asOnDate } = req.query as any;
      const data = ReportEngine.getOutstandingReport(db, req.companyId!, type || 'CUSTOMER', asOnDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/gst-summary', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const { fromDate, toDate } = req.query as any;
      const today = new Date().toISOString().split('T')[0];
      const data = ReportEngine.getGstSummary(db, req.companyId!, fromDate || '2000-01-01', toDate || today);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Utilities
  // --------------------------------------------------------------------------

  /**
   * POST /utilities/backup
   * Requires OWNER role. Creates a database backup file.
   *
   * SECURITY: Backup path is not returned to frontend to avoid path disclosure.
   */
  router.post('/utilities/backup', ...withOwner, (req: SecureRequest, res: Response) => {
    try {
      const backupDir = './data/backups';
      const fs = require('node:fs');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${backupDir}/ledgerflow_backup_${timestamp}.db`;
      db.exec(`VACUUM INTO '${backupFile}';`);
      // Do not return filesystem path — just confirm success
      res.json({ success: true, message: 'Backup created successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /utilities/audit-logs
   * Requires authentication + company membership + ADMIN or OWNER role.
   * Returns ONLY the resolved company's audit logs.
   */
  router.get('/utilities/audit-logs', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const logs = db.prepare(
        'SELECT * FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT 200'
      ).all(req.companyId!);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /utilities/reset-data
   * Requires: ALLOW_DATA_RESET=true env + OWNER role + password re-entry
   * Resets ONLY the resolved company's data.
   */
  router.post('/utilities/reset-data', ...withOwner, (req: SecureRequest, res: Response) => {
    try {
      // Check env kill-switch
      if (process.env.ALLOW_DATA_RESET !== 'true') {
        return res.status(404).json({ error: 'Not found' });
      }

      // Require password re-entry
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required to confirm data reset.' });
      }

      const bcrypt = require('bcryptjs');
      const dbUser = db.prepare('SELECT password_hash FROM users WHERE user_id = ?').get(req.user!.userId) as any;
      if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
        return res.status(401).json({ error: 'Incorrect password. Data reset rejected.' });
      }

      const companyId = req.companyId!;

      // Reset ONLY this company's data
      db.exec('BEGIN TRANSACTION;');
      try {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.prepare('DELETE FROM bill_allocations WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM tax_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM stock_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM ledger_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM voucher_lines WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM vouchers WHERE company_id = ?').run(companyId);
        db.prepare('DELETE FROM party_addresses WHERE party_id IN (SELECT party_id FROM parties WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM parties WHERE company_id = ?').run(companyId);
        db.prepare('DELETE FROM stock_entries WHERE item_id IN (SELECT item_id FROM stock_items WHERE company_id = ?)').run(companyId);
        db.prepare('DELETE FROM stock_items WHERE company_id = ?').run(companyId);
        db.prepare('DELETE FROM ledgers WHERE company_id = ? AND is_party = 1').run(companyId);
        db.exec('PRAGMA foreign_keys = ON;');

        // Audit this destructive action
        db.prepare(`
          INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
          VALUES (?, ?, ?, 'RESET_COMPANY_DATA', 'COMPANY', ?, ?)
        `).run(
          'aud_' + Date.now().toString(36),
          companyId,
          req.user!.userId,
          companyId,
          JSON.stringify({ reason: 'Manual company data reset by OWNER', timestamp: new Date().toISOString() })
        );

        db.exec('COMMIT;');
      } catch (innerErr) {
        db.exec('ROLLBACK;');
        throw innerErr;
      }

      res.json({
        success: true,
        message: 'Company data reset successfully.',
        counts: {
          vouchers: (db.prepare('SELECT COUNT(*) as c FROM vouchers WHERE company_id = ?').get(companyId) as any).c,
          parties: (db.prepare('SELECT COUNT(*) as c FROM parties WHERE company_id = ?').get(companyId) as any).c,
          stock_items: (db.prepare('SELECT COUNT(*) as c FROM stock_items WHERE company_id = ?').get(companyId) as any).c
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
