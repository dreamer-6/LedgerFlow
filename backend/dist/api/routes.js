"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFromToken = getUserFromToken;
exports.resolveCompanyId = resolveCompanyId;
exports.createApiRouter = createApiRouter;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const posting_engine_js_1 = require("../domain/posting/posting-engine.js");
const report_engine_js_1 = require("../reports/report-engine.js");
const seed_js_1 = require("../database/seed.js");
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
    // Sign Up / Register new SaaS account with first business
    router.post('/auth/register', (req, res) => {
        try {
            const { email, password, fullName, businessName, companyName, legalName, gstin, state, stateCode } = req.body;
            const finalBusinessName = (businessName || companyName || '').trim();
            if (!email || !password || !fullName || !finalBusinessName) {
                return res.status(400).json({ error: 'Email, password, full name, and business name are required.' });
            }
            const cleanEmail = email.trim().toLowerCase();
            const existing = db.prepare('SELECT user_id FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
                .get(cleanEmail, cleanEmail);
            if (existing) {
                return res.status(400).json({ error: 'An account with this email address already exists. Please sign in.' });
            }
            const userId = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            const salt = bcryptjs_1.default.genSaltSync(10);
            const passwordHash = bcryptjs_1.default.hashSync(password, salt);
            // 1. Create User
            db.prepare(`
        INSERT INTO users (user_id, username, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?, 'ADMIN')
      `).run(userId, cleanEmail, cleanEmail, passwordHash, fullName.trim());
            // 2. Provision Isolated Business
            const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
            (0, seed_js_1.initializeBusiness)(db, {
                companyId,
                companyName: finalBusinessName,
                legalName: (legalName || finalBusinessName).trim(),
                gstin: gstin ? gstin.trim() : '',
                state: state || 'Tamil Nadu',
                stateCode: stateCode || '33',
                ownerUserId: userId
            });
            const token = jsonwebtoken_1.default.sign({ userId, username: cleanEmail, role: 'ADMIN', name: fullName.trim(), email: cleanEmail }, JWT_SECRET, { expiresIn: '30d' });
            const businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(userId);
            const createdCompany = businesses[0] || null;
            res.status(201).json({
                token,
                user: {
                    userId,
                    email: cleanEmail,
                    fullName: fullName.trim(),
                    role: 'ADMIN'
                },
                activeCompanyId: companyId,
                company: createdCompany,
                businesses
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Login to SaaS account
    router.post('/auth/login', (req, res) => {
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
      `).get(identifier, identifier);
            if (!user || !bcryptjs_1.default.compareSync(password, user.password_hash)) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.user_id, username: user.username, role: user.role, name: user.full_name, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
            let businesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.user_id);
            // If user has no businesses linked yet, link to first company or create one
            if (businesses.length === 0) {
                const defCompany = db.prepare('SELECT * FROM companies LIMIT 1').get();
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Current User & Accessible Businesses
    router.get('/auth/me', (req, res) => {
        const user = getUserFromToken(req);
        if (!user)
            return res.status(401).json({ error: 'Unauthorized' });
        try {
            const dbUser = db.prepare('SELECT user_id, username, email, full_name, role FROM users WHERE user_id = ?').get(user.userId);
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ---------------- BUSINESSES (TENANTS) ----------------
    // List all businesses for current user
    router.get('/businesses', (req, res) => {
        try {
            const user = getUserFromToken(req);
            let businesses;
            if (user?.userId) {
                businesses = db.prepare(`
          SELECT c.*, ub.role
          FROM companies c
          JOIN user_businesses ub ON c.company_id = ub.company_id
          WHERE ub.user_id = ?
          ORDER BY c.created_at ASC
        `).all(user.userId);
            }
            else {
                businesses = db.prepare('SELECT * FROM companies ORDER BY created_at ASC').all();
            }
            res.json(businesses);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Create an additional isolated business for current user
    router.post('/businesses', (req, res) => {
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
            (0, seed_js_1.initializeBusiness)(db, {
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
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // ---------------- COMPANY & FINANCIAL YEARS ----------------
    router.get('/companies/current', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId) {
                return res.json({ company: null, activeFinancialYear: null });
            }
            const company = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
            const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId);
            res.json({ company: company || null, activeFinancialYear: activeFy || null });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.put('/companies/current', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            const b = req.body;
            const targetId = b.company_id || companyId;
            if (!targetId) {
                return res.status(400).json({ error: 'No company selected to update.' });
            }
            db.prepare(`
        UPDATE companies SET
          company_name = ?, legal_name = ?, gstin = ?, pan = ?,
          address_line1 = ?, address_line2 = ?, city = ?, state = ?, state_code = ?, pincode = ?,
          phone = ?, email = ?, bank_name = ?, bank_account_no = ?, bank_ifsc = ?, bank_branch = ?,
          terms_and_conditions = ?
        WHERE company_id = ?
      `).run(b.company_name, b.legal_name, b.gstin, b.pan, b.address_line1, b.address_line2, b.city, b.state, b.state_code, b.pincode, b.phone, b.email, b.bank_name, b.bank_account_no, b.bank_ifsc, b.bank_branch, b.terms_and_conditions, targetId);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    // Permanently delete company and all isolated accounting records with password verification
    router.post('/companies/:id/delete', (req, res) => {
        try {
            const user = getUserFromToken(req);
            if (!user?.userId) {
                return res.status(401).json({ error: 'Authentication required to delete company.' });
            }
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Account password is required to verify company deletion.' });
            }
            // 1. Verify user password against database
            const dbUser = db.prepare('SELECT user_id, password_hash FROM users WHERE user_id = ?').get(user.userId);
            if (!dbUser || !bcryptjs_1.default.compareSync(password, dbUser.password_hash)) {
                return res.status(401).json({ error: 'Incorrect account password. Company deletion rejected.' });
            }
            const targetCompanyId = req.params.id;
            // 2. Verify access / ownership
            const userBiz = db.prepare('SELECT role FROM user_businesses WHERE user_id = ? AND company_id = ?').get(user.userId, targetCompanyId);
            if (!userBiz) {
                return res.status(403).json({ error: 'You do not have permission to delete this company.' });
            }
            // 3. Atomic cascade deletion of all company data
            db.exec('BEGIN TRANSACTION;');
            try {
                // A. Delete stock entries
                db.prepare(`
          DELETE FROM stock_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)
          OR item_id IN (SELECT item_id FROM stock_items WHERE company_id = ?)
        `).run(targetCompanyId, targetCompanyId);
                // B. Delete voucher lines
                db.prepare('DELETE FROM voucher_lines WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(targetCompanyId);
                // C. Delete ledger entries
                db.prepare('DELETE FROM ledger_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(targetCompanyId);
                // D. Delete vouchers
                db.prepare('DELETE FROM vouchers WHERE company_id = ?').run(targetCompanyId);
                // E. Delete stock items
                db.prepare('DELETE FROM stock_items WHERE company_id = ?').run(targetCompanyId);
                // F. Delete parties and addresses
                db.prepare('DELETE FROM party_addresses WHERE party_id IN (SELECT party_id FROM parties WHERE company_id = ?)').run(targetCompanyId);
                db.prepare('DELETE FROM parties WHERE company_id = ?').run(targetCompanyId);
                // G. Delete godowns and units
                db.prepare('DELETE FROM godowns WHERE company_id = ?').run(targetCompanyId);
                db.prepare('DELETE FROM units WHERE company_id = ?').run(targetCompanyId);
                // H. Delete financial years and ledgers
                db.prepare('DELETE FROM financial_years WHERE company_id = ?').run(targetCompanyId);
                db.prepare('DELETE FROM ledgers WHERE company_id = ?').run(targetCompanyId);
                // I. Delete user_businesses association & company
                db.prepare('DELETE FROM user_businesses WHERE company_id = ?').run(targetCompanyId);
                db.prepare('DELETE FROM companies WHERE company_id = ?').run(targetCompanyId);
                db.exec('COMMIT;');
            }
            catch (delErr) {
                db.exec('ROLLBACK;');
                throw delErr;
            }
            // 4. Return remaining businesses
            const remainingBusinesses = db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(user.userId);
            const nextActiveId = remainingBusinesses.length > 0 ? remainingBusinesses[0].company_id : null;
            res.json({
                success: true,
                message: 'Company and all associated data permanently deleted.',
                remainingBusinesses,
                nextActiveCompanyId: nextActiveId
            });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.get('/financial-years', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            if (!companyId)
                return res.json([]);
            const rows = db.prepare('SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC').all(companyId);
            res.json(rows);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.post('/financial-years', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const targetCompanyId = req.body.companyId || resolveCompanyId(req, db, user);
            if (!targetCompanyId) {
                return res.status(400).json({ error: 'No company selected for financial year creation.' });
            }
            const { name, startDate, endDate, status } = req.body;
            if (!name || !startDate || !endDate) {
                return res.status(400).json({ error: 'Financial year name, start date, and end date are required.' });
            }
            const fyId = `${targetCompanyId}_fy_${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
            let fyStatus = (status || 'OPEN').toUpperCase();
            if (fyStatus === 'ACTIVE')
                fyStatus = 'OPEN';
            if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
                fyStatus = 'OPEN';
            }
            db.prepare(`
        INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(fyId, targetCompanyId, name.trim(), startDate, endDate, fyStatus);
            const created = db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
            res.status(201).json(created);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
    router.put('/financial-years/:fyId', (req, res) => {
        try {
            const user = getUserFromToken(req);
            const companyId = resolveCompanyId(req, db, user);
            const { fyId } = req.params;
            const { status } = req.body;
            let fyStatus = (status || 'OPEN').toUpperCase();
            if (fyStatus === 'ACTIVE')
                fyStatus = 'OPEN';
            if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
                fyStatus = 'OPEN';
            }
            db.prepare(`
        UPDATE financial_years
        SET status = ?
        WHERE fy_id = ? AND company_id = ?
      `).run(fyStatus, fyId, companyId);
            const updated = db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
            res.json(updated);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
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
            const { partyName, partyType, gstin, pan, phone, email, contactPerson, bankName, addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise } = req.body;
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
        INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person, bank_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(partyId, targetCompanyId, ledgerId, partyType, partyName.trim(), gstin || null, derivedPan || null, phone || null, email || null, contactPerson || null, bankName || null);
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
            const { partyName, partyType, gstin, pan, phone, email, contactPerson, bankName, addressLine1, addressLine2, city, state, stateCode, pincode, openingBalancePaise } = req.body;
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
          bank_name = ?
        WHERE party_id = ?
      `).run(partyName ? partyName.trim() : null, partyType || null, gstin || null, pan || null, phone || null, email || null, contactPerson || null, bankName || null, partyId);
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
                }
                db.prepare(`
          UPDATE stock_items SET
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
            res.status(201).json({ itemId, itemName: b.itemName, updated: false, message: `Created stock item '${b.itemName}'.` });
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
