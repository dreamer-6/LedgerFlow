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

import { createLoginRateLimiter } from '../middleware/rateLimiter.js';

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
  const loginLimiter = createLoginRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxIpAttempts: 10,
    maxAccountAttempts: 5
  });

  const authController = new AuthController(db);
  router.post('/auth/register', authController.register);
  router.post('/auth/login', loginLimiter, authController.login);
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

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Users & Team Members
  // --------------------------------------------------------------------------
  router.get('/companies/current/users', ...withCompany, businessController.getCompanyMembers);
  router.post('/companies/current/users', ...withAdmin, businessController.addCompanyMember);
  router.put('/companies/current/users/:userId/role', ...withAdmin, businessController.updateMemberRole);
  router.delete('/companies/current/users/:userId', ...withAdmin, businessController.removeCompanyMember);

  router.get('/financial-years', ...withCompany, businessController.getFinancialYears);
  router.post('/financial-years', ...withAdmin, businessController.createFinancialYear);
  router.put('/financial-years/:fyId', ...withAdmin, businessController.updateFinancialYearStatus);

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Masters (Ledgers)
  // --------------------------------------------------------------------------

  router.get('/masters/ledgers', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;

      // UI-046/UI-047: Auto-ensure standard charge & bill sundry ledgers exist for this company
      const expenseGroup = db.prepare(`
        SELECT group_id FROM ledger_groups 
        WHERE (company_id = ? OR company_id IS NULL) AND (group_id LIKE '%indirect_expense%' OR group_id LIKE '%direct_expense%' OR nature = 'EXPENSE')
        LIMIT 1
      `).get(companyId) as any;
      const incomeGroup = db.prepare(`
        SELECT group_id FROM ledger_groups 
        WHERE (company_id = ? OR company_id IS NULL) AND (group_id LIKE '%indirect_income%' OR nature = 'INCOME')
        LIMIT 1
      `).get(companyId) as any;

      if (expenseGroup) {
        const hasFreight = db.prepare('SELECT 1 FROM ledgers WHERE company_id = ? AND (ledger_name LIKE ? OR ledger_id LIKE ?)').get(companyId, '%Freight%', '%_led_freight');
        if (!hasFreight) {
          db.prepare(`
            INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type, is_party, is_active)
            VALUES (?, ?, ?, ?, ?, 0, 'DR', 0, 1)
          `).run(`${companyId}_led_freight`, companyId, expenseGroup.group_id, 'Freight Charges', 'FREIGHT');
        }
        const hasPackaging = db.prepare('SELECT 1 FROM ledgers WHERE company_id = ? AND (ledger_name LIKE ? OR ledger_id LIKE ?)').get(companyId, '%Packaging%', '%_led_packaging');
        if (!hasPackaging) {
          db.prepare(`
            INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type, is_party, is_active)
            VALUES (?, ?, ?, ?, ?, 0, 'DR', 0, 1)
          `).run(`${companyId}_led_packaging`, companyId, expenseGroup.group_id, 'Packaging Charges', 'PACK');
        }
        const hasDiscountAllowed = db.prepare('SELECT 1 FROM ledgers WHERE company_id = ? AND (ledger_name LIKE ? OR ledger_id LIKE ?)').get(companyId, '%Discount%', '%_led_discount%');
        if (!hasDiscountAllowed) {
          db.prepare(`
            INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type, is_party, is_active)
            VALUES (?, ?, ?, ?, ?, 0, 'DR', 0, 1)
          `).run(`${companyId}_led_discount_allowed`, companyId, expenseGroup.group_id, 'Discount Allowed', 'DISC_ALW');
        }
      }
      if (incomeGroup) {
        const hasDiscountReceived = db.prepare('SELECT 1 FROM ledgers WHERE company_id = ? AND ledger_name LIKE ?').get(companyId, '%Discount Received%');
        if (!hasDiscountReceived) {
          db.prepare(`
            INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type, is_party, is_active)
            VALUES (?, ?, ?, ?, ?, 0, 'CR', 0, 1)
          `).run(`${companyId}_led_discount_received`, companyId, incomeGroup.group_id, 'Discount Received', 'DISC_REC');
        }
      }

      const rows = db.prepare(`
        SELECT l.*, g.group_name, g.nature
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND l.is_active = 1
        ORDER BY l.ledger_name ASC
      `).all(companyId);
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

      if (openingBalancePaise !== undefined && openingBalancePaise !== null && Number(openingBalancePaise) < 0) {
        return res.status(400).json({ error: 'Opening balance cannot be negative. Use opening balance type (DR/CR) to indicate debit or credit balance.' });
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
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A ledger with this name or code already exists in this company.' });
      }
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

      if (openingBalancePaise !== undefined && openingBalancePaise !== null && Number(openingBalancePaise) < 0) {
        return res.status(400).json({ error: 'Opening balance cannot be negative. Use opening balance type (DR/CR) to indicate debit or credit balance.' });
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
      try { db.exec('ROLLBACK;'); } catch (_) {}
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A party or ledger with this name or unique identifier already exists in this company.' });
      }
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

      if (openingBalancePaise !== undefined && openingBalancePaise !== null && Number(openingBalancePaise) < 0) {
        return res.status(400).json({ error: 'Opening balance cannot be negative. Use opening balance type (DR/CR) to indicate debit or credit balance.' });
      }

      // DEF-008-10: Protect party classification and synchronize ledger group safely
      if (partyType && partyType !== party.party_type) {
        const txCount = (db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE ledger_id = ?').get(party.ledger_id) as any)?.cnt || 0;
        const vchCount = (db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE party_id = ?').get(partyId) as any)?.cnt || 0;
        if (txCount > 0 || vchCount > 0) {
          return res.status(400).json({
            error: `Cannot change party type for '${party.party_name}' from ${party.party_type} to ${partyType}: posted financial activity exists for this party.`
          });
        }

        // Safe to synchronize ledger group when no posted transactions exist
        const groupSearch = partyType === 'SUPPLIER' ? '%Creditor%' : '%Debtor%';
        const foundGroup = db.prepare('SELECT group_id FROM ledger_groups WHERE (company_id = ? OR company_id IS NULL) AND group_name LIKE ? LIMIT 1')
          .get(req.companyId!, groupSearch) as { group_id: string } | undefined;
        const newGroupId = foundGroup?.group_id || (partyType === 'SUPPLIER' ? `${req.companyId!}_grp_creditors` : `${req.companyId!}_grp_debtors`);
        db.prepare('UPDATE ledgers SET group_id = ? WHERE ledger_id = ? AND company_id = ?').run(newGroupId, party.ledger_id, req.companyId!);
      }

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
            const closedFy = db.prepare('SELECT 1 FROM financial_years WHERE company_id = ? AND status = ? LIMIT 1').get(req.companyId!, 'CLOSED');
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
      try { db.exec('ROLLBACK;'); } catch (_) {}
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A party or ledger with this name or unique identifier already exists in this company.' });
      }
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
        SELECT si.*, u.symbol as unit_symbol, u.unit_name
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

    if (b.openingQty !== undefined && b.openingQty !== null && Number(b.openingQty) < 0) {
      return res.status(400).json({ error: 'Opening stock quantity cannot be negative.' });
    }
    if (b.purchaseRatePaise !== undefined && b.purchaseRatePaise !== null && Number(b.purchaseRatePaise) < 0) {
      return res.status(400).json({ error: 'Purchase rate cannot be negative.' });
    }
    if (b.sellingRatePaise !== undefined && b.sellingRatePaise !== null && Number(b.sellingRatePaise) < 0) {
      return res.status(400).json({ error: 'Selling rate cannot be negative.' });
    }

    if (b.unitId !== undefined && b.unitId !== null && String(b.unitId).trim() !== '') {
      const validUnit = db.prepare(`
        SELECT 1 FROM units WHERE unit_id = ? AND (company_id = ? OR company_id IS NULL)
      `).get(String(b.unitId).trim(), companyId);
      if (!validUnit) {
        return res.status(400).json({ error: `Unit '${b.unitId}' not found or belongs to another company.` });
      }
    }

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
        db.exec('BEGIN IMMEDIATE;');
        try {
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
              warranty_months = COALESCE(?, warranty_months),
              serial_numbers = ?,
              has_serial_no = CASE WHEN ? = 1 OR ? IS NOT NULL THEN 1 ELSE has_serial_no END
            WHERE item_id = ?
          `).run(
            b.hsnSac || null,
            b.gstRate || null,
            rate, rate,
            sellRate, sellRate,
            b.reorderLevel || null,
            b.warrantyMonths !== undefined ? Number(b.warrantyMonths) : null,
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
              throw new Error(`Cannot adjust stock: No financial year found covering date '${today}'. Please create the appropriate financial year first.`);
            }
            if (dateFy.status !== 'OPEN') {
              throw new Error(`Cannot adjust stock: Financial Year '${dateFy.name}' is ${dateFy.status}. Stock adjustments are prohibited in closed or locked periods.`);
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
                  gstRate: 0,
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
              }, { skipTransaction: true });
            } else {
              const absQty = Math.abs(qty);
              const allowNegative = b.allowNegativeStock === true;
              const avail = InventoryEngine.validateStockAvailability(db, existing.item_id, godownId, absQty, allowNegative);
              if (!avail.isValid) {
                throw new Error(`Insufficient stock for item '${existing.item_name}' in godown '${godownId}'. Available: ${avail.currentQty}, Requested reduction: ${absQty}.`);
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
                  gstRate: 0,
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
              }, { skipTransaction: true });
            }
          }

          db.exec('COMMIT;');
        } catch (updateErr: any) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
          return res.status(400).json({ error: updateErr.message });
        }

        return res.status(200).json({
          itemId: existing.item_id,
          itemName: existing.item_name,
          updated: true,
          message: `Stock updated successfully for '${existing.item_name}'. ${qty !== 0 ? `Adjusted by ${qty} units.` : 'Details updated.'}`
        });
      }

      let unitId = b.unitId ? String(b.unitId).trim() : null;
      if (!unitId) {
        const nosUnit = db.prepare(`
          SELECT unit_id FROM units
          WHERE (company_id = ? OR company_id IS NULL) AND (UPPER(symbol) = 'NOS' OR LOWER(unit_name) LIKE '%number%' OR LOWER(unit_name) LIKE '%nos%')
          ORDER BY company_id DESC LIMIT 1
        `).get(companyId) as { unit_id: string } | undefined;

        if (!nosUnit) {
          const newUnitId = `${companyId}_unit_nos`;
          db.prepare(`
            INSERT OR IGNORE INTO units (unit_id, company_id, unit_name, symbol, uqc_code, decimal_places)
            VALUES (?, ?, 'Numbers', 'Nos', 'NOS', 0)
          `).run(newUnitId, companyId);
          unitId = newUnitId;
        } else {
          unitId = nosUnit.unit_id;
        }
      }

      db.exec('BEGIN TRANSACTION;');
      const itemId = 'item_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
      const warrantyMonths = b.warrantyMonths !== undefined && b.warrantyMonths !== null ? Number(b.warrantyMonths) : 0;
      db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level, warranty_months, serial_numbers, has_serial_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, companyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '84713010',
        unitId, b.gstRate !== undefined && b.gstRate !== null ? Number(b.gstRate) : 18.00, b.cessRate || 0,
        rate, sellRate,
        qty, rate, b.reorderLevel || 0,
        warrantyMonths,
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
        const todayStr = new Date().toISOString().split('T')[0];
        let expiryDate: string | null = null;
        if (warrantyMonths > 0) {
          const [y, m, d] = todayStr.split('-').map(Number);
          const exp = new Date(y, m - 1 + warrantyMonths, d);
          expiryDate = `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;
        }
        const serialsArr = b.serialNumbers.split(',').map((s: string) => s.trim()).filter(Boolean);
        for (const s of serialsArr) {
          db.prepare('INSERT OR IGNORE INTO stock_item_serials (serial_id, item_id, serial_number, status, purchase_date, warranty_expiry_date) VALUES (?, ?, ?, ?, ?, ?)')
            .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2,6), itemId, s, 'AVAILABLE', todayStr, expiryDate);
        }
      }

      db.exec('COMMIT;');
      return res.status(201).json({ itemId, itemName: b.itemName, updated: false, message: `Created stock item '${b.itemName}'.` });
    } catch (err: any) {
      try {
        db.exec('ROLLBACK;');
      } catch { /* ignore rollback error */ }
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A stock item with this name, item code, or SKU already exists in this company.' });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  router.get('/masters/items/:id', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const item = db.prepare(`
        SELECT si.*, u.symbol as unit_symbol, u.unit_name
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.item_id = ?
      `).get(req.params.id) as any;
      if (!item || !assertResourceOwnership(res, item.company_id, req.companyId!)) return;
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/items/:id/serials', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      // Verify item belongs to company
      const item = db.prepare('SELECT item_id, company_id, item_name, serial_numbers FROM stock_items WHERE item_id = ?').get(req.params.id) as any;
      if (!item || !assertResourceOwnership(res, item.company_id, req.companyId!)) return;

      const isDetailed = req.query.detailed === 'true';
      const godownId = req.query.godownId as string | undefined;

      let query = `
        SELECT serial_id, serial_number, status, godown_id, purchase_date, warranty_expiry_date
        FROM stock_item_serials
        WHERE (company_id = ? OR company_id IS NULL)
          AND item_id = ?
          AND status = 'AVAILABLE'
      `;
      const params: any[] = [req.companyId!, req.params.id];
      if (godownId) {
        query += ` AND (godown_id = ? OR godown_id IS NULL)`;
        params.push(godownId);
      }
      query += ` ORDER BY purchase_date ASC, created_at ASC`;

      const rows = db.prepare(query).all(...params) as any[];

      if (isDetailed) {
        const result = rows.map(r => ({
          serialId: r.serial_id,
          serialNumber: r.serial_number,
          status: r.status,
          godownId: r.godown_id || null,
          purchaseDate: r.purchase_date || null,
          warrantyExpiryDate: r.warranty_expiry_date || null
        }));

        if (result.length > 0) {
          return res.json(result);
        }

        // Backward compatibility fallback: parse item.serial_numbers if no physical unit rows exist yet
        if (item.serial_numbers) {
          const soldRows = db.prepare(`
            SELECT serial_number FROM stock_item_serials
            WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND status = 'SOLD'
          `).all(req.companyId!, req.params.id) as any[];
          const soldSet = new Set(soldRows.map((r: any) => r.serial_number));

          const list = item.serial_numbers
            .split(/[\n,]+/)
            .map((s: string) => s.trim())
            .filter((s: string) => Boolean(s) && !soldSet.has(s));

          return res.json(list.map((sn: string) => ({
            serialId: `ser_legacy_${sn}`,
            serialNumber: sn,
            status: 'AVAILABLE',
            godownId: godownId || null,
            purchaseDate: null,
            warrantyExpiryDate: null
          })));
        }

        return res.json([]);
      }

      let list = rows.map((r: any) => r.serial_number);
      if (list.length === 0 && item.serial_numbers) {
        const soldRows = db.prepare(`
          SELECT serial_number FROM stock_item_serials
          WHERE (company_id = ? OR company_id IS NULL) AND item_id = ? AND status = 'SOLD'
        `).all(req.companyId!, req.params.id) as any[];
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

  // UI-045: Serial Number Register API
  router.get('/inventory/serials/register', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;
      const itemId = req.query.itemId as string | undefined;
      const godownId = req.query.godownId as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const search = (req.query.search as string || '').trim().toLowerCase();
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const supplierId = req.query.supplierId as string | undefined;
      const customerId = req.query.customerId as string | undefined;

      // Summary KPIs
      const summaryRows = db.prepare(`
        SELECT status, COUNT(*) as cnt
        FROM stock_item_serials
        WHERE (company_id = ? OR company_id IS NULL)
        GROUP BY status
      `).all(companyId) as Array<{ status: string; cnt: number }>;

      let total = 0;
      let available = 0;
      let sold = 0;
      let returned = 0;
      let damaged = 0;

      for (const r of summaryRows) {
        total += Number(r.cnt);
        if (r.status === 'AVAILABLE') available += Number(r.cnt);
        else if (r.status === 'SOLD') sold += Number(r.cnt);
        else if (r.status === 'RETURNED') returned += Number(r.cnt);
        else if (r.status === 'DAMAGED' || r.status === 'WRITTEN_OFF') damaged += Number(r.cnt);
      }

      // Query detailed serial items
      let query = `
        SELECT 
          s.serial_id, s.serial_number, s.status, s.purchase_date, s.warranty_expiry_date, s.sales_date, s.created_at,
          s.item_id, i.item_name, i.item_code, i.sku,
          s.godown_id, g.godown_name,
          s.purchase_voucher_id, pv.voucher_number as purchase_voucher_number,
          s.supplier_id, sup.party_name as supplier_name,
          s.sales_voucher_id, sv.voucher_number as sales_voucher_number,
          s.customer_id, cus.party_name as customer_name
        FROM stock_item_serials s
        JOIN stock_items i ON s.item_id = i.item_id
        LEFT JOIN godowns g ON s.godown_id = g.godown_id
        LEFT JOIN vouchers pv ON s.purchase_voucher_id = pv.voucher_id
        LEFT JOIN parties sup ON s.supplier_id = sup.party_id
        LEFT JOIN vouchers sv ON s.sales_voucher_id = sv.voucher_id
        LEFT JOIN parties cus ON s.customer_id = cus.party_id
        WHERE (s.company_id = ? OR s.company_id IS NULL)
      `;
      const params: any[] = [companyId];

      if (itemId) {
        query += ` AND s.item_id = ?`;
        params.push(itemId);
      }
      if (godownId) {
        query += ` AND s.godown_id = ?`;
        params.push(godownId);
      }
      if (statusFilter && statusFilter !== 'ALL') {
        query += ` AND s.status = ?`;
        params.push(statusFilter);
      }
      if (supplierId) {
        query += ` AND s.supplier_id = ?`;
        params.push(supplierId);
      }
      if (customerId) {
        query += ` AND s.customer_id = ?`;
        params.push(customerId);
      }
      if (dateFrom) {
        query += ` AND (s.purchase_date >= ? OR s.created_at >= ?)`;
        params.push(dateFrom, dateFrom);
      }
      if (dateTo) {
        query += ` AND (s.purchase_date <= ? OR s.created_at <= ?)`;
        params.push(dateTo, dateTo);
      }
      if (search) {
        query += ` AND (LOWER(s.serial_number) LIKE ? OR LOWER(i.item_name) LIKE ? OR LOWER(COALESCE(i.item_code, '')) LIKE ?)`;
        const wild = `%${search}%`;
        params.push(wild, wild, wild);
      }

      query += ` ORDER BY s.created_at DESC, s.purchase_date DESC LIMIT 500`;

      const rows = db.prepare(query).all(...params) as any[];

      const formattedSerials = rows.map(r => ({
        serialId: r.serial_id,
        serialNumber: r.serial_number,
        status: r.status,
        itemId: r.item_id,
        itemName: r.item_name,
        itemCode: r.item_code || '',
        sku: r.sku || '',
        godownId: r.godown_id || null,
        godownName: r.godown_name || 'Main Location',
        purchaseVoucherId: r.purchase_voucher_id || null,
        purchaseVoucherNumber: r.purchase_voucher_number || null,
        purchaseDate: r.purchase_date || null,
        supplierId: r.supplier_id || null,
        supplierName: r.supplier_name || null,
        salesVoucherId: r.sales_voucher_id || null,
        salesVoucherNumber: r.sales_voucher_number || null,
        salesDate: r.sales_date || null,
        customerId: r.customer_id || null,
        customerName: r.customer_name || null,
        warrantyExpiryDate: r.warranty_expiry_date || null,
        createdAt: r.created_at
      }));

      res.json({
        summary: { total, available, sold, returned, damaged },
        serials: formattedSerials
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // UI-045: Serial Lifecycle History API
  router.get('/inventory/serials/:id/history', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const serial = db.prepare(`
        SELECT 
          s.*,
          i.item_name, i.item_code, i.sku,
          g.godown_name,
          pv.voucher_number as purchase_voucher_number,
          sup.party_name as supplier_name,
          sv.voucher_number as sales_voucher_number,
          cus.party_name as customer_name
        FROM stock_item_serials s
        JOIN stock_items i ON s.item_id = i.item_id
        LEFT JOIN godowns g ON s.godown_id = g.godown_id
        LEFT JOIN vouchers pv ON s.purchase_voucher_id = pv.voucher_id
        LEFT JOIN parties sup ON s.supplier_id = sup.party_id
        LEFT JOIN vouchers sv ON s.sales_voucher_id = sv.voucher_id
        LEFT JOIN parties cus ON s.customer_id = cus.party_id
        WHERE (s.company_id = ? OR s.company_id IS NULL)
          AND (s.serial_id = ? OR s.serial_number = ?)
      `).get(req.companyId!, req.params.id, req.params.id) as any;

      if (!serial) {
        return res.status(404).json({ error: `Serial '${req.params.id}' not found.` });
      }

      res.json(serial);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/items/:id/stock-balance', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const item = db.prepare(`
        SELECT si.item_id, si.company_id, si.item_name, si.item_code, si.sku, si.hsn_sac,
               si.opening_qty, si.opening_rate_paise, si.purchase_rate_paise, si.selling_rate_paise,
               COALESCE(u.symbol, 'Nos') as unit_symbol
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.item_id = ?
      `).get(req.params.id) as any;

      if (!item) {
        return res.status(404).json({ error: `Stock item '${req.params.id}' not found.` });
      }
      if (!assertResourceOwnership(res, item.company_id, req.companyId!)) return;

      const isService = Boolean(
        (item.hsn_sac && String(item.hsn_sac).trim().startsWith('99')) ||
        (item.item_name && item.item_name.toLowerCase().includes('service'))
      );

      if (isService) {
        return res.json({
          itemId: item.item_id,
          itemName: item.item_name,
          isInventoryTracked: false,
          isService: true,
          unitSymbol: item.unit_symbol || 'Service',
          totalAvailableStock: null,
          availableStock: null,
          godownId: (req.query.godownId as string) || null,
          godownBalances: [],
          message: 'Item is a service and does not track inventory balances.'
        });
      }

      const requestedGodownId = req.query.godownId as string | undefined;
      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
      const summary = InventoryEngine.getItemStockSummary(db, item.item_id, asOfDate);

      let godownStock: number | null = null;
      if (requestedGodownId) {
        const godown = db.prepare('SELECT godown_id, godown_name, company_id FROM godowns WHERE godown_id = ? AND (company_id = ? OR company_id IS NULL)').get(requestedGodownId, req.companyId!) as any;
        if (!godown) {
          const foreign = db.prepare('SELECT company_id FROM godowns WHERE godown_id = ?').get(requestedGodownId) as any;
          if (foreign && foreign.company_id !== req.companyId) {
            return res.status(403).json({ error: 'Unauthorized access to foreign company godown.' });
          }
          return res.status(404).json({ error: `Godown '${requestedGodownId}' not found.` });
        }

        const check = InventoryEngine.validateStockAvailability(db, item.item_id, requestedGodownId, 0, false);
        godownStock = check.currentQty;
      }

      // Godown balances list
      const godowns = db.prepare(`
        SELECT g.godown_id, g.godown_name, g.is_default
        FROM godowns g
        WHERE g.company_id = ? OR g.company_id IS NULL
        ORDER BY g.is_default DESC, g.godown_name ASC
      `).all(req.companyId!) as any[];

      const godownBalances = godowns.map(g => {
        const gCheck = InventoryEngine.validateStockAvailability(db, item.item_id, g.godown_id, 0, false);
        return {
          godownId: g.godown_id,
          godownName: g.godown_name,
          isDefault: Boolean(g.is_default),
          availableStock: gCheck.currentQty
        };
      });

      res.json({
        itemId: item.item_id,
        itemName: item.item_name,
        isInventoryTracked: true,
        isService: false,
        unitSymbol: item.unit_symbol,
        totalAvailableStock: summary.totalQuantity,
        availableStock: requestedGodownId ? godownStock : summary.totalQuantity,
        godownId: requestedGodownId || null,
        godownBalances,
        weightedAverageRatePaise: summary.weightedAverageRatePaise,
        totalValuePaise: summary.totalValuePaise
      });
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
      const warrantyMonths = b.warrantyMonths !== undefined && b.warrantyMonths !== null ? Number(b.warrantyMonths) : (item.warranty_months ?? 0);
      const hasSerialNo = b.hasSerialNo !== undefined ? (b.hasSerialNo ? 1 : 0) : item.has_serial_no;

      if (b.purchaseRatePaise !== undefined && b.purchaseRatePaise !== null && Number(b.purchaseRatePaise) < 0) {
        return res.status(400).json({ error: 'Purchase rate cannot be negative.' });
      }
      if (b.sellingRatePaise !== undefined && b.sellingRatePaise !== null && Number(b.sellingRatePaise) < 0) {
        return res.status(400).json({ error: 'Selling rate cannot be negative.' });
      }

      db.prepare(`
        UPDATE stock_items SET
          item_name = ?, item_code = ?, sku = ?, hsn_sac = ?,
          unit_id = ?, gst_rate = ?, cess_rate = ?,
          purchase_rate_paise = ?, selling_rate_paise = ?,
          reorder_level = ?, warranty_months = ?, has_serial_no = ?
        WHERE item_id = ?
      `).run(
        itemName, itemCode, sku, hsnSac,
        unitId, gstRate, cessRate,
        purchaseRatePaise, sellingRatePaise,
        reorderLevel, warrantyMonths, hasSerialNo,
        req.params.id
      );
      res.json({ success: true, message: 'Stock item updated successfully.' });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'A stock item with this name, item code, or SKU already exists in this company.' });
      }
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
      const { type, fromDate, toDate, status, partyId, includeHidden, showCancelled } = req.query as any;
      let query = `
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.party_type,
               pa.city as party_city, pa.state as party_state,
               COALESCE((
                 SELECT SUM(ba.amount_paise)
                 FROM bill_allocations ba
                 JOIN vouchers rv ON ba.voucher_id = rv.voucher_id
                 WHERE ba.reference_voucher_id = v.voucher_id
                   AND rv.status != 'CANCELLED'
               ), 0) as paid_amount_paise,
               COALESCE((
                 SELECT SUM(ba.amount_paise)
                 FROM bill_allocations ba
                 WHERE ba.voucher_id = v.voucher_id
                   AND ba.allocation_type = 'AGAINST_REF'
               ), 0) as allocated_amount_paise,
                (
                  SELECT l.ledger_name
                  FROM ledger_entries le
                  JOIN ledgers l ON le.ledger_id = l.ledger_id
                  WHERE le.voucher_id = v.voucher_id
                    AND le.debit_paise > 0
                  LIMIT 1
                ) as received_into_ledger_name,
                (
                  SELECT l.ledger_name
                  FROM ledger_entries le
                  JOIN ledgers l ON le.ledger_id = l.ledger_id
                  WHERE le.voucher_id = v.voucher_id
                    AND le.credit_paise > 0
                  LIMIT 1
                ) as paid_from_ledger_name,
                (
                  SELECT l.ledger_name
                  FROM ledger_entries le
                  JOIN ledgers l ON le.ledger_id = l.ledger_id
                  WHERE le.voucher_id = v.voucher_id
                    AND le.debit_paise > 0
                  LIMIT 1
                ) as paid_to_ledger_name,
               COALESCE((
                 SELECT COUNT(*)
                 FROM voucher_lines vl
                 WHERE vl.voucher_id = v.voucher_id
               ), 0) as line_items_count
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        LEFT JOIN (
          SELECT party_id, city, state FROM party_addresses GROUP BY party_id
        ) pa ON p.party_id = pa.party_id
        WHERE v.company_id = ?
      `;
      const params: any[] = [req.companyId!];

      // Default: exclude hidden vouchers unless includeHidden is specifically requested
      if (includeHidden !== 'true' && includeHidden !== '1') {
        query += ` AND COALESCE(v.is_hidden, 0) = 0`;
      }
      // Optional: exclude CANCELLED vouchers if showCancelled === 'false' or '0'
      if (showCancelled === 'false' || showCancelled === '0') {
        query += ` AND v.status != 'CANCELLED'`;
      }
      if (type) {
        query += ` AND v.voucher_type = ?`;
        params.push(type);
      }
      if (status) {
        query += ` AND v.status = ?`;
        params.push(status);
      }
      if (partyId) {
        query += ` AND v.party_id = ?`;
        params.push(partyId);
      }
      if (fromDate) {
        query += ` AND v.voucher_date >= ?`;
        params.push(fromDate);
      }
      if (toDate) {
        query += ` AND v.voucher_date <= ?`;
        params.push(toDate);
      }
      query += ` ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 200`;
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
               pa.address_line1, pa.address_line2, pa.city, pa.state, pa.state_code, pa.pincode
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE v.voucher_id = ?
      `).get(req.params.id) as any;

      if (!voucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      if (!assertResourceOwnership(res, voucher.company_id, req.companyId!)) return;

      const lines = db.prepare(`
        SELECT vl.*, si.item_name, si.hsn_sac, u.symbol as unit_symbol, g.godown_name,
               si.gst_rate as item_gst_rate, si.warranty_months as item_warranty_months,
               si.has_serial_no,
               l.ledger_name, lg.group_name
        FROM voucher_lines vl
        LEFT JOIN stock_items si ON vl.item_id = si.item_id
        LEFT JOIN units u ON si.unit_id = u.unit_id
        LEFT JOIN godowns g ON vl.godown_id = g.godown_id
        LEFT JOIN ledgers l ON vl.ledger_id = l.ledger_id
        LEFT JOIN ledger_groups lg ON l.group_id = lg.group_id
        WHERE vl.voucher_id = ?
        ORDER BY vl.line_number ASC
      `).all(req.params.id) as any[];

      // QA-012 & UI-046: Faithful historical serial recovery using exact line mapping
      const allocatedSerialIds = new Set<string>();
      for (const line of lines) {
        if (line.item_id) {
          let matchedSerials: string[] = [];
          if (voucher.voucher_type === 'SALES' || voucher.voucher_type === 'DELIVERY_NOTE') {
            // 1. Direct line-level mapping via sales_voucher_line_id
            const lineRows = db.prepare(`
              SELECT serial_id, serial_number FROM stock_item_serials 
              WHERE sales_voucher_line_id = ? AND item_id = ? 
              ORDER BY serial_number ASC
            `).all(line.line_id, line.item_id) as any[];

            if (lineRows.length > 0) {
              matchedSerials = lineRows.map(r => {
                allocatedSerialIds.add(r.serial_id);
                return r.serial_number;
              });
            } else if (!line.serial_number) {
              // 2. Legacy fallback for records created without line_id: allocate unassigned serials up to quantity
              const legacyRows = db.prepare(`
                SELECT serial_id, serial_number FROM stock_item_serials 
                WHERE sales_voucher_id = ? AND item_id = ? 
                ORDER BY serial_number ASC
              `).all(voucher.voucher_id, line.item_id) as any[];

              const availableForLine = legacyRows.filter(r => !allocatedSerialIds.has(r.serial_id));
              const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
              const slice = availableForLine.slice(0, qty);
              slice.forEach(r => allocatedSerialIds.add(r.serial_id));
              matchedSerials = slice.map(r => r.serial_number);
            }
          } else if (voucher.voucher_type === 'PURCHASE' || voucher.voucher_type === 'RECEIPT_NOTE') {
            // 1. Direct line-level mapping via purchase_voucher_line_id
            const lineRows = db.prepare(`
              SELECT serial_id, serial_number FROM stock_item_serials 
              WHERE purchase_voucher_line_id = ? AND item_id = ? 
              ORDER BY serial_number ASC
            `).all(line.line_id, line.item_id) as any[];

            if (lineRows.length > 0) {
              matchedSerials = lineRows.map(r => {
                allocatedSerialIds.add(r.serial_id);
                return r.serial_number;
              });
            } else if (!line.serial_number) {
              // 2. Legacy fallback for records created without line_id: allocate unassigned serials up to quantity
              const legacyRows = db.prepare(`
                SELECT serial_id, serial_number FROM stock_item_serials 
                WHERE purchase_voucher_id = ? AND item_id = ? 
                ORDER BY serial_number ASC
              `).all(voucher.voucher_id, line.item_id) as any[];

              const availableForLine = legacyRows.filter(r => !allocatedSerialIds.has(r.serial_id));
              const qty = Math.max(1, Math.round(Number(line.quantity) || 1));
              const slice = availableForLine.slice(0, qty);
              slice.forEach(r => allocatedSerialIds.add(r.serial_id));
              matchedSerials = slice.map(r => r.serial_number);
            }
          }
          if (matchedSerials.length > 0) {
            line.serial_number = matchedSerials.join(', ');
          }
        }
      }

      const ledgerEntries = db.prepare(`
        SELECT le.*, l.ledger_name, lg.group_name
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        LEFT JOIN ledger_groups lg ON l.group_id = lg.group_id
        WHERE le.voucher_id = ?
      `).all(req.params.id);

      const stockEntries = db.prepare(`
        SELECT se.*, si.item_name, g.godown_name
        FROM stock_entries se
        JOIN stock_items si ON se.item_id = si.item_id
        JOIN godowns g ON se.godown_id = g.godown_id
        WHERE se.voucher_id = ?
      `).all(req.params.id);

      const billAllocations = db.prepare(`
        SELECT ba.*,
               v.voucher_number as alloc_voucher_number,
               v.voucher_type as alloc_voucher_type,
               v.voucher_date as alloc_voucher_date,
               v.payment_mode as alloc_payment_mode,
               v.status as alloc_voucher_status,
               COALESCE(ref_v.voucher_number, v.voucher_number) as ref_voucher_number,
               COALESCE(ref_v.voucher_type, v.voucher_type) as ref_voucher_type,
               COALESCE(ref_v.voucher_date, v.voucher_date) as ref_voucher_date,
               COALESCE(ref_v.payment_mode, v.payment_mode) as ref_payment_mode,
               COALESCE(ref_v.status, v.status) as ref_voucher_status,
               ref_v.total_amount_paise as ref_total_amount_paise,
               (
                 SELECT COALESCE(SUM(sub_ba.amount_paise), 0)
                 FROM bill_allocations sub_ba
                 JOIN vouchers sub_rv ON sub_ba.voucher_id = sub_rv.voucher_id
                 WHERE sub_ba.reference_voucher_id = ref_v.voucher_id
                   AND sub_rv.status != 'CANCELLED'
               ) as ref_paid_amount_paise
        FROM bill_allocations ba
        LEFT JOIN vouchers v ON (ba.voucher_id = v.voucher_id)
        LEFT JOIN vouchers ref_v ON (ba.reference_voucher_id = ref_v.voucher_id)
        WHERE (ba.reference_voucher_id = ? OR ba.voucher_id = ?)
          AND COALESCE(v.status, 'POSTED') != 'CANCELLED'
        ORDER BY ba.created_at ASC
      `).all(req.params.id, req.params.id);

      const paidPaise = db.prepare(`
        SELECT COALESCE(SUM(ba.amount_paise), 0) as paid_paise
        FROM bill_allocations ba
        JOIN vouchers rv ON ba.voucher_id = rv.voucher_id
        WHERE ba.reference_voucher_id = ? AND rv.status != 'CANCELLED'
      `).get(req.params.id) as any;
      voucher.paid_amount_paise = Number(paidPaise?.paid_paise || 0);

      res.json({ voucher, lines, ledgerEntries, stockEntries, billAllocations });
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

      // Verify voucher ownership
      const vch = db.prepare('SELECT voucher_id, company_id, status, voucher_number, fy_id FROM vouchers WHERE voucher_id = ?').get(voucherId) as any;
      if (!vch || !assertResourceOwnership(res, vch.company_id, companyId)) return;

      const fyId = req.body.fyId || vch.fy_id;
      if (!fyId) return res.status(400).json({ error: 'Financial year ID is required for editing a voucher.' });

      // Verify FY belongs to company
      const fy = db.prepare('SELECT fy_id FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, companyId) as any;
      if (!fy) return res.status(400).json({ error: 'Invalid financial year for this company.' });

      if (vch.status === 'DRAFT') {
        const payload = {
          ...req.body,
          companyId,
          fyId,
          createdBy: req.user!.userId
        };
        const result = PostingEngine.updateDraftVoucher(db, voucherId, payload);
        return res.status(200).json({
          voucherId: result.voucherId,
          voucherNumber: result.voucherNumber,
          totalAmountPaise: result.totalAmountPaise,
          status: result.status
        });
      }

      if (vch.status === 'POSTED') {
        // 006-A: Atomic voucher amendment inside single transaction
        const payload = {
          ...req.body,
          companyId,
          fyId,
          createdBy: req.user!.userId,
          referenceNumber: req.body.referenceNumber || `AMEND-${vch.voucher_number}`
        };
        if (payload.voucherNumber && payload.voucherNumber.trim() === vch.voucher_number) {
          payload.voucherNumber = undefined;
        }

        const result = PostingEngine.amendVoucher(db, voucherId, payload);
        return res.status(200).json({
          voucherId: result.replacementVoucherId,
          voucherNumber: result.replacementVoucherNumber,
          totalAmountPaise: result.totalAmountPaise,
          status: result.status,
          amendedVoucherId: voucherId
        });
      }

      return res.status(400).json({
        error: `Vouchers with status '${vch.status}' cannot be edited.`
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
   * DELETE /vouchers/:id — Lifecycle-aware voucher deletion
   *
   * - POSTED vouchers: BLOCKED (405 Method Not Allowed) to preserve immutability and accounting history.
   * - DRAFT vouchers: Safely deleted if unposted.
   * - CANCELLED vouchers: Eligible for permanent purge if all dependent records are audited and purged
   *   by an authorized OWNER/ADMIN with an explicit tombstone logged.
   */
  router.delete('/vouchers/:id', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const vch = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
      if (!vch) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      if (!assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

      // Invariant: Direct deletion of active POSTED vouchers is strictly prohibited (Suite 5 Test 5.1)
      if (vch.status === 'POSTED') {
        return res.status(405).json({
          error: 'Direct voucher deletion is not permitted. Posted vouchers are permanent accounting records. Use the cancel operation to reverse accounting effects.'
        });
      }

      // DEF-008-09: Unposted DRAFT vouchers have zero accounting or stock effects and may be deleted
      if (vch.status === 'DRAFT') {
        try {
          db.exec('BEGIN IMMEDIATE;');
          db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(vch.voucher_id);
          db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(vch.voucher_id);

          db.prepare(`
            INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            vch.company_id,
            req.user!.userId,
            'DRAFT_VOUCHER_DELETED',
            'vouchers',
            vch.voucher_id,
            JSON.stringify({ voucher_number: vch.voucher_number, voucher_type: vch.voucher_type, status: 'DRAFT' })
          );
          db.exec('COMMIT;');
          return res.status(200).json({ success: true, message: 'Draft voucher deleted successfully.' });
        } catch (delErr: any) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
          throw delErr;
        }
      }

      // CANCELLED vouchers: Permanent purge with strict accounting safeguards
      if (vch.status === 'CANCELLED') {
        const role = req.membershipRole || req.user?.role;
        if (role !== 'OWNER' && role !== 'ADMIN') {
          return res.status(403).json({ error: 'Permanent deletion requires OWNER or ADMIN role.' });
        }

        // Check dependent allocations where other vouchers reference this one
        const depAllocs = db.prepare(`
          SELECT ba.allocation_id, ba.voucher_id, ba.amount_paise,
                 v.voucher_number, v.voucher_type, v.status as voucher_status, v.company_id as voucher_company_id
          FROM bill_allocations ba
          LEFT JOIN vouchers v ON ba.voucher_id = v.voucher_id
          WHERE ba.reference_voucher_id = ? AND ba.voucher_id != ?
        `).all(vch.voucher_id, vch.voucher_id) as Array<{
          allocation_id: string;
          voucher_id: string;
          amount_paise: number;
          voucher_number?: string;
          voucher_type?: string;
          voucher_status?: string;
          voucher_company_id?: string;
        }>;

        // Active allocations are those where the referencing voucher is active (POSTED) and in same company
        const activeDepAllocs = depAllocs.filter(
          a => a.voucher_company_id === vch.company_id && a.voucher_status === 'POSTED'
        );

        if (activeDepAllocs.length > 0) {
          const details = activeDepAllocs.map(a => `${a.voucher_type || 'Voucher'} ${a.voucher_number || a.voucher_id} (₹${((a.amount_paise || 0) / 100).toFixed(2)})`).join(', ');
          return res.status(400).json({
            error: `Cannot permanently delete cancelled voucher: Active payment allocation(s) [${details}] still reference this document. Cancel or de-allocate those vouchers first, or use 'Hide from Normal Lists' instead.`
          });
        }

        const reason = req.body?.reason || 'Permanent deletion of cancelled voucher by authorized administrator';

        try {
          db.exec('BEGIN IMMEDIATE;');
          // 1. Audit tombstone logged before purging
          db.prepare(`
            INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            vch.company_id,
            req.user!.userId,
            'VOUCHER_PERMANENT_PURGE',
            'vouchers',
            vch.voucher_id,
            JSON.stringify({
              voucher_id: vch.voucher_id,
              voucher_number: vch.voucher_number,
              voucher_type: vch.voucher_type,
              fy_id: vch.fy_id,
              voucher_date: vch.voucher_date,
              total_amount_paise: vch.total_amount_paise,
              original_status: 'CANCELLED',
              cancelled_by: vch.cancelled_by,
              cancelled_at: vch.cancelled_at,
              deleted_by: req.user!.userId,
              deleted_at: new Date().toISOString(),
              reason
            })
          );

          // 2. Safely purge dependent entries within atomic transaction (including stale reference allocations)
          db.prepare('DELETE FROM tax_entries WHERE voucher_id = ?').run(vch.voucher_id);
          db.prepare('DELETE FROM bill_allocations WHERE voucher_id = ? OR reference_voucher_id = ?').run(vch.voucher_id, vch.voucher_id);
          db.prepare('DELETE FROM stock_entries WHERE voucher_id = ?').run(vch.voucher_id);
          db.prepare('DELETE FROM ledger_entries WHERE voucher_id = ?').run(vch.voucher_id);
          db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(vch.voucher_id);
          db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(vch.voucher_id);
          db.exec('COMMIT;');
          return res.status(200).json({
            success: true,
            message: `Voucher ${vch.voucher_number || ''} permanently deleted and audit tombstone recorded.`
          });
        } catch (purgeErr: any) {
          try { db.exec('ROLLBACK;'); } catch (_) {}
          throw purgeErr;
        }
      }

      res.status(405).json({
        error: 'Direct voucher deletion is not permitted. Posted vouchers are permanent accounting records. Use the cancel operation to reverse accounting effects.'
      });
    } catch (err: any) {
      console.error('DELETE voucher error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /vouchers/:id/hide — Hide an eligible cancelled voucher from default lists
   */
  router.post('/vouchers/:id/hide', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const vch = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
      if (!vch) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      if (!assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

      db.prepare('UPDATE vouchers SET is_hidden = 1 WHERE voucher_id = ?').run(vch.voucher_id);
      res.json({ success: true, message: 'Voucher hidden from normal lists.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * POST /vouchers/:id/unhide — Restore a hidden voucher to normal lists
   */
  router.post('/vouchers/:id/unhide', ...withAdmin, (req: SecureRequest, res: Response) => {
    try {
      const vch = db.prepare('SELECT voucher_id, company_id, status FROM vouchers WHERE voucher_id = ?').get(req.params.id) as any;
      if (!vch) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      if (!assertResourceOwnership(res, vch.company_id, req.companyId!)) return;

      db.prepare('UPDATE vouchers SET is_hidden = 0 WHERE voucher_id = ?').run(vch.voucher_id);
      res.json({ success: true, message: 'Voucher restored to normal lists.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --------------------------------------------------------------------------
  // COMPANY-SCOPED — Reports (all require authentication + company membership)
  // --------------------------------------------------------------------------

  router.get('/reports/dashboard', ...withCompany, (req: SecureRequest, res: Response) => {
    try {
      const companyId = req.companyId!;
      const today = new Date().toISOString().split('T')[0];
      const periodParam = (req.query.period as string) || 'Financial Year';

      // Helper to get company's configured financial year (respecting fyId query param) or fallback
      const getCompanyFy = () => {
        const fyIdParam = (req.query.fyId as string | undefined)?.trim();
        if (fyIdParam) {
          const selectedFy = db.prepare(`
            SELECT start_date, end_date FROM financial_years
            WHERE company_id = ? AND fy_id = ?
          `).get(companyId, fyIdParam) as { start_date: string; end_date: string } | undefined;

          if (selectedFy) {
            return {
              startDate: selectedFy.start_date,
              endDate: selectedFy.end_date,
              startYear: parseInt(selectedFy.start_date.substring(0, 4), 10)
            };
          }
        }

        const openFy = db.prepare(`
          SELECT start_date, end_date FROM financial_years
          WHERE company_id = ? AND status = 'OPEN'
          ORDER BY start_date DESC LIMIT 1
        `).get(companyId) as { start_date: string; end_date: string } | undefined;

        if (openFy) {
          return {
            startDate: openFy.start_date,
            endDate: openFy.end_date,
            startYear: parseInt(openFy.start_date.substring(0, 4), 10)
          };
        }
        const now = new Date();
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        const sYear = m >= 4 ? y : y - 1;
        return {
          startDate: `${sYear}-04-01`,
          endDate: `${sYear + 1}-03-31`,
          startYear: sYear
        };
      };

      // 1. Resolve Date Range according to period filter
      let fromDate: string;
      let toDate = (req.query.toDate as string) || today;
      let fyStartYear = parseInt(today.substring(0, 4), 10);
      let isFyScope = false;

      if (periodParam === 'Single Day') {
        const selectedDate = (req.query.date as string) || (req.query.fromDate as string) || today;
        fromDate = selectedDate;
        toDate = selectedDate;
        const fy = getCompanyFy();
        fyStartYear = fy.startYear;
      } else if (periodParam === 'Custom Date Range' || periodParam === 'Custom') {
        fromDate = (req.query.fromDate as string) || today;
        toDate = (req.query.toDate as string) || today;
        const fy = getCompanyFy();
        fyStartYear = fy.startYear;
      } else if (periodParam === 'Financial Year' || periodParam === 'This FY') {
        isFyScope = true;
        const fy = getCompanyFy();
        fromDate = fy.startDate;
        toDate = fy.endDate;
        fyStartYear = fy.startYear;
      } else if (periodParam === 'Last 12 Months') {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        d.setDate(1);
        fromDate = d.toISOString().split('T')[0];
      } else if (periodParam === 'Last 6 Months') {
        const d = new Date();
        d.setMonth(d.getMonth() - 5);
        d.setDate(1);
        fromDate = d.toISOString().split('T')[0];
      } else if (req.query.fromDate) {
        fromDate = req.query.fromDate as string;
      } else {
        // Default fallback: Financial Year
        isFyScope = true;
        const fy = getCompanyFy();
        fromDate = fy.startDate;
        toDate = fy.endDate;
        fyStartYear = fy.startYear;
      }

      // 2. Net Sales Turnover (Before Tax / Taxable Amount) for selected period & today
      const periodSales = db.prepare(`
        SELECT COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'SALES' AND status = 'POSTED' AND voucher_date BETWEEN ? AND ?), 0
        ) - COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'SALES_RETURN' AND status = 'POSTED' AND voucher_date BETWEEN ? AND ?), 0
        ) as total
      `).get(companyId, fromDate, toDate, companyId, fromDate, toDate) as { total: number };

      const todaySales = db.prepare(`
        SELECT COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'SALES' AND status = 'POSTED' AND voucher_date = ?), 0
        ) - COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'SALES_RETURN' AND status = 'POSTED' AND voucher_date = ?), 0
        ) as total
      `).get(companyId, today, companyId, today) as { total: number };

      // 3. Net Purchases Turnover (Before Tax / Taxable Amount) for selected period & today
      const periodPurchases = db.prepare(`
        SELECT COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'PURCHASE' AND status = 'POSTED' AND voucher_date BETWEEN ? AND ?), 0
        ) - COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'PURCHASE_RETURN' AND status = 'POSTED' AND voucher_date BETWEEN ? AND ?), 0
        ) as total
      `).get(companyId, fromDate, toDate, companyId, fromDate, toDate) as { total: number };

      const todayPurchases = db.prepare(`
        SELECT COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'PURCHASE' AND status = 'POSTED' AND voucher_date = ?), 0
        ) - COALESCE(
          (SELECT SUM(taxable_amount_paise) FROM vouchers WHERE company_id = ? AND voucher_type = 'PURCHASE_RETURN' AND status = 'POSTED' AND voucher_date = ?), 0
        ) as total
      `).get(companyId, today, companyId, today) as { total: number };

      // 4. Receivables (Sundry Debtors) with opening balances
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

      // 5. Payables (Sundry Creditors) with opening balances
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

      // 6. Cash and Bank Balances
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

      // 7. Stock Valuation
      const stockSummary = ReportEngine.getStockSummary(db, companyId);
      const totalStockValPaise = stockSummary.reduce((sum, item) => sum + item.totalValuePaise, 0);

      const recentVouchers = db.prepare(`
        SELECT v.voucher_id, v.voucher_number, v.voucher_type, v.voucher_date, v.total_amount_paise, p.party_name
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ? AND v.status = 'POSTED'
        ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 5
      `).all(companyId);

      const stockAlerts = stockSummary
        .filter(item => (item.reorderLevel > 0 && item.quantity <= item.reorderLevel) || item.quantity <= 0)
        .slice(0, 5)
        .map(item => ({
          name: item.itemName,
          qty: `${item.quantity} Units`,
          status: item.quantity <= 0 ? 'critical' : 'warning'
        }));

      // 8. Monthly Trend Data strictly aggregated from saved posted transactions
      // For Financial Year overview, query spans the whole financial year and includes all 12 months (even with 0 activity)
      const trendQueryFrom = isFyScope ? fromDate : (periodParam === 'Single Day' ? `${fyStartYear}-04-01` : fromDate);
      const trendQueryTo = isFyScope ? toDate : (periodParam === 'Single Day' ? `${fyStartYear + 1}-03-31` : toDate);

      const rawTrend = db.prepare(`
        SELECT
          substr(voucher_date, 1, 7) as month,
          voucher_type,
          COALESCE(SUM(taxable_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND status = 'POSTED'
          AND voucher_type IN ('SALES', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN')
          AND voucher_date BETWEEN ? AND ?
        GROUP BY substr(voucher_date, 1, 7), voucher_type
        ORDER BY month ASC
      `).all(companyId, trendQueryFrom, trendQueryTo) as { month: string; voucher_type: string; total: number }[];

      const trendMap = new Map<string, { salesPaise: number; purchasePaise: number }>();

      // Seed all 12 financial-year months (Apr-Mar) for FY / Single Day mode
      if (isFyScope || periodParam === 'Financial Year' || periodParam === 'This FY' || periodParam === 'Single Day') {
        for (let m = 4; m <= 12; m++) {
          const mStr = `${fyStartYear}-${String(m).padStart(2, '0')}`;
          trendMap.set(mStr, { salesPaise: 0, purchasePaise: 0 });
        }
        for (let m = 1; m <= 3; m++) {
          const mStr = `${fyStartYear + 1}-${String(m).padStart(2, '0')}`;
          trendMap.set(mStr, { salesPaise: 0, purchasePaise: 0 });
        }
      }

      for (const row of rawTrend) {
        const cur = trendMap.get(row.month) || { salesPaise: 0, purchasePaise: 0 };
        if (row.voucher_type === 'SALES') cur.salesPaise += row.total;
        if (row.voucher_type === 'SALES_RETURN') cur.salesPaise -= row.total;
        if (row.voucher_type === 'PURCHASE') cur.purchasePaise += row.total;
        if (row.voucher_type === 'PURCHASE_RETURN') cur.purchasePaise -= row.total;
        trendMap.set(row.month, cur);
      }

      let trendEntries = Array.from(trendMap.entries());
      if (isFyScope || periodParam === 'Financial Year' || periodParam === 'This FY' || periodParam === 'Single Day') {
        const fyOrder = [
          `${fyStartYear}-04`, `${fyStartYear}-05`, `${fyStartYear}-06`,
          `${fyStartYear}-07`, `${fyStartYear}-08`, `${fyStartYear}-09`,
          `${fyStartYear}-10`, `${fyStartYear}-11`, `${fyStartYear}-12`,
          `${fyStartYear + 1}-01`, `${fyStartYear + 1}-02`, `${fyStartYear + 1}-03`
        ];
        trendEntries.sort((a, b) => fyOrder.indexOf(a[0]) - fyOrder.indexOf(b[0]));
      } else {
        trendEntries.sort((a, b) => a[0].localeCompare(b[0]));
      }

      const trendData = trendEntries.map(([month, vals]) => ({
        month,
        salesPaise: Math.max(0, vals.salesPaise),
        purchasePaise: Math.max(0, vals.purchasePaise),
        // For backwards compatibility with consumers expecting voucher_type / total rows
        total: Math.max(0, vals.salesPaise),
        voucher_type: 'SALES'
      }));

      // 9. Explainable Business Health metrics
      const recBal = Math.max(0, receivables.balance);
      const payBal = Math.max(0, payables.balance);
      const liquidFunds = cashBank.balance + recBal;
      const hasActivity = periodSales.total > 0 || periodPurchases.total > 0 || recBal > 0 || payBal > 0;

      let healthScore: number | null = null;
      let healthStatusText = 'No Activity';
      let healthDescText = 'No transactions recorded for the selected period.';

      if (hasActivity) {
        if (payBal === 0) {
          healthScore = 100;
          healthStatusText = 'Excellent (Debt Free)';
          healthDescText = 'Zero outstanding payables. Business operating with positive cash flow.';
        } else {
          const quickRatio = liquidFunds / payBal;
          if (quickRatio >= 1.5) {
            healthScore = 95;
            healthStatusText = 'Strong Solvency';
            healthDescText = `Liquid assets cover ${quickRatio.toFixed(1)}x current payables (benchmark >= 1.5x).`;
          } else if (quickRatio >= 1.0) {
            healthScore = 80;
            healthStatusText = 'Adequate Liquidity';
            healthDescText = `Liquid assets adequately match short-term obligations (${quickRatio.toFixed(1)}x coverage).`;
          } else if (quickRatio >= 0.5) {
            healthScore = 60;
            healthStatusText = 'Moderate Working Capital';
            healthDescText = `Payables exceed immediately available liquid funds (${quickRatio.toFixed(1)}x coverage).`;
          } else {
            healthScore = 40;
            healthStatusText = 'Liquidity Attention Needed';
            healthDescText = `Payables significantly exceed liquid reserves (${quickRatio.toFixed(1)}x coverage).`;
          }
        }
      }

      res.json({
        totalSalesPaise: Math.max(0, periodSales.total),
        totalPurchasesPaise: Math.max(0, periodPurchases.total),
        todaySalesPaise: Math.max(0, todaySales.total),
        todayPurchasesPaise: Math.max(0, todayPurchases.total),
        receivablesPaise: recBal,
        payablesPaise: payBal,
        cashBankPaise: cashBank.balance,
        stockValuePaise: totalStockValPaise,
        stockAlerts,
        trendData,
        recentVouchers,
        period: periodParam,
        fromDate,
        toDate,
        businessHealth: {
          score: healthScore,
          statusText: healthStatusText,
          descText: healthDescText,
          quickRatio: payBal > 0 ? liquidFunds / payBal : null
        }
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
