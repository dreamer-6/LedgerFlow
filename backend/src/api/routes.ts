import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PostingEngine } from '../domain/posting/posting-engine.js';
import { ReportEngine } from '../reports/report-engine.js';
import { GstEngine } from '../domain/tax/gst-engine.js';
import { InventoryEngine } from '../domain/inventory/valuation.js';
import { initializeBusiness } from '../database/seed.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';

// Helper: Extract authenticated user from Authorization header
export function getUserFromToken(req: Request): any | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Helper: Resolve active company ID for multi-tenant isolation
export function resolveCompanyId(req: Request, db: DatabaseSync, user?: any): string {
  const headerId = req.headers['x-company-id'] as string;
  const queryId = req.query.companyId as string;
  const requested = headerId || queryId;

  if (user?.userId) {
    if (requested) {
      const access = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? AND company_id = ?').get(user.userId, requested) as any;
      if (access) return access.company_id;
    }
    const first = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(user.userId) as any;
    if (first) return first.company_id;
  }

  if (requested) {
    const exists = db.prepare('SELECT company_id FROM companies WHERE company_id = ?').get(requested) as any;
    if (exists) return exists.company_id;
  }

  const def = db.prepare('SELECT company_id FROM companies ORDER BY created_at ASC LIMIT 1').get() as any;
  return def?.company_id || 'comp_default_01';
}

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();

  // ---------------- AUTHENTICATION & MULTI-TENANCY ----------------

  // Sign Up / Register new SaaS account with first business
  router.post('/auth/register', (req: Request, res: Response) => {
    try {
      const { email, password, fullName, businessName, gstin, state, stateCode } = req.body;

      if (!email || !password || !fullName || !businessName) {
        return res.status(400).json({ error: 'Email, password, full name, and business name are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
        .get(cleanEmail, cleanEmail) as any;

      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
      }

      const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      // 1. Create User
      db.prepare(`
        INSERT INTO users (user_id, username, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?, 'ADMIN')
      `).run(userId, cleanEmail, cleanEmail, passwordHash, fullName.trim());

      // 2. Provision Isolated Business
      const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      initializeBusiness(db, {
        companyId,
        companyName: businessName.trim(),
        gstin: gstin ? gstin.trim() : '',
        state: state || 'Tamil Nadu',
        stateCode: stateCode || '33',
        ownerUserId: userId
      });

      const token = jwt.sign(
        { userId, username: cleanEmail, role: 'ADMIN', name: fullName.trim(), email: cleanEmail },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      const businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(userId);

      res.status(201).json({
        token,
        user: {
          userId,
          email: cleanEmail,
          fullName: fullName.trim(),
          role: 'ADMIN'
        },
        activeCompanyId: companyId,
        businesses
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Login to SaaS account
  router.post('/auth/login', (req: Request, res: Response) => {
    try {
      const { username, email, emailOrUsername, password } = req.body;
      const identifier = (emailOrUsername || email || username || '').trim().toLowerCase();

      if (!identifier || !password) {
        return res.status(400).json({ error: 'Email/username and password are required.' });
      }

      const user = db.prepare(`
        SELECT user_id, username, email, password_hash, full_name, role
        FROM users
        WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND is_active = 1
      `).get(identifier, identifier) as any;

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      let businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.user_id) as any[];

      // If user has no businesses linked yet, link to first company or create one
      if (businesses.length === 0) {
        const defCompany = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
        if (defCompany) {
          db.prepare('INSERT OR IGNORE INTO user_businesses (user_id, company_id, role) VALUES (?, ?, ?)')
            .run(user.user_id, defCompany.company_id, 'OWNER');
          businesses = [{ ...defCompany, role: 'OWNER' }];
        }
      }

      res.json({
        token,
        user: {
          userId: user.user_id,
          email: user.email || user.username,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        },
        activeCompanyId: businesses[0]?.company_id || null,
        businesses
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Current User & Accessible Businesses
  router.get('/auth/me', (req: Request, res: Response) => {
    const user = getUserFromToken(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const dbUser = db.prepare('SELECT user_id, username, email, full_name, role FROM users WHERE user_id = ?').get(user.userId) as any;
      const businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.userId);

      res.json({
        user: dbUser || user,
        businesses
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- BUSINESSES (TENANTS) ----------------

  // List all businesses for current user
  router.get('/businesses', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      let businesses: any[];
      if (user?.userId) {
        businesses = db.prepare(`
          SELECT c.*, ub.role
          FROM companies c
          JOIN user_businesses ub ON c.company_id = ub.company_id
          WHERE ub.user_id = ?
          ORDER BY c.created_at ASC
        `).all(user.userId);
      } else {
        businesses = db.prepare('SELECT * FROM companies ORDER BY created_at ASC').all();
      }
      res.json(businesses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create an additional isolated business for current user
  router.post('/businesses', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      if (!user?.userId) {
        return res.status(401).json({ error: 'Authentication required to create a new business.' });
      }

      const { companyName, legalName, gstin, state, stateCode } = req.body;
      if (!companyName || !companyName.trim()) {
        return res.status(400).json({ error: 'Business name is required.' });
      }

      const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      initializeBusiness(db, {
        companyId,
        companyName: companyName.trim(),
        legalName: (legalName || companyName).trim(),
        gstin: gstin ? gstin.trim() : '',
        state: state || 'Tamil Nadu',
        stateCode: stateCode || '33',
        ownerUserId: user.userId
      });

      const newCompany = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
      res.status(201).json({
        company: newCompany,
        message: 'Business created and isolated accounting initialized successfully.'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- COMPANY & FINANCIAL YEARS ----------------
  router.get('/companies/current', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const company = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
      const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId);
      res.json({ company, activeFinancialYear: activeFy });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/companies/current', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const b = req.body;
      const targetId = b.company_id || companyId;

      db.prepare(`
        UPDATE companies SET
          company_name = ?, legal_name = ?, gstin = ?, pan = ?,
          address_line1 = ?, address_line2 = ?, city = ?, state = ?, state_code = ?, pincode = ?,
          phone = ?, email = ?, bank_name = ?, bank_account_no = ?, bank_ifsc = ?, bank_branch = ?,
          terms_and_conditions = ?
        WHERE company_id = ?
      `).run(
        b.company_name, b.legal_name, b.gstin, b.pan,
        b.address_line1, b.address_line2, b.city, b.state, b.state_code, b.pincode,
        b.phone, b.email, b.bank_name, b.bank_account_no, b.bank_ifsc, b.bank_branch,
        b.terms_and_conditions, targetId
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/financial-years', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const rows = db.prepare('SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- MASTERS (TENANT ISOLATED) ----------------
  router.get('/masters/ledgers', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
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

  router.post('/masters/ledgers', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
      const { groupId, ledgerName, code, openingBalancePaise, openingBalanceType } = req.body;
      const ledgerId = 'led_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ledgerId, targetCompanyId, groupId, ledgerName, code || null, openingBalancePaise || 0, openingBalanceType || 'DR');

      res.status(201).json({ ledgerId, ledgerName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/groups', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const rows = db.prepare('SELECT * FROM ledger_groups WHERE company_id = ? OR company_id IS NULL ORDER BY group_name ASC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/parties', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
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
      const params: any[] = [companyId];
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

  router.post('/masters/parties', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
      const {
        partyName, partyType, gstin, pan, phone, email, contactPerson, bankName,
        addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise
      } = req.body;

      if (!partyName || !partyName.trim()) {
        return res.status(400).json({ error: 'Party Name is required.' });
      }

      // Extract PAN from GSTIN if not provided
      let derivedPan = pan;
      if (!derivedPan && gstin && gstin.length === 15) {
        derivedPan = gstin.substring(2, 12);
      }

      db.exec('BEGIN TRANSACTION;');
      const partyId = 'party_' + Date.now().toString(36);
      const ledgerId = 'led_pty_' + Date.now().toString(36);

      // Find appropriate group for this company
      const groupSearch = partyType === 'SUPPLIER' ? '%Creditor%' : '%Debtor%';
      const foundGroup = db.prepare('SELECT group_id FROM ledger_groups WHERE (company_id = ? OR company_id IS NULL) AND group_name LIKE ? LIMIT 1')
        .get(targetCompanyId, groupSearch) as { group_id: string } | undefined;
      const groupId = foundGroup?.group_id || (partyType === 'SUPPLIER' ? `${targetCompanyId}_grp_creditors` : `${targetCompanyId}_grp_debtors`);
      const balType = partyType === 'SUPPLIER' ? 'CR' : 'DR';

      // 1. Create Ledger for party
      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(ledgerId, targetCompanyId, groupId, partyName.trim(), openingBalancePaise || 0, balType);

      // 2. Create Party
      db.prepare(`
        INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person, bank_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(partyId, targetCompanyId, ledgerId, partyType, partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null, bankName || null);

      // 3. Create Address
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

  router.put('/masters/parties/:id', (req: Request, res: Response) => {
    try {
      const partyId = req.params.id;
      const {
        partyName, partyType, gstin, pan, phone, email, contactPerson, bankName,
        addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise
      } = req.body;

      const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId) as any;
      if (!party) {
        return res.status(404).json({ error: 'Party not found.' });
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
          bank_name = ?
        WHERE party_id = ?
      `).run(
        partyName ? partyName.trim() : null,
        partyType || null,
        gstin || null,
        pan || null,
        phone || null,
        email || null,
        contactPerson || null,
        bankName || null,
        partyId
      );

      if (partyName && party.ledger_id) {
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

  router.delete('/masters/parties/:id', (req: Request, res: Response) => {
    try {
      const partyId = req.params.id;
      const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId) as any;
      if (!party) {
        return res.status(404).json({ error: 'Party not found.' });
      }

      const voucherCount = (db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE party_id = ?').get(partyId) as any)?.cnt || 0;
      if (voucherCount > 0) {
        return res.status(400).json({ error: `Cannot delete party '${party.party_name}' because they have ${voucherCount} recorded voucher(s).` });
      }

      db.exec('BEGIN TRANSACTION;');
      db.prepare('DELETE FROM party_addresses WHERE party_id = ?').run(partyId);
      db.prepare('DELETE FROM parties WHERE party_id = ?').run(partyId);
      if (party.ledger_id) {
        const leCount = (db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE ledger_id = ?').get(party.ledger_id) as any)?.cnt || 0;
        if (leCount === 0) {
          db.prepare('DELETE FROM ledgers WHERE ledger_id = ?').run(party.ledger_id);
        }
      }
      db.exec('COMMIT;');

      res.json({ success: true, message: 'Party deleted successfully.' });
    } catch (err: any) {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/items', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const rows = db.prepare(`
        SELECT si.*, u.symbol as unit_symbol
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.company_id = ? AND si.is_active = 1
        ORDER BY si.item_name ASC
      `).all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/items', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
      const b = req.body;
      if (!b.itemName || !b.itemName.trim()) {
        return res.status(400).json({ error: 'Item name is required.' });
      }

      const existing = db.prepare('SELECT item_id, item_name FROM stock_items WHERE company_id = ? AND LOWER(item_name) = LOWER(?)')
        .get(targetCompanyId, b.itemName.trim()) as { item_id: string; item_name: string } | undefined;

      if (existing) {
        return res.status(400).json({
          error: `A stock item named '${b.itemName}' already exists. To increase or add stock quantity, record a Purchase Voucher (Alt+V -> Purchase) or edit the existing item.`
        });
      }

      // Resolve default unit and godown for this company if needed
      let unitId = b.unitId;
      if (!unitId || unitId === 'unit_nos') {
        const defUnit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(targetCompanyId) as any;
        unitId = defUnit?.unit_id || b.unitId || 'unit_nos';
      }

      let godownId = b.godownId;
      if (!godownId || godownId === 'godown_main') {
        const defGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(targetCompanyId) as any;
        godownId = defGodown?.godown_id || 'godown_main';
      }

      const itemId = 'item_' + Date.now().toString(36);
      db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, targetCompanyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '9999',
        unitId, b.gstRate || 18, b.cessRate || 0,
        b.purchaseRatePaise || 0, b.sellingRatePaise || 0,
        b.openingQty || 0, b.openingRatePaise || 0, b.reorderLevel || 0
      );

      // If opening stock provided, record initial stock entry
      if (b.openingQty > 0) {
        const openingVal = Math.round(b.openingQty * (b.openingRatePaise || 0));
        db.prepare(`
          INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
          VALUES (?, 'vch_opening', ?, ?, '2026-04-01', 'IN', ?, ?, ?)
        `).run('se_opn_' + itemId, itemId, godownId, b.openingQty, b.openingRatePaise || 0, openingVal);
      }

      res.status(201).json({ itemId, itemName: b.itemName });
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({
          error: `A stock item named '${req.body?.itemName}' already exists. Please choose a distinct name or edit the existing item.`
        });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/masters/items/:id', (req: Request, res: Response) => {
    try {
      const b = req.body;
      db.prepare(`
        UPDATE stock_items SET
          item_name = ?, item_code = ?, sku = ?, hsn_sac = ?,
          unit_id = ?, gst_rate = ?, cess_rate = ?,
          purchase_rate_paise = ?, selling_rate_paise = ?,
          reorder_level = ?
        WHERE item_id = ?
      `).run(
        b.itemName, b.itemCode || null, b.sku || null, b.hsnSac || '9999',
        b.unitId || 'unit_nos', b.gstRate || 18, b.cessRate || 0,
        b.purchaseRatePaise || 0, b.sellingRatePaise || 0,
        b.reorderLevel || 0,
        req.params.id
      );
      res.json({ success: true, message: 'Stock item updated successfully.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/masters/items/:id', (req: Request, res: Response) => {
    try {
      const itemId = req.params.id;
      // Check if item has existing voucher line references
      const lineCount = (db.prepare('SELECT COUNT(*) as cnt FROM voucher_lines WHERE item_id = ?').get(itemId) as any)?.cnt || 0;
      if (lineCount > 0) {
        // Soft delete / deactivate
        db.prepare('UPDATE stock_items SET is_active = 0 WHERE item_id = ?').run(itemId);
      } else {
        // Safe hard delete
        db.prepare('DELETE FROM stock_entries WHERE item_id = ?').run(itemId);
        db.prepare('DELETE FROM stock_items WHERE item_id = ?').run(itemId);
      }
      res.json({ success: true, message: 'Stock item removed successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/godowns', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const rows = db.prepare('SELECT * FROM godowns WHERE company_id = ? OR company_id IS NULL ORDER BY godown_name ASC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/units', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, db, user);
      const rows = db.prepare('SELECT * FROM units WHERE company_id = ? OR company_id IS NULL ORDER BY unit_name ASC').all(companyId);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- VOUCHER OPERATIONS ----------------
  router.get('/vouchers/next-number', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { fyId, type } = req.query as { fyId: string; type: string };
      const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, type);
      res.json({ nextVoucherNumber: nextNum });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vouchers', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { type, fromDate, toDate } = req.query as any;
      let query = `
        SELECT v.*, p.party_name
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ?
      `;
      const params: any[] = [companyId];
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

  router.get('/vouchers/:id', (req: Request, res: Response) => {
    try {
      const voucher = db.prepare(`
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.phone as party_phone,
               pa.address_line1, pa.city, pa.state, pa.state_code, pa.pincode
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE v.voucher_id = ?
      `).get(req.params.id) as any;

      if (!voucher) return res.status(404).json({ error: 'Voucher not found' });

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

  router.post('/vouchers', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
      const payload = { ...req.body, companyId: targetCompanyId };
      const result = PostingEngine.postVoucher(db, payload);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/vouchers/:id/cancel', (req: Request, res: Response) => {
    try {
      const { cancelledBy, reason } = req.body;
      PostingEngine.cancelVoucher(db, req.params.id, cancelledBy || 'admin', reason || 'Cancelled by user');
      res.json({ success: true, message: 'Voucher cancelled and accounting effects reversed.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ---------------- REPORTS ----------------
  router.get('/reports/dashboard', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const today = new Date().toISOString().split('T')[0];

      // Today Sales
      const todaySales = db.prepare(`
        SELECT COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND voucher_type = 'SALES' AND voucher_date = ? AND status = 'POSTED'
      `).get(companyId, today) as { total: number };

      // Total Receivables
      const receivables = db.prepare(`
        SELECT COALESCE(SUM(le.debit_paise - le.credit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%debtor%' OR g.group_name LIKE '%Debtor%')
      `).get(companyId) as { balance: number };

      // Total Payables
      const payables = db.prepare(`
        SELECT COALESCE(SUM(le.credit_paise - le.debit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%creditor%' OR g.group_name LIKE '%Creditor%')
      `).get(companyId) as { balance: number };

      // Cash & Bank
      const cashBank = db.prepare(`
        SELECT COALESCE(SUM(le.debit_paise - le.credit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%cash%' OR l.group_id LIKE '%bank%' OR g.group_name LIKE '%Cash%' OR g.group_name LIKE '%Bank%')
      `).get(companyId) as { balance: number };

      // Stock Value
      const stockSummary = ReportEngine.getStockSummary(db, companyId);
      const totalStockValPaise = stockSummary.reduce((sum, item) => sum + item.totalValuePaise, 0);

      // Recent 5 Vouchers
      const recentVouchers = db.prepare(`
        SELECT v.voucher_id, v.voucher_number, v.voucher_type, v.voucher_date, v.total_amount_paise, p.party_name
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ? AND v.status = 'POSTED'
        ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 5
      `).all(companyId);

      // Stock Alerts (Items where current stock <= reorder_level)
      const stockAlerts = stockSummary
        .filter((item: any) => item.currentStock <= (item.reorderLevel ?? 5))
        .slice(0, 5)
        .map((item: any) => ({
          name: item.itemName,
          qty: `${item.currentStock} Units`,
          status: item.currentStock === 0 ? 'critical' : 'warning'
        }));

      // Monthly Trend (Actual posted vouchers)
      const trendData = db.prepare(`
        SELECT 
          substr(voucher_date, 1, 7) as month,
          voucher_type,
          COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND status = 'POSTED' AND voucher_type IN ('SALES', 'PURCHASE')
        GROUP BY substr(voucher_date, 1, 7), voucher_type
      `).all(companyId) as { month: string; voucher_type: string; total: number }[];

      res.json({
        todaySalesPaise: todaySales.total,
        receivablesPaise: Math.max(0, receivables.balance),
        payablesPaise: Math.max(0, payables.balance),
        cashBankPaise: Math.max(0, cashBank.balance),
        stockValuePaise: totalStockValPaise,
        stockAlerts,
        trendData,
        recentVouchers
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/daybook', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { fromDate, toDate } = req.query as any;
      const data = ReportEngine.getDayBook(db, companyId, fromDate, toDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/ledger/:id', (req: Request, res: Response) => {
    try {
      const { fromDate, toDate } = req.query as any;
      const data = ReportEngine.getLedgerStatement(db, req.params.id, fromDate, toDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/trial-balance', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { asOnDate } = req.query as any;
      const data = ReportEngine.getTrialBalance(db, companyId, asOnDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/profit-loss', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { fromDate, toDate } = req.query as any;
      const data = ReportEngine.getProfitAndLoss(db, companyId, fromDate, toDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/balance-sheet', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { asOnDate } = req.query as any;
      const data = ReportEngine.getBalanceSheet(db, companyId, asOnDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/stock-summary', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const data = ReportEngine.getStockSummary(db, companyId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/outstanding', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { type } = req.query as any;
      const data = ReportEngine.getOutstandingReport(db, companyId, type || 'CUSTOMER');
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/gst-summary', (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = (req.query.companyId as string) || resolveCompanyId(req, db, user);
      const { fromDate, toDate } = req.query as any;
      const data = ReportEngine.getGstSummary(db, companyId, fromDate, toDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- UTILITIES (BACKUP & AUDIT) ----------------
  router.post('/utilities/backup', (req: Request, res: Response) => {
    try {
      const backupDir = './data/backups';
      const fs = require('node:fs');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = `${backupDir}/ledgerflow_backup_${timestamp}.db`;

      // SQLite vacuum into safe online backup
      db.exec(`VACUUM INTO '${backupFile}';`);
      res.json({ success: true, backupFile });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/utilities/audit-logs', (req: Request, res: Response) => {
    try {
      const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/utilities/reset-data', (req: Request, res: Response) => {
    try {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('DELETE FROM bill_allocations;');
      db.exec('DELETE FROM tax_entries;');
      db.exec('DELETE FROM stock_entries;');
      db.exec('DELETE FROM ledger_entries;');
      db.exec('DELETE FROM voucher_lines;');
      db.exec('DELETE FROM vouchers;');
      db.exec('DELETE FROM party_addresses;');
      db.exec('DELETE FROM parties;');
      db.exec('DELETE FROM stock_items;');
      db.exec('DELETE FROM ledgers WHERE is_party = 1;');
      db.exec('PRAGMA foreign_keys = ON;');

      res.json({
        success: true,
        message: 'All dummy transaction and master data wiped cleanly.',
        counts: {
          vouchers: (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c,
          parties: (db.prepare('SELECT COUNT(*) as c FROM parties').get() as any).c,
          stock_items: (db.prepare('SELECT COUNT(*) as c FROM stock_items').get() as any).c,
          ledger_entries: (db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c,
          core_ledgers: (db.prepare('SELECT COUNT(*) as c FROM ledgers').get() as any).c
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

