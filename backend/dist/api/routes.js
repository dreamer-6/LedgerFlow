"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFromToken = getUserFromToken;
exports.resolveCompanyId = resolveCompanyId;
exports.createApiRouter = createApiRouter;
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const posting_engine_js_1 = require("../domain/posting/posting-engine.js");
const report_engine_js_1 = require("../reports/report-engine.js");
const auth_controller_js_1 = require("../controllers/auth.controller.js");
const business_controller_js_1 = require("../controllers/business.controller.js");
const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';
// Helper: Extract authenticated user from Authorization header
function getUserFromToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
// Helper: Resolve active company ID for multi-tenant isolation
function resolveCompanyId(req, db, user) {
    const headerId = req.headers['x-company-id'];
    const queryId = req.query.companyId;
    const requested = headerId || queryId;
    if (user?.userId) {
        if (requested) {
            const access = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? AND company_id = ?').get(user.userId, requested);
            if (access)
                return access.company_id;
        }
        const first = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(user.userId);
        if (first)
            return first.company_id;
    }
    if (requested) {
        const exists = db.prepare('SELECT company_id FROM companies WHERE company_id = ?').get(requested);
        if (exists)
            return exists.company_id;
    }
    const def = db.prepare('SELECT company_id FROM companies ORDER BY created_at ASC LIMIT 1').get();
    return def?.company_id || '';
}
function createApiRouter(db) {
    const router = (0, express_1.Router)();
    // ---------------- AUTHENTICATION & MULTI-TENANCY ----------------
    const authController = new auth_controller_js_1.AuthController(db);
    router.post('/auth/register', authController.register);
    router.post('/auth/login', authController.login);
    router.get('/auth/me', authController.getMe);
    // ---------------- BUSINESSES (TENANTS) ----------------
    const businessController = new business_controller_js_1.BusinessController(db);
    router.get('/businesses', businessController.getBusinesses);
    router.post('/businesses', businessController.createBusiness);
    // ---------------- COMPANY & FINANCIAL YEARS ----------------
    router.get('/companies/current', businessController.getCurrentCompanyInfo);
    router.put('/companies/current', businessController.updateCurrentCompany);
    router.post('/companies/:id/delete', businessController.deleteCompany);
    router.get('/financial-years', businessController.getFinancialYears);
    router.post('/financial-years', businessController.createFinancialYear);
    router.put('/financial-years/:fyId', businessController.updateFinancialYearStatus);
    // ---------------- MASTERS (TENANT ISOLATED) ----------------
    router.get('/masters/ledgers', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare(`
        SELECT l.*, g.group_name, g.nature
        FROM ledgers l
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND l.is_active = 1
        ORDER BY l.ledger_name ASC
      `).all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/masters/ledgers', (req, res) => {
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/groups', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare('SELECT * FROM ledger_groups WHERE company_id = ? OR company_id IS NULL ORDER BY group_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/parties', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const type = req.query.type;
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
            const params = [companyId];
            if (type) {
                query += ` AND (p.party_type = ? OR p.party_type = 'BOTH')`;
                params.push(type);
            }
            query += ` ORDER BY p.party_name ASC`;
            const rows = db.prepare(query).all(...params);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/masters/parties', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
            const { partyName, partyType, gstin, pan, phone, email, contactPerson, bankingName, bankingAccountNo, bankingIfsc, addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise } = req.body;
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
                .get(targetCompanyId, groupSearch);
            const groupId = foundGroup?.group_id || (partyType === 'SUPPLIER' ? `${targetCompanyId}_grp_creditors` : `${targetCompanyId}_grp_debtors`);
            const balType = partyType === 'SUPPLIER' ? 'CR' : 'DR';
            // 1. Create Ledger for party
            db.prepare(`
        INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(ledgerId, targetCompanyId, groupId, partyName.trim(), openingBalancePaise || 0, balType);
            // 2. Create Party
            db.prepare(`
        INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person, banking_name, banking_account_no, banking_ifsc)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(partyId, targetCompanyId, ledgerId, partyType, partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null, bankingName || null, bankingAccountNo || null, bankingIfsc || null);
            // 3. Create Address
            db.prepare(`
        INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, address_line2, city, state, state_code, pincode, is_default)
        VALUES (?, ?, 'BOTH', ?, ?, ?, ?, ?, ?, 1)
      `).run('addr_' + Date.now().toString(36), partyId, addressLine1 || 'Main Business Address', addressLine2 || null, city || '', state || 'Tamil Nadu', stateCode || '33', pincode || '');
            db.exec('COMMIT;');
            res.status(201).json({ partyId, partyName: partyName.trim(), ledgerId });
        }
        catch (err) {
            db.exec('ROLLBACK;');
            res.status(500).json({ error: err.message });
        }
    });
    router.put('/masters/parties/:id', (req, res) => {
        try {
            const partyId = req.params.id;
            const { partyName, partyType, gstin, pan, phone, email, contactPerson, bankingName, bankingAccountNo, bankingIfsc, addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise } = req.body;
            const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId);
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
          banking_name = ?,
          banking_account_no = ?,
          banking_ifsc = ?
        WHERE party_id = ?
      `).run(partyName ? partyName.trim() : null, partyType || null, gstin || null, pan || null, phone || null, email || null, contactPerson || null, bankingName || null, bankingAccountNo || null, bankingIfsc || null, partyId);
            if (partyName && party.ledger_id) {
                db.prepare(`
          UPDATE ledgers SET
            ledger_name = ?,
            opening_balance_paise = COALESCE(?, opening_balance_paise)
          WHERE ledger_id = ?
        `).run(partyName.trim(), openingBalancePaise ?? null, party.ledger_id);
            }
            const existingAddr = db.prepare('SELECT address_id FROM party_addresses WHERE party_id = ? LIMIT 1').get(partyId);
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
        `).run(addressLine1 || null, addressLine2 || null, city || null, state || null, stateCode || null, pincode || null, existingAddr.address_id);
            }
            else if (addressLine1 || city || state) {
                db.prepare(`
          INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, address_line2, city, state, state_code, pincode, is_default)
          VALUES (?, ?, 'BOTH', ?, ?, ?, ?, ?, ?, 1)
        `).run('addr_' + Date.now().toString(36), partyId, addressLine1 || 'Main Business Address', addressLine2 || null, city || '', state || 'Tamil Nadu', stateCode || '33', pincode || '');
            }
            db.exec('COMMIT;');
            res.json({ success: true, message: 'Party updated successfully.' });
        }
        catch (err) {
            db.exec('ROLLBACK;');
            res.status(500).json({ error: err.message });
        }
    });
    router.delete('/masters/parties/:id', (req, res) => {
        try {
            const partyId = req.params.id;
            const party = db.prepare('SELECT * FROM parties WHERE party_id = ?').get(partyId);
            if (!party) {
                return res.status(404).json({ error: 'Party not found.' });
            }
            const voucherCount = db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE party_id = ?').get(partyId)?.cnt || 0;
            if (voucherCount > 0) {
                return res.status(400).json({ error: `Cannot delete party '${party.party_name}' because they have ${voucherCount} recorded voucher(s).` });
            }
            db.exec('BEGIN TRANSACTION;');
            db.prepare('DELETE FROM party_addresses WHERE party_id = ?').run(partyId);
            db.prepare('DELETE FROM parties WHERE party_id = ?').run(partyId);
            if (party.ledger_id) {
                const leCount = db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE ledger_id = ?').get(party.ledger_id)?.cnt || 0;
                if (leCount === 0) {
                    db.prepare('DELETE FROM ledgers WHERE ledger_id = ?').run(party.ledger_id);
                }
            }
            db.exec('COMMIT;');
            res.json({ success: true, message: 'Party deleted successfully.' });
        }
        catch (err) {
            db.exec('ROLLBACK;');
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/items', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare(`
        SELECT si.*, u.symbol as unit_symbol
        FROM stock_items si
        LEFT JOIN units u ON si.unit_id = u.unit_id
        WHERE si.company_id = ? AND si.is_active = 1
        ORDER BY si.item_name ASC
      `).all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/masters/items', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
            const b = req.body;
            if (!b.itemName || !b.itemName.trim()) {
                return res.status(400).json({ error: 'Item name is required.' });
            }
            // Check if an item with the same name or same SKU already exists
            const existing = db.prepare(`
        SELECT item_id, item_name, serial_numbers, purchase_rate_paise, selling_rate_paise
        FROM stock_items
        WHERE company_id = ? AND (LOWER(item_name) = LOWER(?) OR (sku IS NOT NULL AND sku != '' AND LOWER(sku) = LOWER(?)))
        LIMIT 1
      `).get(targetCompanyId, b.itemName.trim(), (b.sku || '').trim());
            // Resolve godown ID
            let godownId = b.godownId;
            if (!godownId || godownId === 'godown_main') {
                const defGodown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(targetCompanyId);
                godownId = defGodown?.godown_id || `${targetCompanyId}_godown_main`;
            }
            const qty = Number(b.quantityToAdd ?? b.openingQty ?? 0);
            const rate = Number(b.purchaseRatePaise ?? b.openingRatePaise ?? 0);
            const sellRate = Number(b.sellingRatePaise || 0);
            if (existing) {
                // ---------------- STOCK UPDATION (NO DUPLICATE) ----------------
                // Combine serial numbers if provided
                let updatedSerials = existing.serial_numbers || '';
                if (b.serialNumbers && b.serialNumbers.trim()) {
                    updatedSerials = updatedSerials
                        ? `${updatedSerials}, ${b.serialNumbers.trim()}`
                        : b.serialNumbers.trim();
                    const serialsArr = b.serialNumbers.split(',').map((s) => s.trim()).filter(Boolean);
                    for (const s of serialsArr) {
                        db.prepare('INSERT OR IGNORE INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, ?)')
                            .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6), existing.item_id, s, 'AVAILABLE');
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
        `).run(b.hsnSac || null, b.gstRate || null, rate, rate, sellRate, sellRate, b.reorderLevel || null, updatedSerials || null, b.hasSerialNo ? 1 : 0, b.serialNumbers || null, existing.item_id);
                // Record stock movement if quantity was added
                if (qty > 0) {
                    const valPaise = Math.round(qty * rate);
                    const entryId = 'se_upd_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
                    db.prepare(`
            INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
            VALUES (?, 'vch_stock_upd', ?, ?, ?, 'IN', ?, ?, ?)
          `).run(entryId, existing.item_id, godownId, new Date().toISOString().split('T')[0], qty, rate, valPaise);
                }
                return res.status(200).json({
                    itemId: existing.item_id,
                    itemName: existing.item_name,
                    updated: true,
                    message: `Stock updated successfully for '${existing.item_name}'. ${qty > 0 ? `Added ${qty} units.` : 'Details updated.'}`
                });
            }
            // ---------------- NEW STOCK ITEM CREATION ----------------
            let unitId = b.unitId;
            if (!unitId || unitId === 'unit_nos') {
                const defUnit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(targetCompanyId);
                unitId = defUnit?.unit_id || b.unitId || 'unit_nos';
            }
            const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            db.prepare(`
        INSERT INTO stock_items (
          item_id, company_id, item_name, item_code, sku, hsn_sac,
          unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
          opening_qty, opening_rate_paise, reorder_level, serial_numbers, has_serial_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, targetCompanyId, b.itemName.trim(), b.itemCode || null, b.sku || null, b.hsnSac || '9999', unitId, b.gstRate || 18, b.cessRate || 0, rate, sellRate, qty, rate, b.reorderLevel || 0, b.serialNumbers || null, b.hasSerialNo ? 1 : 0);
            // If initial stock provided, record initial stock entry
            if (qty > 0) {
                const openingVal = Math.round(qty * rate);
                db.prepare(`
          INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
          VALUES (?, 'vch_opening', ?, ?, ?, 'IN', ?, ?, ?)
        `).run('se_opn_' + itemId, itemId, godownId, new Date().toISOString().split('T')[0], qty, rate, openingVal);
            }
            // Add individual serials to the tracking table
            if (b.serialNumbers && b.serialNumbers.trim()) {
                const serialsArr = b.serialNumbers.split(',').map((s) => s.trim()).filter(Boolean);
                for (const s of serialsArr) {
                    db.prepare('INSERT OR IGNORE INTO stock_item_serials (serial_id, item_id, serial_number, status) VALUES (?, ?, ?, ?)')
                        .run('ser_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6), itemId, s, 'AVAILABLE');
                }
            }
            res.status(201).json({ itemId, itemName: b.itemName, updated: false, message: `Created stock item '${b.itemName}'.` });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/items/:id/serials', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare(`
        SELECT serial_number FROM stock_item_serials
        WHERE item_id = ? AND status = 'AVAILABLE'
      `).all(req.params.id);
            let list = rows.map((r) => r.serial_number);
            if (list.length === 0) {
                const it = db.prepare('SELECT serial_numbers FROM stock_items WHERE item_id = ?').get(req.params.id);
                if (it?.serial_numbers) {
                    const soldRows = db.prepare(`
            SELECT serial_number FROM stock_item_serials
            WHERE item_id = ? AND status = 'SOLD'
          `).all(req.params.id);
                    const soldSet = new Set(soldRows.map((r) => r.serial_number));
                    list = it.serial_numbers
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter((s) => Boolean(s) && !soldSet.has(s));
                }
            }
            res.json(list);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.put('/masters/items/:id', (req, res) => {
        try {
            const b = req.body;
            db.prepare(`
        UPDATE stock_items SET
          item_name = ?, item_code = ?, sku = ?, hsn_sac = ?,
          unit_id = ?, gst_rate = ?, cess_rate = ?,
          purchase_rate_paise = ?, selling_rate_paise = ?,
          reorder_level = ?
        WHERE item_id = ?
      `).run(b.itemName, b.itemCode || null, b.sku || null, b.hsnSac || '9999', b.unitId || 'unit_nos', b.gstRate || 18, b.cessRate || 0, b.purchaseRatePaise || 0, b.sellingRatePaise || 0, b.reorderLevel || 0, req.params.id);
            res.json({ success: true, message: 'Stock item updated successfully.' });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.delete('/masters/items/:id', (req, res) => {
        try {
            const itemId = req.params.id;
            // Check if item has existing voucher line references
            const lineCount = db.prepare('SELECT COUNT(*) as cnt FROM voucher_lines WHERE item_id = ?').get(itemId)?.cnt || 0;
            if (lineCount > 0) {
                // Soft delete / deactivate
                db.prepare('UPDATE stock_items SET is_active = 0 WHERE item_id = ?').run(itemId);
            }
            else {
                // Safe hard delete
                db.prepare('DELETE FROM stock_entries WHERE item_id = ?').run(itemId);
                db.prepare('DELETE FROM stock_items WHERE item_id = ?').run(itemId);
            }
            res.json({ success: true, message: 'Stock item removed successfully.' });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/godowns', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare('SELECT * FROM godowns WHERE company_id = ? OR company_id IS NULL ORDER BY godown_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/masters/units', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare('SELECT * FROM units WHERE company_id = ? OR company_id IS NULL ORDER BY unit_name ASC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ---------------- VOUCHER OPERATIONS ----------------
    router.get('/vouchers/next-number', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json({ nextVoucherNumber: '1' });
            const { fyId, type } = req.query;
            const nextNum = posting_engine_js_1.PostingEngine.getNextVoucherNumber(db, companyId, fyId, type);
            res.json({ nextVoucherNumber: nextNum });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/vouchers', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const { type, fromDate, toDate } = req.query;
            let query = `
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.party_type
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.company_id = ?
      `;
            const params = [companyId];
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/vouchers/:id', (req, res) => {
        try {
            const voucher = db.prepare(`
        SELECT v.*, p.party_name, p.gstin as party_gstin, p.phone as party_phone,
               pa.address_line1, pa.city, pa.state, pa.state_code, pa.pincode
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        LEFT JOIN party_addresses pa ON p.party_id = pa.party_id
        WHERE v.voucher_id = ?
      `).get(req.params.id);
            if (!voucher)
                return res.status(404).json({ error: 'Voucher not found' });
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/vouchers', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
            if (!targetCompanyId) {
                return res.status(400).json({ error: 'No company selected for voucher posting.' });
            }
            let fyId = req.body.fyId;
            const validFy = fyId ? db.prepare('SELECT fy_id FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, targetCompanyId) : null;
            if (!validFy) {
                const vDate = req.body.voucherDate || new Date().toISOString().split('T')[0];
                const dateFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND ? BETWEEN start_date AND end_date LIMIT 1').get(targetCompanyId, vDate);
                if (dateFy) {
                    fyId = dateFy.fy_id;
                }
                else {
                    const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(targetCompanyId);
                    fyId = activeFy?.fy_id;
                }
            }
            if (!fyId) {
                return res.status(400).json({ error: 'No open financial year found for this company and date.' });
            }
            const payload = { ...req.body, companyId: targetCompanyId, fyId };
            const result = posting_engine_js_1.PostingEngine.postVoucher(db, payload);
            res.status(201).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.get('/vouchers/:id', (req, res) => {
        try {
            const vch = db.prepare(`
        SELECT v.*, p.party_name 
        FROM vouchers v
        LEFT JOIN parties p ON v.party_id = p.party_id
        WHERE v.voucher_id = ?
      `).get(req.params.id);
            if (!vch)
                return res.status(404).json({ error: 'Voucher not found' });
            const lines = db.prepare('SELECT * FROM voucher_lines WHERE voucher_id = ? ORDER BY line_order ASC').all(req.params.id);
            res.json({ voucher: vch, lines });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.put('/vouchers/:id', (req, res) => {
        try {
            const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, getUserFromToken(req));
            const fyId = req.body.fyId;
            if (!fyId)
                return res.status(400).json({ error: 'Financial year ID is required for editing a voucher.' });
            // First, cancel the old voucher to reverse its effects.
            posting_engine_js_1.PostingEngine.cancelVoucher(db, req.params.id, 'admin', 'Edited by user');
            // We actually want to delete the cancelled voucher completely and reuse its ID if possible, 
            // but PostingEngine.postVoucher assigns a new ID. Instead of modifying PostingEngine, 
            // let's let PostingEngine create a new one, but we'll manually force the ID, or just return the new ID.
            // Wait, let's just let it post a new voucher and return the new ID. The frontend will redirect or update.
            const payload = { ...req.body, companyId: targetCompanyId, fyId };
            const result = posting_engine_js_1.PostingEngine.postVoucher(db, payload);
            // Update the new voucher to have the original ID or just return it.
            // To keep it simple, we just return the new voucher ID.
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.post('/vouchers/:id/cancel', (req, res) => {
        try {
            const { cancelledBy, reason } = req.body;
            posting_engine_js_1.PostingEngine.cancelVoucher(db, req.params.id, cancelledBy || 'admin', reason || 'Cancelled by user');
            res.json({ success: true, message: 'Voucher cancelled and accounting effects reversed.' });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    });
    router.delete('/vouchers/:id', (req, res) => {
        try {
            const vch = db.prepare('SELECT voucher_id, voucher_number, company_id FROM vouchers WHERE voucher_id = ?').get(req.params.id);
            if (!vch)
                return res.status(404).json({ error: 'Voucher not found' });
            db.exec('BEGIN TRANSACTION;');
            db.prepare('DELETE FROM ledger_entries WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare('DELETE FROM stock_entries WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare('DELETE FROM tax_entries WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare('DELETE FROM bill_allocations WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(vch.voucher_id);
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, 'DELETE_VOUCHER', 'VOUCHER', ?, ?)
      `).run('aud_' + Date.now().toString(36), vch.company_id, 'admin', vch.voucher_id, JSON.stringify({ voucherNumber: vch.voucher_number, reason: 'Deleted by user' }));
            db.exec('COMMIT;');
            res.json({ success: true, message: 'Voucher deleted successfully.' });
        }
        catch (err) {
            db.exec('ROLLBACK;');
            res.status(500).json({ error: err.message });
        }
    });
    // ---------------- REPORTS ----------------
    router.get('/reports/dashboard', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId) {
                return res.json({
                    todaySalesPaise: 0,
                    receivablesPaise: 0,
                    payablesPaise: 0,
                    cashBankPaise: 0,
                    stockValuePaise: 0,
                    stockAlerts: [],
                    trendData: [],
                    recentVouchers: []
                });
            }
            const today = new Date().toISOString().split('T')[0];
            // Today Sales
            const todaySales = db.prepare(`
        SELECT COALESCE(SUM(total_amount_paise), 0) as total
        FROM vouchers
        WHERE company_id = ? AND voucher_type = 'SALES' AND voucher_date = ? AND status = 'POSTED'
      `).get(companyId, today);
            // Total Receivables
            const receivables = db.prepare(`
        SELECT COALESCE(SUM(le.debit_paise - le.credit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%debtor%' OR g.group_name LIKE '%Debtor%')
      `).get(companyId);
            // Total Payables
            const payables = db.prepare(`
        SELECT COALESCE(SUM(le.credit_paise - le.debit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%creditor%' OR g.group_name LIKE '%Creditor%')
      `).get(companyId);
            // Cash & Bank
            const cashBank = db.prepare(`
        SELECT COALESCE(SUM(le.debit_paise - le.credit_paise), 0) as balance
        FROM ledger_entries le
        JOIN ledgers l ON le.ledger_id = l.ledger_id
        JOIN ledger_groups g ON l.group_id = g.group_id
        WHERE l.company_id = ? AND (l.group_id LIKE '%cash%' OR l.group_id LIKE '%bank%' OR g.group_name LIKE '%Cash%' OR g.group_name LIKE '%Bank%')
      `).get(companyId);
            // Stock Value
            const stockSummary = report_engine_js_1.ReportEngine.getStockSummary(db, companyId);
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
                .filter((item) => item.currentStock <= (item.reorderLevel ?? 5))
                .slice(0, 5)
                .map((item) => ({
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
      `).all(companyId);
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/daybook', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const { fromDate, toDate } = req.query;
            const today = new Date().toISOString().split('T')[0];
            const targetFrom = fromDate || '2000-01-01';
            const targetTo = toDate || today;
            const data = report_engine_js_1.ReportEngine.getDayBook(db, companyId, targetFrom, targetTo);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/ledger/:id', (req, res) => {
        try {
            const { fromDate, toDate } = req.query;
            const today = new Date().toISOString().split('T')[0];
            const targetFrom = fromDate || '2000-01-01';
            const targetTo = toDate || today;
            const data = report_engine_js_1.ReportEngine.getLedgerStatement(db, req.params.id, targetFrom, targetTo);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/trial-balance', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json({ asOnDate: '', rows: [], totalDebitPaise: 0, totalCreditPaise: 0, isBalanced: true });
            const { asOnDate } = req.query;
            const targetAsOn = asOnDate || new Date().toISOString().split('T')[0];
            const data = report_engine_js_1.ReportEngine.getTrialBalance(db, companyId, targetAsOn);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/profit-loss', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json({ fromDate: '', toDate: '', grossProfitPaise: 0, netProfitPaise: 0, tradingExpenseRows: [], tradingIncomeRows: [], pnlExpenseRows: [], pnlIncomeRows: [] });
            const { fromDate, toDate } = req.query;
            const today = new Date().toISOString().split('T')[0];
            const targetFrom = fromDate || '2000-01-01';
            const targetTo = toDate || today;
            const data = report_engine_js_1.ReportEngine.getProfitAndLoss(db, companyId, targetFrom, targetTo);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/balance-sheet', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json({ asOnDate: '', totalAssetsPaise: 0, totalLiabilitiesPaise: 0, isBalanced: true, assetRows: [], liabilityRows: [] });
            const { asOnDate } = req.query;
            const targetAsOn = asOnDate || new Date().toISOString().split('T')[0];
            const data = report_engine_js_1.ReportEngine.getBalanceSheet(db, companyId, targetAsOn);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/stock-summary', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const data = report_engine_js_1.ReportEngine.getStockSummary(db, companyId);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/outstanding', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const { type } = req.query;
            const data = report_engine_js_1.ReportEngine.getOutstandingReport(db, companyId, type || 'CUSTOMER');
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/dashboard', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json({ trendData: [], recentVouchers: [] });
            // Fetch recent vouchers
            const recentVouchers = db.prepare(`
        SELECT voucher_id, voucher_number, voucher_type, voucher_date, total_amount_paise 
        FROM vouchers 
        WHERE company_id = ? AND status = 'POSTED'
        ORDER BY created_at DESC LIMIT 5
      `).all(companyId);
            // Mock trend data for SVG (in a real app, this would aggregate sales/purchases by month)
            const trendData = [
                { label: 'Jan', sales: 4000000, purchases: 2000000 },
                { label: 'Feb', sales: 5000000, purchases: 3000000 },
                { label: 'Mar', sales: 4500000, purchases: 2500000 }
            ];
            res.json({ trendData, recentVouchers });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/reports/gst-summary', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = req.query.companyId || resolveCompanyId(req, db, user);
            if (!companyId) {
                return res.json({
                    fromDate: '',
                    toDate: '',
                    gstr1: {
                        totalInvoices: 0,
                        totalTaxablePaise: 0,
                        totalCgstPaise: 0,
                        totalSgstPaise: 0,
                        totalIgstPaise: 0,
                        totalTaxPaise: 0,
                        totalInvoiceValuePaise: 0,
                        b2b: [],
                        b2c: []
                    },
                    gstr3b: {
                        outwardTaxablePaise: 0,
                        outwardCgstPaise: 0,
                        outwardSgstPaise: 0,
                        outwardIgstPaise: 0,
                        itcCgstPaise: 0,
                        itcSgstPaise: 0,
                        itcIgstPaise: 0,
                        netCgstPayablePaise: 0,
                        netSgstPayablePaise: 0,
                        netIgstPayablePaise: 0
                    }
                });
            }
            const { fromDate, toDate } = req.query;
            const data = report_engine_js_1.ReportEngine.getGstSummary(db, companyId, fromDate, toDate);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ---------------- UTILITIES (BACKUP & AUDIT) ----------------
    router.post('/utilities/backup', (req, res) => {
        try {
            const backupDir = './data/backups';
            const fs = require('node:fs');
            if (!fs.existsSync(backupDir))
                fs.mkdirSync(backupDir, { recursive: true });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = `${backupDir}/ledgerflow_backup_${timestamp}.db`;
            // SQLite vacuum into safe online backup
            db.exec(`VACUUM INTO '${backupFile}';`);
            res.json({ success: true, backupFile });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/utilities/audit-logs', (req, res) => {
        try {
            const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100').all();
            res.json(logs);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/utilities/reset-data', (req, res) => {
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
                    vouchers: db.prepare('SELECT COUNT(*) as c FROM vouchers').get().c,
                    parties: db.prepare('SELECT COUNT(*) as c FROM parties').get().c,
                    stock_items: db.prepare('SELECT COUNT(*) as c FROM stock_items').get().c,
                    ledger_entries: db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get().c,
                    core_ledgers: db.prepare('SELECT COUNT(*) as c FROM ledgers').get().c
                }
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    return router;
}
