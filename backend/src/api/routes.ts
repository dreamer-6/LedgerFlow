import { Router, Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PostingEngine } from '../domain/posting/posting-engine.js';
import { ReportEngine } from '../reports/report-engine.js';
import { GstEngine } from '../domain/tax/gst-engine.js';
import { InventoryEngine } from '../domain/inventory/valuation.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';

export function createApiRouter(db: DatabaseSync): Router {
  const router = Router();

  // ---------------- AUTHENTICATION ----------------
  router.post('/auth/login', (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      const user = db.prepare('SELECT user_id, username, password_hash, full_name, role FROM users WHERE username = ? AND is_active = 1')
        .get(username) as any;

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const token = jwt.sign(
        { userId: user.user_id, username: user.username, role: user.role, name: user.full_name },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, JWT_SECRET);
      res.json({ user: decoded });
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  });

  // ---------------- COMPANY & FINANCIAL YEARS ----------------
  router.get('/companies/current', (req: Request, res: Response) => {
    try {
      const company = db.prepare('SELECT * FROM companies LIMIT 1').get();
      const activeFy = db.prepare("SELECT * FROM financial_years WHERE status = 'OPEN' LIMIT 1").get();
      res.json({ company, activeFinancialYear: activeFy });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/companies/current', (req: Request, res: Response) => {
    try {
      const b = req.body;
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
        b.terms_and_conditions, b.company_id
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/financial-years', (req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM financial_years ORDER BY start_date DESC').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- MASTERS ----------------
  router.get('/masters/ledgers', (req: Request, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT l.*, g.group_name, g.nature
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.is_active = 1
        ORDER BY l.ledger_name ASC
      `).all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/ledgers', (req: Request, res: Response) => {
    try {
      const { companyId, groupId, ledgerName, code, openingBalancePaise, openingBalanceType } = req.body;
      const ledgerId = 'led_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code, opening_balance_paise, opening_balance_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(ledgerId, companyId, groupId, ledgerName, code || null, openingBalancePaise || 0, openingBalanceType || 'DR');

      res.status(201).json({ ledgerId, ledgerName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/groups', (req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM ledger_groups ORDER BY group_name ASC').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/parties', (req: Request, res: Response) => {
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
      `;
      const params: any[] = [];
      if (type) {
        query += ` WHERE p.party_type = ? OR p.party_type = 'BOTH'`;
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
      const {
        companyId, partyName, partyType, gstin, pan, phone, email, contactPerson,
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
      const groupId = partyType === 'SUPPLIER' ? 'grp_creditors' : 'grp_debtors';
      const balType = partyType === 'SUPPLIER' ? 'CR' : 'DR';

      // 1. Create Ledger for party
      db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(ledgerId, companyId, groupId, partyName.trim(), openingBalancePaise || 0, balType);

      // 2. Create Party
      db.prepare(`
        INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(partyId, companyId, ledgerId, partyType, partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null);

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

  router.get('/masters/items', (req: Request, res: Response) => {
    try {
      const rows = db.prepare(`
        SELECT si.*, u.symbol as unit_symbol
        FROM stock_items si
        JOIN units u ON si.unit_id = u.unit_id
        WHERE si.is_active = 1
        ORDER BY si.item_name ASC
      `).all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/masters/items', (req: Request, res: Response) => {
    try {
      const b = req.body;
      if (!b.itemName || !b.itemName.trim()) {
        return res.status(400).json({ error: 'Item name is required.' });
      }

      const existing = db.prepare('SELECT item_id, item_name FROM stock_items WHERE company_id = ? AND LOWER(item_name) = LOWER(?)')
        .get(b.companyId, b.itemName.trim()) as { item_id: string; item_name: string } | undefined;

      if (existing) {
        return res.status(400).json({
          error: `A stock item named '${b.itemName}' already exists. To increase or add stock quantity, record a Purchase Voucher (Alt+V -> Purchase) or edit the existing item.`
        });
      }

      const itemId = 'item_' + Date.now().toString(36);
      db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        itemId, b.companyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '9999',
        b.unitId || 'unit_nos', b.gstRate || 18, b.cessRate || 0,
        b.purchaseRatePaise || 0, b.sellingRatePaise || 0,
        b.openingQty || 0, b.openingRatePaise || 0, b.reorderLevel || 0
      );

      // If opening stock provided, record initial stock entry
      if (b.openingQty > 0) {
        const openingVal = Math.round(b.openingQty * (b.openingRatePaise || 0));
        db.prepare(`
          INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
          VALUES (?, 'vch_opening', ?, 'godown_main', '2026-04-01', 'IN', ?, ?, ?)
        `).run('se_opn_' + itemId, itemId, b.openingQty, b.openingRatePaise || 0, openingVal);
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

  router.get('/masters/godowns', (req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM godowns').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/masters/units', (req: Request, res: Response) => {
    try {
      const rows = db.prepare('SELECT * FROM units').all();
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ---------------- VOUCHER OPERATIONS ----------------
  router.get('/vouchers/next-number', (req: Request, res: Response) => {
    try {
      const { companyId, fyId, type } = req.query as { companyId: string; fyId: string; type: string };
      const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, type);
      res.json({ nextVoucherNumber: nextNum });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vouchers', (req: Request, res: Response) => {
    try {
      const { companyId, type, fromDate, toDate } = req.query as any;
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
      const result = PostingEngine.postVoucher(db, req.body);
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
      const { companyId } = req.query as { companyId: string };
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
        WHERE l.company_id = ? AND l.group_id = 'grp_debtors'
      `).get(companyId) as { balance: number };

      // Total Payables
      const payables = db.prepare(`
        SELECT COALESCE(SUM(le.credit_paise - le.debit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        WHERE l.company_id = ? AND l.group_id = 'grp_creditors'
      `).get(companyId) as { balance: number };

      // Cash & Bank
      const cashBank = db.prepare(`
        SELECT COALESCE(SUM(le.debit_paise - le.credit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        WHERE l.company_id = ? AND l.group_id IN ('grp_cash', 'grp_bank')
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

      res.json({
        todaySalesPaise: todaySales.total,
        receivablesPaise: Math.max(0, receivables.balance),
        payablesPaise: Math.max(0, payables.balance),
        cashBankPaise: Math.max(0, cashBank.balance),
        stockValuePaise: totalStockValPaise,
        recentVouchers
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/daybook', (req: Request, res: Response) => {
    try {
      const { companyId, fromDate, toDate } = req.query as any;
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
      const { companyId, asOnDate } = req.query as any;
      const data = ReportEngine.getTrialBalance(db, companyId, asOnDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/profit-loss', (req: Request, res: Response) => {
    try {
      const { companyId, fromDate, toDate } = req.query as any;
      const data = ReportEngine.getProfitAndLoss(db, companyId, fromDate, toDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/balance-sheet', (req: Request, res: Response) => {
    try {
      const { companyId, asOnDate } = req.query as any;
      const data = ReportEngine.getBalanceSheet(db, companyId, asOnDate);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/stock-summary', (req: Request, res: Response) => {
    try {
      const { companyId } = req.query as any;
      const data = ReportEngine.getStockSummary(db, companyId);
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/outstanding', (req: Request, res: Response) => {
    try {
      const { companyId, type } = req.query as any;
      const data = ReportEngine.getOutstandingReport(db, companyId, type || 'CUSTOMER');
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/reports/gst-summary', (req: Request, res: Response) => {
    try {
      const { companyId, fromDate, toDate } = req.query as any;
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

  return router;
}
