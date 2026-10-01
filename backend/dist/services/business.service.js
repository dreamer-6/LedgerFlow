"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const seed_js_1 = require("../database/seed.js");
class BusinessService {
    /**
     * Returns ONLY the companies this user has user_businesses membership in.
     * Global users.role is NEVER used to expand company visibility.
     */
    static getBusinesses(db, userId) {
        if (!userId)
            return [];
        return db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId);
    }
    static createBusiness(db, userId, payload) {
        const { companyName, legalName, gstin, state, stateCode, mailingName, vaultPassword, logoBase64 } = payload;
        if (!companyName || !companyName.trim()) {
            throw new Error('Business name is required.');
        }
        const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
        (0, seed_js_1.initializeBusiness)(db, {
            companyId,
            companyName: companyName.trim(),
            legalName: (legalName || companyName).trim(),
            gstin: gstin ? gstin.trim() : '',
            state: state || 'Tamil Nadu',
            stateCode: stateCode || '33',
            ownerUserId: userId
        });
        const bcrypt = require('bcryptjs');
        const vaultPasswordHash = vaultPassword ? bcrypt.hashSync(vaultPassword, 10) : null;
        db.prepare(`
      UPDATE companies 
      SET mailing_name = ?, vault_password_hash = ?, logo_base64 = ?
      WHERE company_id = ?
    `).run(mailingName || companyName, vaultPasswordHash, logoBase64 || null, companyId);
        return db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
    }
    static getCurrentCompanyInfo(db, companyId) {
        const company = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
        const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId);
        return { company: company || null, activeFinancialYear: activeFy || null };
    }
    static updateCurrentCompany(db, companyId, payload) {
        const existing = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
        if (!existing) {
            throw new Error('Company not found.');
        }
        let vaultPasswordHash = undefined;
        if (payload.vault_password) {
            const bcrypt = require('bcryptjs');
            vaultPasswordHash = bcrypt.hashSync(payload.vault_password, 10);
        }
        const hasLogoUpdate = payload.logo_base64 !== undefined;
        const logoVal = payload.logo_base64 || null;
        db.prepare(`
      UPDATE companies SET
        company_name = ?,
        legal_name = ?,
        gstin = ?,
        pan = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        state_code = ?,
        pincode = ?,
        phone = ?,
        email = ?,
        bank_name = ?,
        bank_account_no = ?,
        bank_ifsc = ?,
        bank_branch = ?,
        terms_and_conditions = ?,
        mailing_name = ?, 
        logo_base64 = CASE WHEN ? = 1 THEN ? ELSE logo_base64 END,
        vault_password_hash = COALESCE(?, vault_password_hash)
      WHERE company_id = ?
    `).run(payload.company_name || existing.company_name, payload.legal_name || payload.company_name || existing.legal_name || existing.company_name || 'Business Enterprise', payload.gstin !== undefined ? (payload.gstin || null) : existing.gstin, payload.pan !== undefined ? (payload.pan || null) : existing.pan, payload.address_line1 !== undefined ? (payload.address_line1 || existing.address_line1 || 'Main Business Office') : (existing.address_line1 || 'Main Business Office'), payload.address_line2 !== undefined ? (payload.address_line2 || null) : existing.address_line2, payload.city !== undefined ? (payload.city || existing.city || 'Chennai') : (existing.city || 'Chennai'), payload.state !== undefined ? (payload.state || existing.state || 'Tamil Nadu') : (existing.state || 'Tamil Nadu'), payload.state_code !== undefined ? (payload.state_code || existing.state_code || '33') : (existing.state_code || '33'), payload.pincode !== undefined ? (payload.pincode || existing.pincode || '600001') : (existing.pincode || '600001'), payload.phone !== undefined ? (payload.phone || null) : existing.phone, payload.email !== undefined ? (payload.email || null) : existing.email, payload.bank_name !== undefined ? (payload.bank_name || null) : existing.bank_name, payload.bank_account_no !== undefined ? (payload.bank_account_no || null) : existing.bank_account_no, payload.bank_ifsc !== undefined ? (payload.bank_ifsc || null) : existing.bank_ifsc, payload.bank_branch !== undefined ? (payload.bank_branch || null) : existing.bank_branch, payload.terms_and_conditions !== undefined ? (payload.terms_and_conditions || null) : existing.terms_and_conditions, payload.mailing_name || payload.company_name || existing.mailing_name || existing.company_name, hasLogoUpdate ? 1 : 0, logoVal, vaultPasswordHash || null, companyId);
    }
    static deleteCompany(db, userId, companyId) {
        const userBiz = db.prepare('SELECT role FROM user_businesses WHERE user_id = ? AND company_id = ?').get(userId, companyId);
        if (!userBiz) {
            throw new Error('You do not have permission to delete this company.');
        }
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare('DELETE FROM audit_logs WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM party_addresses WHERE party_id IN (SELECT party_id FROM parties WHERE company_id = ?)').run(companyId);
            db.prepare('DELETE FROM parties WHERE company_id = ?').run(companyId);
            db.prepare(`
        DELETE FROM stock_entries 
        WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)
           OR item_id IN (SELECT item_id FROM stock_items WHERE company_id = ?)
           OR godown_id IN (SELECT godown_id FROM godowns WHERE company_id = ?)
      `).run(companyId, companyId, companyId);
            db.prepare('DELETE FROM voucher_lines WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
            db.prepare(`
        DELETE FROM ledger_entries 
        WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)
           OR ledger_id IN (SELECT ledger_id FROM ledgers WHERE company_id = ?)
      `).run(companyId, companyId);
            db.prepare('DELETE FROM tax_entries WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)').run(companyId);
            db.prepare(`
        DELETE FROM bill_allocations 
        WHERE voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)
           OR ledger_id IN (SELECT ledger_id FROM ledgers WHERE company_id = ?)
           OR reference_voucher_id IN (SELECT voucher_id FROM vouchers WHERE company_id = ?)
      `).run(companyId, companyId, companyId);
            db.prepare('DELETE FROM vouchers WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM stock_items WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM godowns WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM units WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM financial_years WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM ledgers WHERE company_id = ?').run(companyId);
            db.prepare('UPDATE ledger_groups SET parent_group_id = NULL WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM ledger_groups WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM user_businesses WHERE company_id = ?').run(companyId);
            db.prepare('DELETE FROM companies WHERE company_id = ?').run(companyId);
            db.exec('COMMIT;');
        }
        catch (delErr) {
            db.exec('ROLLBACK;');
            throw delErr;
        }
        const remainingBusinesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId);
        return {
            success: true,
            message: 'Company and all associated data permanently deleted.',
            remainingBusinesses,
            nextActiveCompanyId: remainingBusinesses.length > 0 ? remainingBusinesses[0].company_id : null
        };
    }
    static getFinancialYears(db, companyId) {
        return db.prepare('SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC').all(companyId);
    }
    static createFinancialYear(db, companyId, payload) {
        const { name, startDate, endDate, status } = payload;
        if (!name || !name.trim() || !startDate || !endDate) {
            throw new Error('Financial year name, start date, and end date are required.');
        }
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(startDate) || isNaN(Date.parse(startDate))) {
            throw new Error(`Invalid start date format '${startDate}'. Must be YYYY-MM-DD.`);
        }
        if (!isoDateRegex.test(endDate) || isNaN(Date.parse(endDate))) {
            throw new Error(`Invalid end date format '${endDate}'. Must be YYYY-MM-DD.`);
        }
        if (startDate >= endDate) {
            throw new Error(`Financial year start date (${startDate}) must be strictly before end date (${endDate}).`);
        }
        const trimmedName = name.trim();
        const fyId = `${companyId}_fy_${trimmedName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        let fyStatus = (status || 'OPEN').toUpperCase();
        if (fyStatus === 'ACTIVE')
            fyStatus = 'OPEN';
        if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
            fyStatus = 'OPEN';
        }
        // Atomic transaction for overlap and duplicate checks
        db.exec('BEGIN IMMEDIATE;');
        try {
            // 1. Check duplicate name
            const existingName = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyId, trimmedName);
            if (existingName) {
                throw new Error(`Financial year with name '${trimmedName}' already exists for this company.`);
            }
            // 2. Check date overlap
            const existingFys = db.prepare('SELECT name, start_date, end_date FROM financial_years WHERE company_id = ?').all(companyId);
            for (const ef of existingFys) {
                if (startDate <= ef.end_date && endDate >= ef.start_date) {
                    throw new Error(`Financial year date range [${startDate} to ${endDate}] overlaps with existing financial year '${ef.name}' [${ef.start_date} to ${ef.end_date}].`);
                }
            }
            db.prepare(`
        INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(fyId, companyId, trimmedName, startDate, endDate, fyStatus);
            db.exec('COMMIT;');
        }
        catch (err) {
            try {
                db.exec('ROLLBACK;');
            }
            catch (_) { }
            throw err;
        }
        return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
    }
    static updateFinancialYearStatus(db, companyId, fyId, status, userRole, reason, userId) {
        let fyStatus = (status || 'OPEN').toUpperCase();
        if (fyStatus === 'ACTIVE')
            fyStatus = 'OPEN';
        if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
            fyStatus = 'OPEN';
        }
        const currentFy = db.prepare('SELECT * FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, companyId);
        if (!currentFy) {
            throw new Error(`Financial year '${fyId}' not found for this company.`);
        }
        // State machine check: reopening CLOSED -> OPEN requires OWNER + reason
        if (currentFy.status === 'CLOSED' && fyStatus === 'OPEN') {
            if (userRole !== 'OWNER') {
                throw new Error('Only the company OWNER can reopen a closed financial year.');
            }
            if (!reason || !reason.trim()) {
                throw new Error('A valid business reason is required to reopen a closed financial year.');
            }
            db.prepare(`
        UPDATE financial_years
        SET status = ?
        WHERE fy_id = ? AND company_id = ?
      `).run(fyStatus, fyId, companyId);
            // Record high-priority audit log
            db.prepare(`
        INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
        VALUES (?, ?, ?, 'REOPEN_FINANCIAL_YEAR', 'FINANCIAL_YEAR', ?, ?)
      `).run('aud_' + node_crypto_1.default.randomUUID().replace(/-/g, '').substring(0, 16), companyId, userId || 'system', fyId, JSON.stringify({ fyId, previousStatus: currentFy.status, newStatus: fyStatus, reason: reason.trim() }));
            return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
        }
        db.prepare(`
      UPDATE financial_years
      SET status = ?
      WHERE fy_id = ? AND company_id = ?
    `).run(fyStatus, fyId, companyId);
        return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
    }
}
exports.BusinessService = BusinessService;
