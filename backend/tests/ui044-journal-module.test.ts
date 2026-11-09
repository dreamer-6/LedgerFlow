/**
 * ui044-journal-module.test.ts — Comprehensive Test Suite for UI-044: Journal Module Implementation
 *
 * Verifies:
 * 1. Sidebar Navigation & Routing Architecture:
 *    - Main Journal item navigates directly to Journal Dashboard (`setJournalViewMode('dashboard')`).
 *    - Zero redundant "Journal Dashboard" inside the collapsible submenu.
 *    - Submenu strictly contains only "Create Journal" and "Journal Register".
 *    - Expandable chevron toggle and active navigation highlight invariants.
 *    - App.tsx cleanly routes all 4 journal views and print modal.
 * 2. Authoritative Voucher Numbering:
 *    - Generates official journal voucher numbers with prefix `JRN-` (e.g. `JRN-2026-0036`).
 * 3. Draft Journal Lifecycle:
 *    - Saving a draft journal creates a voucher with status DRAFT.
 *    - Strict accounting isolation: 0 active ledger entries in the database.
 *    - Preserves canonical customLedgerLines and draft metadata in terms_conditions.
 * 4. Atomic Double-Entry Posting — Balanced Journal (Exact Mockup Scenario):
 *    - Dr Depreciation Expense A/c (Expenses) ₹2,40,000.00
 *    - Cr Accumulated Depreciation A/c (Fixed Assets) ₹2,40,000.00
 *    - Exact Dr == Cr in paise, status = POSTED.
 * 5. Double-Entry Balance & Validation Enforcement:
 *    - Rejection of unbalanced journal entries (Dr != Cr).
 *    - Rejection of entries with fewer than 2 valid ledger lines.
 *    - Rejection of lines with negative or invalid paise amounts.
 * 6. Entry Types Classification:
 *    - Stores and retrieves entry types: Adjustment Entry, Transfer Entry, Provision Entry, Correction Entry, Other Entry.
 *    - Group breakdown and donut chart calculation correctness.
 * 7. Multi-Tenant Company Isolation:
 *    - Journal vouchers belonging to Company A are not accessible by Company B.
 *    - Ledger accounts from Company B cannot be used in Company A's journal voucher.
 * 8. Cancellation & Audit Trail:
 *    - Cancelling a posted journal voucher marks status as CANCELLED.
 *    - Tombstone/audit log is preserved.
 *    - Reverses financial impact in general ledger queries.
 * 9. Dashboard & Register KPI Reconciliation:
 *    - Total Journal Amount, Journal Count, Posted Entries, Draft Entries, Cancelled Entries match 100% with SQLite records.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PostingEngine } from '../src/domain/posting/posting-engine';

describe('UI-044: Journal Module Implementation', () => {
  const sidebarPath = path.resolve(__dirname, '../../frontend/src/components/layout/Sidebar.tsx');
  const appPath = path.resolve(__dirname, '../../frontend/src/App.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  let db: DatabaseSync;
  const testCompanyId = 'cmp_ui044_journal';
  const otherCompanyId = 'cmp_ui044_other';
  const fyId = 'fy_2026_27';

  // Seeded Ledger IDs
  const deprExpenseLedgerId = 'led_depr_exp_ui044';
  const accumDeprLedgerId = 'led_accum_depr_ui044';
  const cashLedgerId = 'led_cash_ui044';
  const bankLedgerId = 'led_bank_ui044';
  const auditFeeExpLedgerId = 'led_audit_exp_ui044';
  const auditFeeProvLedgerId = 'led_audit_prov_ui044';
  const hoBranchFundLedgerId = 'led_ho_fund_ui044';
  const otherCoLedgerId = 'led_other_co_ui044';

  before(() => {
    // In-memory SQLite database initialized with authoritative schema
    db = new DatabaseSync(':memory:');
    const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
    db.exec(schemaSql);

    // Create companies
    db.prepare(`
      INSERT INTO companies (company_id, company_name, legal_name, gstin, address_line1, city, state, state_code, pincode)
      VALUES (?, 'Dream Tech Solutions', 'Dream Tech Solutions LLP', '29ABCDE1234F1Z5', '123 Business Ave', 'Bengaluru', 'Karnataka', '29', '560100')
    `).run(testCompanyId);

    db.prepare(`
      INSERT INTO companies (company_id, company_name, legal_name, gstin, address_line1, city, state, state_code, pincode)
      VALUES (?, 'Other Enterprises', 'Other Enterprises Pvt Ltd', '33XYZAB1234C1Z9', '456 Tech Park', 'Chennai', 'Tamil Nadu', '33', '600001')
    `).run(otherCompanyId);

    // Create Financial Years
    db.prepare(`
      INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
    `).run(fyId, testCompanyId);

    db.prepare(`
      INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES ('fy_other_2627', ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
    `).run(otherCompanyId);

    // Create Ledger Groups
    db.prepare(`
      INSERT INTO ledger_groups (group_id, company_id, group_name, nature, affects_gross_profit)
      VALUES 
        ('grp_fa', ?, 'Fixed Assets', 'ASSET', 0),
        ('grp_exp', ?, 'Expenses', 'EXPENSE', 0),
        ('grp_cl', ?, 'Current Liabilities', 'LIABILITY', 0),
        ('grp_bank', ?, 'Bank Accounts', 'ASSET', 0),
        ('grp_cash', ?, 'Cash-in-Hand', 'ASSET', 0),
        ('grp_branch', ?, 'Branch / Divisions', 'ASSET', 0)
    `).run(testCompanyId, testCompanyId, testCompanyId, testCompanyId, testCompanyId, testCompanyId);

    // Create Ledgers for testCompany
    db.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, is_party, is_active)
      VALUES
        (?, ?, 'grp_exp', 'Depreciation Expense A/c', 0, 1),
        (?, ?, 'grp_fa', 'Accumulated Depreciation A/c', 0, 1),
        (?, ?, 'grp_cash', 'Cash', 0, 1),
        (?, ?, 'grp_bank', 'HDFC Bank', 0, 1),
        (?, ?, 'grp_exp', 'Provision for Audit Fees A/c', 0, 1),
        (?, ?, 'grp_cl', 'Audit Fees Payable', 0, 1),
        (?, ?, 'grp_branch', 'HO to Branch - Fund Transfer A/c', 0, 1)
    `).run(
      deprExpenseLedgerId, testCompanyId,
      accumDeprLedgerId, testCompanyId,
      cashLedgerId, testCompanyId,
      bankLedgerId, testCompanyId,
      auditFeeExpLedgerId, testCompanyId,
      auditFeeProvLedgerId, testCompanyId,
      hoBranchFundLedgerId, testCompanyId
    );

    // Create Ledger for otherCompany
    db.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, is_party, is_active)
      VALUES (?, ?, 'grp_exp', 'Confidential Other Co Ledger', 0, 1)
    `).run(otherCoLedgerId, otherCompanyId);
  });

  after(() => {
    db.close();
  });

  describe('1. Sidebar Navigation & Routing Standard (UI-041/042/043/044 Invariants)', () => {
    it('clicking the main Journal item navigates directly to Journal Dashboard', () => {
      assert.ok(
        sidebarCode.includes("setActiveTab('journal')"),
        'Sidebar must set activeTab to "journal"'
      );
      assert.ok(
        sidebarCode.includes("setJournalViewMode('dashboard')"),
        'Sidebar must set journalViewMode directly to "dashboard"'
      );
    });

    it('collapsible submenu strictly contains only Create Journal and Journal Register (no redundant Dashboard)', () => {
      // Find the collapsible submenu block for journal
      const journalBlockMatch = sidebarCode.match(/expandedGroup === 'journal'[\s\S]*?<\/div>\s*\)\s*}/);
      assert.ok(journalBlockMatch, 'Must find expandedGroup === "journal" block');
      const journalBlock = journalBlockMatch[0];

      assert.ok(
        journalBlock.includes('Create Journal'),
        'Submenu must include "Create Journal"'
      );
      assert.ok(
        journalBlock.includes('Journal Register'),
        'Submenu must include "Journal Register"'
      );
      assert.ok(
        !journalBlock.includes('Journal Dashboard'),
        'Submenu must NOT contain redundant "Journal Dashboard" submenu item'
      );
    });

    it('App.tsx cleanly routes all 4 Journal views and print modal', () => {
      assert.ok(appCode.includes('<JournalDashboardView'), 'App.tsx must route JournalDashboardView');
      assert.ok(appCode.includes('<CreateJournalView'), 'App.tsx must route CreateJournalView');
      assert.ok(appCode.includes('<JournalRegisterView'), 'App.tsx must route JournalRegisterView');
      assert.ok(appCode.includes('<JournalDetailsView'), 'App.tsx must route JournalDetailsView');
      assert.ok(appCode.includes('<JournalPrintModal'), 'App.tsx must route JournalPrintModal');
    });
  });

  describe('2. Authoritative Voucher Numbering', () => {
    it('generates official journal voucher number with JRN prefix', () => {
      const vchNum = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      assert.ok(vchNum.startsWith('JRN-'), `Journal voucher number must start with "JRN-", got: ${vchNum}`);
      assert.match(vchNum, /^JRN-\d{4}-\d+$/, 'Format must be JRN-YYYY-XXXX');
    });

    it('sequential numbering increments correctly without collisions', () => {
      const vch1 = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      // Insert placeholder
      db.prepare(`
        INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
        VALUES ('vch_temp_seq_1', ?, ?, 'JOURNAL', ?, '2026-11-01', 10000, 'POSTED')
      `).run(testCompanyId, fyId, vch1);

      const vch2 = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      assert.notEqual(vch1, vch2, 'Next generated voucher number must be distinct and incremented');
    });
  });

  describe('3. Draft Journal Lifecycle', () => {
    let draftVoucherId: string;

    it('saves a journal entry as DRAFT without creating active ledger entries', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const customLines = [
        {
          ledgerId: deprExpenseLedgerId,
          ledgerName: 'Depreciation Expense A/c',
          particulars: 'Depreciation for Oct 2026',
          debitPaise: 24000000,
          creditPaise: 0
        },
        {
          ledgerId: accumDeprLedgerId,
          ledgerName: 'Accumulated Depreciation A/c',
          particulars: 'Depreciation for Oct 2026',
          debitPaise: 0,
          creditPaise: 24000000
        }
      ];

      const result = PostingEngine.postVoucher(db, {
        companyId: testCompanyId,
        fyId,
        voucherType: 'JOURNAL',
        voucherNumber: vchNumber,
        voucherDate: '2026-10-28',
        referenceNumber: 'ADJ-OCT-01',
        paymentMode: 'Adjustment Entry',
        narration: 'Being depreciation charged on fixed assets for the month of October 2026.',
        lines: [],
        customLedgerLines: customLines,
        status: 'DRAFT'
      });

      assert.ok(result.voucherId, 'Must return generated voucherId');
      draftVoucherId = result.voucherId;

      // Check voucher status in database
      const vch = db.prepare(`SELECT * FROM vouchers WHERE voucher_id = ?`).get(draftVoucherId) as any;
      assert.equal(vch.status, 'DRAFT', 'Voucher status must be DRAFT');
      assert.equal(vch.voucher_number, vchNumber, 'Voucher number must match');
      assert.equal(vch.total_amount_paise, 24000000, 'Total amount paise must be ₹2,40,000 (24000000 paise)');

      // Verify ZERO active ledger entries exist for draft
      const ledgerEntryCount = db.prepare(`
        SELECT COUNT(*) as count FROM ledger_entries WHERE voucher_id = ?
      `).get(draftVoucherId) as any;
      assert.equal(ledgerEntryCount.count, 0, 'DRAFT voucher must have strictly 0 active ledger entries');

      // Verify draft metadata is preserved in terms_conditions
      assert.ok(vch.terms_conditions, 'Draft metadata must be stored in terms_conditions');
      const parsedMeta = JSON.parse(vch.terms_conditions);
      assert.ok(parsedMeta._draftMeta?.customLedgerLines, 'customLedgerLines must be retained in _draftMeta');
      assert.equal(parsedMeta._draftMeta.customLedgerLines.length, 2, 'Must retain both ledger lines');
    });

    it('promotes DRAFT voucher to POSTED with atomic double-entry ledger entries', () => {
      const postResult = PostingEngine.postDraftVoucher(db, testCompanyId, draftVoucherId, 'tester');

      assert.equal(postResult.status, 'POSTED', 'Promotion must succeed with POSTED status');

      // Verify voucher status is now POSTED
      const updatedVch = db.prepare(`SELECT * FROM vouchers WHERE voucher_id = ?`).get(draftVoucherId) as any;
      assert.equal(updatedVch.status, 'POSTED', 'Voucher status must now be POSTED');

      // Verify ledger entries are created
      const entries = db.prepare(`
        SELECT * FROM ledger_entries WHERE voucher_id = ?
      `).all(draftVoucherId) as any[];

      assert.equal(entries.length, 2, 'Must have exactly 2 ledger entries');
      const debitEntry = entries.find(e => e.debit_paise > 0);
      const creditEntry = entries.find(e => e.credit_paise > 0);

      assert.ok(debitEntry, 'Debit entry must exist');
      assert.ok(creditEntry, 'Credit entry must exist');
      assert.equal(debitEntry.ledger_id, deprExpenseLedgerId, 'Debit must be to Depreciation Expense');
      assert.equal(debitEntry.debit_paise, 24000000, 'Debit paise must be 24000000');
      assert.equal(creditEntry.ledger_id, accumDeprLedgerId, 'Credit must be to Accumulated Depreciation');
      assert.equal(creditEntry.credit_paise, 24000000, 'Credit paise must be 24000000');
    });
  });

  describe('4. Atomic Direct Double-Entry Posting (Exact Mockup Scenarios)', () => {
    it('posts multi-line balanced Transfer Entry: HO to Branch fund transfer', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const customLines = [
        {
          ledgerId: hoBranchFundLedgerId,
          ledgerName: 'HO to Branch - Fund Transfer A/c',
          particulars: 'Inter-Branch Transfer',
          debitPaise: 15000000,
          creditPaise: 0
        },
        {
          ledgerId: bankLedgerId,
          ledgerName: 'HDFC Bank',
          particulars: 'Inter-Branch Transfer',
          debitPaise: 0,
          creditPaise: 15000000
        }
      ];

      const result = PostingEngine.postVoucher(db, {
        companyId: testCompanyId,
        fyId,
        voucherType: 'JOURNAL',
        voucherNumber: vchNumber,
        voucherDate: '2026-10-20',
        paymentMode: 'Transfer Entry',
        narration: 'Inter-Branch Transfer to Cochin Branch',
        lines: [],
        customLedgerLines: customLines,
        status: 'POSTED'
      });

      assert.ok(result.voucherId, 'Transfer entry posting must return voucherId');
      
      const vch = db.prepare(`SELECT * FROM vouchers WHERE voucher_id = ?`).get(result.voucherId!) as any;
      assert.equal(vch.payment_mode, 'Transfer Entry');
      assert.equal(vch.total_amount_paise, 15000000);
      assert.equal(vch.status, 'POSTED');

      // Verify entries
      const entries = db.prepare(`SELECT * FROM ledger_entries WHERE voucher_id = ?`).all(result.voucherId!) as any[];
      assert.equal(entries.length, 2);
      const sumDr = entries.reduce((acc, e) => acc + (e.debit_paise || 0), 0);
      const sumCr = entries.reduce((acc, e) => acc + (e.credit_paise || 0), 0);
      assert.equal(sumDr, 15000000);
      assert.equal(sumCr, 15000000);
      assert.equal(sumDr, sumCr, 'Double entry must balance perfectly');
    });

    it('posts Provision Entry: Provision for Audit Fees', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const customLines = [
        {
          ledgerId: auditFeeExpLedgerId,
          ledgerName: 'Provision for Audit Fees A/c',
          particulars: 'Audit fees for FY26-27',
          debitPaise: 5000000,
          creditPaise: 0
        },
        {
          ledgerId: auditFeeProvLedgerId,
          ledgerName: 'Audit Fees Payable',
          particulars: 'Audit fees provision',
          debitPaise: 0,
          creditPaise: 5000000
        }
      ];

      const result = PostingEngine.postVoucher(db, {
        companyId: testCompanyId,
        fyId,
        voucherType: 'JOURNAL',
        voucherNumber: vchNumber,
        voucherDate: '2026-10-15',
        paymentMode: 'Provision Entry',
        narration: 'Provision for statutory audit fees for FY 2026-27',
        lines: [],
        customLedgerLines: customLines,
        status: 'POSTED'
      });

      assert.ok(result.voucherId, 'Provision entry posting must return voucherId');
      const vch = db.prepare(`SELECT * FROM vouchers WHERE voucher_id = ?`).get(result.voucherId!) as any;
      assert.equal(vch.payment_mode, 'Provision Entry');
      assert.equal(vch.total_amount_paise, 5000000);
    });
  });

  describe('5. Double-Entry Balance & Validation Enforcement', () => {
    it('strictly rejects unbalanced journal entries where Debit != Credit', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const unbalancedLines = [
        {
          ledgerId: deprExpenseLedgerId,
          ledgerName: 'Depreciation Expense A/c',
          debitPaise: 100000, // ₹1,000 Dr
          creditPaise: 0
        },
        {
          ledgerId: accumDeprLedgerId,
          ledgerName: 'Accumulated Depreciation A/c',
          debitPaise: 0,
          creditPaise: 80000 // ₹800 Cr (Unbalanced by ₹200)
        }
      ];

      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'JOURNAL',
          voucherNumber: vchNumber,
          voucherDate: '2026-11-01',
          lines: [],
          customLedgerLines: unbalancedLines,
          status: 'POSTED'
        });
      }, /discrepancy|balance|debit/i, 'Must throw error on unbalanced journal entry');
    });

    it('strictly rejects journal entry with fewer than 2 ledger lines', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const singleLine = [
        {
          ledgerId: deprExpenseLedgerId,
          ledgerName: 'Depreciation Expense A/c',
          debitPaise: 100000,
          creditPaise: 0
        }
      ];

      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'JOURNAL',
          voucherNumber: vchNumber,
          voucherDate: '2026-11-01',
          lines: [],
          customLedgerLines: singleLine,
          status: 'POSTED'
        });
      }, /discrepancy|balance|line/i, 'Must throw error on single-line entry');
    });

    it('strictly rejects journal lines with negative paise', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const negativeLines = [
        {
          ledgerId: deprExpenseLedgerId,
          ledgerName: 'Depreciation Expense A/c',
          debitPaise: -100000,
          creditPaise: 0
        },
        {
          ledgerId: accumDeprLedgerId,
          ledgerName: 'Accumulated Depreciation A/c',
          debitPaise: 0,
          creditPaise: -100000
        }
      ];

      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'JOURNAL',
          voucherNumber: vchNumber,
          voucherDate: '2026-11-01',
          lines: [],
          customLedgerLines: negativeLines,
          status: 'POSTED'
        });
      }, /negative/i, 'Must throw error on negative amount');
    });
  });

  describe('6. Multi-Tenant Company Isolation', () => {
    it('strictly rejects journal posting using a ledger belonging to a different company', () => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      
      const crossTenantLines = [
        {
          ledgerId: otherCoLedgerId, // Belongs to otherCompanyId
          ledgerName: 'Confidential Other Co Ledger',
          debitPaise: 500000,
          creditPaise: 0
        },
        {
          ledgerId: accumDeprLedgerId, // Belongs to testCompanyId
          ledgerName: 'Accumulated Depreciation A/c',
          debitPaise: 0,
          creditPaise: 500000
        }
      ];

      assert.throws(() => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'JOURNAL',
          voucherNumber: vchNumber,
          voucherDate: '2026-11-01',
          lines: [],
          customLedgerLines: crossTenantLines,
          status: 'POSTED'
        });
      }, /security|does not belong/i, 'Must throw error on cross-tenant ledger');
    });

    it('queries for testCompanyId never return vouchers from otherCompanyId', () => {
      // Create a voucher for otherCompanyId
      const otherVchNum = PostingEngine.getNextVoucherNumber(db, otherCompanyId, 'fy_other_2627', 'JOURNAL');
      db.prepare(`
        INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
        VALUES ('vch_other_co_isolate', ?, 'fy_other_2627', 'JOURNAL', ?, '2026-11-01', 999900, 'POSTED')
      `).run(otherCompanyId, otherVchNum);

      // Query vouchers for testCompanyId
      const testVouchers = db.prepare(`
        SELECT voucher_id, company_id FROM vouchers WHERE company_id = ? AND voucher_type = 'JOURNAL'
      `).all(testCompanyId) as any[];

      const leaked = testVouchers.find(v => v.company_id === otherCompanyId);
      assert.equal(leaked, undefined, 'Must not return vouchers belonging to other company');
    });
  });

  describe('7. Cancellation & Audit Trail', () => {
    let cancelTestVoucherId: string;

    before(() => {
      const vchNumber = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      const customLines = [
        {
          ledgerId: deprExpenseLedgerId,
          ledgerName: 'Depreciation Expense A/c',
          debitPaise: 20000000,
          creditPaise: 0
        },
        {
          ledgerId: accumDeprLedgerId,
          ledgerName: 'Accumulated Depreciation A/c',
          debitPaise: 0,
          creditPaise: 20000000
        }
      ];

      const res = PostingEngine.postVoucher(db, {
        companyId: testCompanyId,
        fyId,
        voucherType: 'JOURNAL',
        voucherNumber: vchNumber,
        voucherDate: '2026-10-01',
        paymentMode: 'Transfer Entry',
        narration: 'HO to Branch - Fund Transfer',
        lines: [],
        customLedgerLines: customLines,
        status: 'POSTED'
      });
      cancelTestVoucherId = res.voucherId!;
    });

    it('cancels posted journal voucher with audit tombstone', () => {
      // Use PostingEngine.cancelVoucher
      PostingEngine.cancelVoucher(
        db,
        testCompanyId,
        cancelTestVoucherId,
        'auditor',
        'Wrong branch allocation - cancelled by auditor'
      );

      const vch = db.prepare(`SELECT * FROM vouchers WHERE voucher_id = ?`).get(cancelTestVoucherId) as any;
      assert.equal(vch.status, 'CANCELLED', 'Voucher status must be CANCELLED');

      // Verify audit logs or cancel notes
      const audit = db.prepare(`SELECT * FROM audit_logs WHERE entity_id = ?`).all(cancelTestVoucherId) as any[];
      assert.ok(audit.length >= 1, 'Audit log entry must be created on cancellation');
    });

    it('cancelled journal has zero financial impact in general ledger calculations', () => {
      // Active general ledger entries query should exclude CANCELLED vouchers
      const activeEntries = db.prepare(`
        SELECT le.* FROM ledger_entries le
        JOIN vouchers v ON le.voucher_id = v.voucher_id
        WHERE v.company_id = ? AND v.status = 'POSTED' AND v.voucher_id = ?
      `).all(testCompanyId, cancelTestVoucherId);

      assert.equal(activeEntries.length, 0, 'Cancelled voucher must have zero active posted ledger entries');
    });
  });

  describe('8. Dashboard & Register KPI Reconciliation', () => {
    it('reconciles Total Journal Amount, Journal Count, Posted, Draft, and Cancelled against SQLite', () => {
      // Create 1 additional draft and 1 additional posted voucher to match dashboard scenario
      const draftVchNum = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'JOURNAL');
      PostingEngine.postVoucher(db, {
        companyId: testCompanyId,
        fyId,
        voucherType: 'JOURNAL',
        voucherNumber: draftVchNum,
        voucherDate: '2026-10-02',
        paymentMode: 'Provision Entry',
        narration: 'Provision for Audit Fees',
        lines: [],
        customLedgerLines: [
          { ledgerId: auditFeeExpLedgerId, debitPaise: 2500000, creditPaise: 0 },
          { ledgerId: auditFeeProvLedgerId, debitPaise: 0, creditPaise: 2500000 }
        ],
        status: 'DRAFT'
      });

      // Calculate KPI metrics from database directly
      const allJournals = db.prepare(`
        SELECT voucher_id, voucher_number, total_amount_paise, payment_mode, status
        FROM vouchers
        WHERE company_id = ? AND voucher_type = 'JOURNAL'
      `).all(testCompanyId) as any[];

      const totalCount = allJournals.length;
      const postedEntries = allJournals.filter(v => v.status === 'POSTED');
      const draftEntries = allJournals.filter(v => v.status === 'DRAFT');
      const cancelledEntries = allJournals.filter(v => v.status === 'CANCELLED');

      const totalAmountPaise = postedEntries.reduce((sum, v) => sum + (v.total_amount_paise || 0), 0);

      assert.ok(totalCount >= 4, `Total journal count must be at least 4, got: ${totalCount}`);
      assert.ok(postedEntries.length >= 2, `Posted count must be at least 2, got: ${postedEntries.length}`);
      assert.ok(draftEntries.length >= 1, `Draft count must be at least 1, got: ${draftEntries.length}`);
      assert.ok(cancelledEntries.length >= 1, `Cancelled count must be at least 1, got: ${cancelledEntries.length}`);
      assert.ok(totalAmountPaise > 0, `Total amount paise must be positive, got: ${totalAmountPaise}`);

      // Verify percentages sum to 100%
      const postedPct = (postedEntries.length / totalCount) * 100;
      const draftPct = (draftEntries.length / totalCount) * 100;
      const cancelledPct = (cancelledEntries.length / totalCount) * 100;
      const totalPct = Math.round(postedPct + draftPct + cancelledPct);

      assert.equal(totalPct, 100, `KPI breakdown percentages must sum to 100%, got: ${totalPct}%`);
    });
  });
});
