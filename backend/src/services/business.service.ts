import { DatabaseSync } from 'node:sqlite';
import { initializeBusiness } from '../database/seed.js';

export class BusinessService {
  static getBusinesses(db: DatabaseSync, userId?: string) {
    if (userId) {
      return db.prepare(`
        SELECT c.*, ub.role
        FROM companies c
        JOIN user_businesses ub ON c.company_id = ub.company_id
        WHERE ub.user_id = ?
        ORDER BY c.created_at ASC
      `).all(userId);
    } else {
      return db.prepare('SELECT * FROM companies ORDER BY created_at ASC').all();
    }
  }

  static createBusiness(db: DatabaseSync, userId: string, payload: any) {
    const { companyName, legalName, gstin, state, stateCode, mailingName, vaultPassword, logoBase64 } = payload;
    if (!companyName || !companyName.trim()) {
      throw new Error('Business name is required.');
    }

    const companyId = 'comp_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    initializeBusiness(db, {
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

  static getCurrentCompanyInfo(db: DatabaseSync, companyId: string) {
    const company = db.prepare('SELECT * FROM companies WHERE company_id = ?').get(companyId);
    const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId);
    return { company: company || null, activeFinancialYear: activeFy || null };
  }

  static updateCurrentCompany(db: DatabaseSync, companyId: string, payload: any) {
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
    `).run(
      payload.company_name || null, payload.legal_name || null, payload.gstin || null, payload.pan || null,
      payload.address_line1 || null, payload.address_line2 || null, payload.city || null, payload.state || null, payload.state_code || null, payload.pincode || null,
      payload.phone || null, payload.email || null, payload.bank_name || null, payload.bank_account_no || null, payload.bank_ifsc || null, payload.bank_branch || null,
      payload.terms_and_conditions || null, payload.mailing_name || payload.company_name || null,
      payload.logo_base64 || null, vaultPasswordHash || null, companyId
    );
  }

  static deleteCompany(db: DatabaseSync, userId: string, companyId: string) {
    const userBiz = db.prepare('SELECT role FROM user_businesses WHERE user_id = ? AND company_id = ?').get(userId, companyId) as any;
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
    } catch (delErr: any) {
      db.exec('ROLLBACK;');
      throw delErr;
    }

    const remainingBusinesses = db.prepare(`
      SELECT c.*, ub.role
      FROM companies c
      JOIN user_businesses ub ON c.company_id = ub.company_id
      WHERE ub.user_id = ?
      ORDER BY c.created_at ASC
    `).all(userId) as any[];

    return {
      success: true,
      message: 'Company and all associated data permanently deleted.',
      remainingBusinesses,
      nextActiveCompanyId: remainingBusinesses.length > 0 ? remainingBusinesses[0].company_id : null
    };
  }

  static getFinancialYears(db: DatabaseSync, companyId: string) {
    return db.prepare('SELECT * FROM financial_years WHERE company_id = ? ORDER BY start_date DESC').all(companyId);
  }

  static createFinancialYear(db: DatabaseSync, companyId: string, payload: any) {
    const { name, startDate, endDate, status } = payload;
    if (!name || !startDate || !endDate) {
      throw new Error('Financial year name, start date, and end date are required.');
    }

    const fyId = `${companyId}_fy_${name.trim().replace(/[^a-zA-Z0-9]/g, '_')}`;
    let fyStatus = (status || 'OPEN').toUpperCase();
    if (fyStatus === 'ACTIVE') fyStatus = 'OPEN';
    if (!['OPEN', 'LOCKED', 'CLOSED'].includes(fyStatus)) {
      fyStatus = 'OPEN';
    }

    db.prepare(`
      INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(fyId, companyId, name.trim(), startDate, endDate, fyStatus);

    return db.prepare('SELECT * FROM financial_years WHERE fy_id = ?').get(fyId);
  }

  static updateFinancialYearStatus(db: DatabaseSync, companyId: string, fyId: string, status: string) {
    let fyStatus = (status || 'OPEN').toUpperCase();
    if (fyStatus === 'ACTIVE') fyStatus = 'OPEN';
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
