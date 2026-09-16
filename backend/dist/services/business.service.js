"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessService = void 0;
const seed_js_1 = require("../database/seed.js");
class BusinessService {
    static getBusinesses(db, userId) {
        if (userId) {
            return db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(userId);
        }
        else {
            return db.prepare('SELECT * FROM companies ORDER BY created_at ASC').all();
        }
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
        let vaultPasswordHash = undefined;
        if (payload.vault_password) {
            const bcrypt = require('bcryptjs');
            vaultPasswordHash = bcrypt.hashSync(payload.vault_password, 10);
        }
        db.prepare(`
      UPDATE companies SET
        company_name = ?, legal_name = ?, gstin = ?, pan = ?,
        address_line1 = ?, address_line2 = ?, city = ?, state = ?, state_code = ?, pincode = ?,
        phone = ?, email = ?, bank_name = ?, bank_account_no = ?, bank_ifsc = ?, bank_branch = ?,
        terms_and_conditions = ?, mailing_name = ?, 
        logo_base64 = COALESCE(?, logo_base64),
        vault_password_hash = COALESCE(?, vault_password_hash)
      WHERE company_id = ?
    `).run(payload.company_name, payload.legal_name, payload.gstin, payload.pan, payload.address_line1, payload.address_line2, payload.city, payload.state, payload.state_code, payload.pincode, payload.phone, payload.email, payload.bank_name, payload.bank_account_no, payload.bank_ifsc, payload.bank_branch, payload.terms_and_conditions, payload.mailing_name || payload.company_name, payload.logo_base64 || null, vaultPasswordHash || null, companyId);
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
        if (!name || !startDate || !endDate) {
            throw new Error('Financial year name, start date, and end date are required.');
        }
        const fyId = `${companyId}_fy_${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
        let fyStatus = (status || 'OPEN').toUpperCase();
        if (fyStatus === 'ACTIVE')
            fyStatus = 'OPEN';
        if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
            fyStatus = 'OPEN';
        }
        db.prepare(`
      INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fyId, companyId, name.trim(), startDate, endDate, fyStatus);
        return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
    }
    static updateFinancialYearStatus(db, companyId, fyId, status) {
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
        return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
    }
}
exports.BusinessService = BusinessService;
