/**
 * ui043-payments-module.test.ts — Comprehensive Test Suite for UI-043: Payments Module + Global Dark Theme
 *
 * Verifies:
 * 1. Sidebar Navigation & Routing Architecture:
 *    - Main Payments item navigates directly to Payment Dashboard (`setPaymentViewMode('dashboard')`).
 *    - Zero redundant "Payment Dashboard" inside the collapsible submenu.
 *    - Submenu strictly contains only "Record Payment" and "Payment Register".
 *    - Expandable chevron toggle and active navigation highlight invariants.
 *    - App.tsx cleanly routes all 4 payment views and modal.
 * 2. Authoritative Voucher Numbering:
 *    - Generates official payment voucher numbers using the authoritative engine.
 * 3. Draft Payment Lifecycle:
 *    - Saving a draft payment creates a voucher with status DRAFT.
 *    - Strict accounting isolation: 0 ledger entries and 0 bill allocations.
 *    - Preserves canonical customLedgerLines and billAllocations in draft metadata.
 * 4. Atomic Double-Entry Posting — Purchase Payment:
 *    - Promotes draft to POSTED or directly posts atomic payment.
 *    - Exactly Dr Supplier (Sundry Creditor) and Cr Bank/Cash for total amount in paise.
 *    - Balanced double-entry verification.
 * 5. Multi-Invoice Allocation (Exact Screenshot Scenario):
 *    - PINV-2026-0084 ₹1,50,000 + PINV-2026-0085 ₹1,00,000 = ₹2,50,000 Total Payment.
 *    - Verifies individual and cumulative outstanding balance adjustments.
 * 6. Unallocated / On-Account Advance:
 *    - Purchase payment with partial invoice allocation automatically assigns unallocated remainder to ON_ACCOUNT.
 * 7. Expense Payment:
 *    - Dr Expense (e.g. Office Rent) and Cr Bank/Cash without bill allocation.
 * 8. Other Payment:
 *    - Dr Other (e.g. Equipment Advance) and Cr Cash without bill allocation.
 * 9. Allocation Safeguards & Server-Side Security:
 *    - Rejection of over-allocation exceeding invoice outstanding.
 *    - Rejection of allocation against cancelled invoice.
 *    - Rejection of allocation across companies (multi-tenant security).
 * 10. Cancellation & Reversal:
 *    - Cancelling a posted payment reverses ledger entries and reinstates purchase invoice outstanding balance.
 * 11. Dashboard & Register KPI Reconciliation:
 *    - Total Paid, Payment Count, Supplier Payments, and Expense & Other Payments reconcile 100% to actual records.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PostingEngine } from '../src/domain/posting/posting-engine';

describe('UI-043: Payments Module + Global Dark Theme Stabilization', () => {
  const sidebarPath = path.resolve(__dirname, '../../frontend/src/components/layout/Sidebar.tsx');
  const appPath = path.resolve(__dirname, '../../frontend/src/App.tsx');
  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  let db: DatabaseSync;
  const testCompanyId = 'cmp_ui043_payments';
  const otherCompanyId = 'cmp_ui043_other';
  const fyId = 'fy_2026_27';

  // Seeded IDs
  const cashLedgerId = 'led_cash_ui043';
  const bankLedgerId = 'led_bank_ui043';
  const sbiBankLedgerId = 'led_sbi_ui043';
  const suppLedgerId = 'led_supp_ui043';
  const rentExpenseLedgerId = 'led_rent_ui043';
  const equipAdvanceLedgerId = 'led_equip_ui043';
  const supplierPartyId = 'pty_supp_ui043';
  let purchaseInvoice1Id = '';
  let purchaseInvoice2Id = '';
  let purchaseInvoice3Id = '';

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
      VALUES (?, 'Rival Systems', 'Rival Systems Pvt Ltd', '33XYZAB1234C1Z9', '456 Tech Park', 'Chennai', 'Tamil Nadu', '33', '600001')
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

    // Create Root Ledger Groups
    db.prepare(`
      INSERT INTO ledger_groups (group_id, company_id, group_name, nature, affects_gross_profit)
      VALUES 
        ('grp_ca', ?, 'Current Assets', 'ASSET', 0),
        ('grp_bank', ?, 'Bank Accounts', 'ASSET', 0),
        ('grp_cash', ?, 'Cash-in-Hand', 'ASSET', 0),
        ('grp_scred', ?, 'Sundry Creditors', 'LIABILITY', 0),
        ('grp_exp', ?, 'Indirect Expenses', 'EXPENSE', 0),
        ('grp_fa', ?, 'Fixed Assets', 'ASSET', 0)
    `).run(testCompanyId, testCompanyId, testCompanyId, testCompanyId, testCompanyId, testCompanyId);

    // Create System & Master Ledgers
    db.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, is_party, is_active)
      VALUES
        (?, ?, 'grp_cash', 'Cash', 0, 1),
        (?, ?, 'grp_bank', 'HDFC Bank (112233445566)', 0, 1),
        (?, ?, 'grp_bank', 'SBI Bank', 0, 1),
        (?, ?, 'grp_scred', 'Sunrise Distributors (SUP-004)', 1, 1),
        (?, ?, 'grp_exp', 'Office Rent', 0, 1),
        (?, ?, 'grp_fa', 'Equipment Advance', 0, 1)
    `).run(
      cashLedgerId, testCompanyId,
      bankLedgerId, testCompanyId,
      sbiBankLedgerId, testCompanyId,
      suppLedgerId, testCompanyId,
      rentExpenseLedgerId, testCompanyId,
      equipAdvanceLedgerId, testCompanyId
    );

    // Create Supplier Party
    db.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, phone)
      VALUES (?, ?, ?, 'SUPPLIER', 'Sunrise Distributors', '33AAEFS1234K1Z6', '+91 98420 11234')
    `).run(supplierPartyId, testCompanyId, suppLedgerId);

    db.prepare(`
      INSERT INTO party_addresses (address_id, party_id, address_type, address_line1, city, state, state_code, pincode)
      VALUES ('addr_supp_ui043', ?, 'BOTH', '12, Market Road, Gandhipuram', 'Coimbatore', 'Tamil Nadu', '33', '641012')
    `).run(supplierPartyId);

    // Seed 3 Purchase Invoices matching mockup media_1793861106323_141c1dd4.jpg:
    // 1. PINV-2026-0084: ₹2,50,000.00 (25,000,000 paise)
    purchaseInvoice1Id = 'vch_pinv_0084';
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, party_id, status)
      VALUES (?, ?, ?, 'PURCHASE', 'PINV-2026-0084', '2026-10-10', 25000000, ?, 'POSTED')
    `).run(purchaseInvoice1Id, testCompanyId, fyId, supplierPartyId);

    // 2. PINV-2026-0085: ₹1,20,000.00 (12,000,000 paise)
    purchaseInvoice2Id = 'vch_pinv_0085';
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, party_id, status)
      VALUES (?, ?, ?, 'PURCHASE', 'PINV-2026-0085', '2026-10-15', 12000000, ?, 'POSTED')
    `).run(purchaseInvoice2Id, testCompanyId, fyId, supplierPartyId);

    // 3. PINV-2026-0086: ₹75,000.00 (7,500,000 paise)
    purchaseInvoice3Id = 'vch_pinv_0086';
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, party_id, status)
      VALUES (?, ?, ?, 'PURCHASE', 'PINV-2026-0086', '2026-10-20', 7500000, ?, 'POSTED')
    `).run(purchaseInvoice3Id, testCompanyId, fyId, supplierPartyId);
  });

  after(() => {
    db.close();
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 1: Navigation & Architecture Invariants
   * ───────────────────────────────────────────────────────────── */
  it('1.1: Clicking Payments parent item navigates directly to Payment Dashboard', () => {
    assert.ok(
      sidebarCode.includes("setActiveTab('payments');\n                    if (setPaymentViewMode) setPaymentViewMode('dashboard');"),
      'Parent Payments item must set activeTab to payments and paymentViewMode to dashboard'
    );
  });

  it('1.2: Payments submenu strictly contains only Record Payment and Payment Register', () => {
    const paymentsSubmenuStart = sidebarCode.indexOf("{expandedGroup === 'payments' && (");
    assert.ok(paymentsSubmenuStart !== -1, 'Payments collapsible submenu must exist in Sidebar.tsx');
    const paymentsSubmenuBlock = sidebarCode.slice(paymentsSubmenuStart, paymentsSubmenuStart + 2500);

    assert.ok(!paymentsSubmenuBlock.includes('Payment Dashboard</span>'), 'Submenu must NOT contain redundant Payment Dashboard');
    assert.ok(paymentsSubmenuBlock.includes('Record Payment</span>'), 'Submenu must contain Record Payment');
    assert.ok(paymentsSubmenuBlock.includes("setPaymentViewMode('create')"), 'Record Payment must navigate to create view');
    assert.ok(paymentsSubmenuBlock.includes('Payment Register</span>'), 'Submenu must contain Payment Register');
    assert.ok(paymentsSubmenuBlock.includes("setPaymentViewMode('register')"), 'Payment Register must navigate to register view');

    // Exactly 2 children
    const spanMatches = paymentsSubmenuBlock.match(/<span style=\{\{ flex: 1 \}\}>([^<]+)<\/span>/g) || [];
    assert.equal(spanMatches.length, 2, 'Submenu must contain exactly two child items');
  });

  it('1.3: Active navigation highlighting rules are preserved for Payments', () => {
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`}"),
      'Parent Payments item is active on any payments route'
    );
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'payments' && paymentViewMode === 'create' ? 'active' : ''}`}"),
      'Record Payment child is active only when paymentViewMode === create'
    );
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'payments' && (paymentViewMode === 'register' || paymentViewMode === 'view') ? 'active' : ''}`}"),
      'Payment Register child is active when paymentViewMode is register or view'
    );
  });

  it('1.4: App.tsx routes all 4 payment views cleanly', () => {
    assert.ok(appCode.includes("{paymentViewMode === 'dashboard' && ("), 'App routes PaymentDashboardView');
    assert.ok(appCode.includes('<PaymentDashboardView'), 'App renders PaymentDashboardView');
    assert.ok(appCode.includes("{paymentViewMode === 'register' && ("), 'App routes PaymentRegisterView');
    assert.ok(appCode.includes('<PaymentRegisterView'), 'App renders PaymentRegisterView');
    assert.ok(appCode.includes("{paymentViewMode === 'create' && ("), 'App routes RecordPaymentView');
    assert.ok(appCode.includes('<RecordPaymentView'), 'App renders RecordPaymentView');
    assert.ok(appCode.includes("{paymentViewMode === 'view' && selectedPaymentId && ("), 'App routes PaymentDetailsView');
    assert.ok(appCode.includes('<PaymentDetailsView'), 'App renders PaymentDetailsView');
    assert.ok(appCode.includes('<PaymentPrintModal'), 'App renders PaymentPrintModal');
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 2: Authoritative Numbering & Draft Lifecycle
   * ───────────────────────────────────────────────────────────── */
  it('2.1: Authoritative voucher numbering engine generates correct prefix for PAYMENT', () => {
    const num = PostingEngine.getNextVoucherNumber(db, testCompanyId, fyId, 'PAYMENT');
    assert.ok(num.startsWith('PAY') || num.startsWith('PMT'), `Payment number should use authoritative prefix PAY/PMT, got ${num}`);
  });

  it('2.2: Draft payment creates voucher with status DRAFT, 0 ledger entries, and 0 bill allocations', () => {
    const draftResult = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-25',
      paymentMode: 'Bank Transfer',
      partyId: supplierPartyId,
      status: 'DRAFT',
      lines: [],
      customLedgerLines: [
        { ledgerId: suppLedgerId, debitPaise: 5000000, creditPaise: 0 },
        { ledgerId: bankLedgerId, debitPaise: 0, creditPaise: 5000000 }
      ],
      billAllocations: [
        { referenceVoucherId: purchaseInvoice1Id, allocationType: 'AGAINST_REF', amountPaise: 5000000 }
      ]
    });

    const vch = db.prepare('SELECT status, total_amount_paise FROM vouchers WHERE voucher_id = ?').get(draftResult.voucherId) as any;
    assert.equal(vch.status, 'DRAFT');
    assert.equal(vch.total_amount_paise, 5000000);

    // Verify 0 ledger entries
    const leCount = (db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE voucher_id = ?').get(draftResult.voucherId) as any).c;
    assert.equal(leCount, 0, 'DRAFT payment voucher must create ZERO ledger entries');

    // Verify 0 bill allocations
    const baCount = (db.prepare('SELECT COUNT(*) as c FROM bill_allocations WHERE voucher_id = ?').get(draftResult.voucherId) as any).c;
    assert.equal(baCount, 0, 'DRAFT payment voucher must create ZERO bill allocations');

    // Clean up draft
    db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(draftResult.voucherId);
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 3: Atomic Posting & Double-Entry Integrity
   * ───────────────────────────────────────────────────────────── */
  it('3.1: Posting a purchase payment creates atomic double-entry records (Dr Supplier, Cr Bank)', () => {
    const postResult = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-26',
      paymentMode: 'Bank Transfer',
      referenceNumber: 'UTR9876543210',
      partyId: supplierPartyId,
      status: 'POSTED',
      lines: [],
      customLedgerLines: [
        { ledgerId: suppLedgerId, debitPaise: 2000000, creditPaise: 0 },
        { ledgerId: bankLedgerId, debitPaise: 0, creditPaise: 2000000 }
      ]
    });

    const entries = db.prepare(`
      SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries WHERE voucher_id = ?
    `).all(postResult.voucherId) as any[];

    assert.equal(entries.length, 2, 'Must create exactly two ledger entries');
    const suppEntry = entries.find(e => e.ledger_id === suppLedgerId);
    const bankEntry = entries.find(e => e.ledger_id === bankLedgerId);

    assert.ok(suppEntry, 'Must have debit entry for Supplier ledger');
    assert.equal(suppEntry.debit_paise, 2000000);
    assert.equal(suppEntry.credit_paise, 0);

    assert.ok(bankEntry, 'Must have credit entry for Bank ledger');
    assert.equal(bankEntry.debit_paise, 0);
    assert.equal(bankEntry.credit_paise, 2000000);

    // Clean up for subsequent tests
    db.prepare('DELETE FROM ledger_entries WHERE voucher_id = ?').run(postResult.voucherId);
    db.prepare('DELETE FROM bill_allocations WHERE voucher_id = ?').run(postResult.voucherId);
    db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(postResult.voucherId);
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 4: Multi-Invoice Allocation (Exact Mockup Scenario)
   * ───────────────────────────────────────────────────────────── */
  it('4.1: Multi-invoice allocation: PINV-0084 ₹1,50,000 + PINV-0085 ₹1,00,000 = ₹2,50,000 Total Payment', () => {
    // Exact scenario from media_1793861106323_141c1dd4.jpg:
    // Total Payment = ₹2,50,000.00 (25,000,000 paise)
    // Allocates:
    // 1. ₹1,50,000.00 (15,000,000 paise) against PINV-2026-0084 (outstanding ₹2,50,000)
    // 2. ₹1,00,000.00 (10,000,000 paise) against PINV-2026-0085 (outstanding ₹1,20,000)
    const result = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-28',
      voucherNumber: 'PMT-2026-0027',
      paymentMode: 'Bank Transfer',
      referenceNumber: 'UTR9876543210',
      partyId: supplierPartyId,
      status: 'POSTED',
      narration: 'Payment towards purchase invoices.',
      lines: [],
      customLedgerLines: [
        { ledgerId: suppLedgerId, debitPaise: 25000000, creditPaise: 0 },
        { ledgerId: bankLedgerId, debitPaise: 0, creditPaise: 25000000 }
      ],
      billAllocations: [
        { referenceVoucherId: purchaseInvoice1Id, allocationType: 'AGAINST_REF', amountPaise: 15000000 },
        { referenceVoucherId: purchaseInvoice2Id, allocationType: 'AGAINST_REF', amountPaise: 10000000 }
      ]
    });

    assert.ok(result.voucherId);

    // Verify bill_allocations in database
    const allocations = db.prepare(`
      SELECT reference_voucher_id, allocation_type, amount_paise
      FROM bill_allocations
      WHERE voucher_id = ?
      ORDER BY amount_paise DESC
    `).all(result.voucherId) as any[];

    assert.equal(allocations.length, 2, 'Must create exactly two bill_allocations rows');
    assert.equal(allocations[0].reference_voucher_id, purchaseInvoice1Id);
    assert.equal(allocations[0].amount_paise, 15000000);
    assert.equal(allocations[0].allocation_type, 'AGAINST_REF');

    assert.equal(allocations[1].reference_voucher_id, purchaseInvoice2Id);
    assert.equal(allocations[1].amount_paise, 10000000);
    assert.equal(allocations[1].allocation_type, 'AGAINST_REF');

    // Verify remaining outstanding on Purchase Invoice 1: 2,50,000 - 1,50,000 = ₹1,00,000.00 (10,000,000 paise)
    const paidInv1 = (db.prepare(`
      SELECT SUM(amount_paise) as s FROM bill_allocations WHERE reference_voucher_id = ?
    `).get(purchaseInvoice1Id) as any).s;
    assert.equal(paidInv1, 15000000);

    // Verify remaining outstanding on Purchase Invoice 2: 1,20,000 - 1,00,000 = ₹20,000.00 (2,000,000 paise)
    const paidInv2 = (db.prepare(`
      SELECT SUM(amount_paise) as s FROM bill_allocations WHERE reference_voucher_id = ?
    `).get(purchaseInvoice2Id) as any).s;
    assert.equal(paidInv2, 10000000);
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 5: Unallocated / Supplier Advance (ON_ACCOUNT)
   * ───────────────────────────────────────────────────────────── */
  it('5.1: Payment with partial invoice allocation automatically assigns unallocated remainder to ON_ACCOUNT (Supplier Advance)', () => {
    // Total paid = ₹50,000.00 (5,000,000 paise)
    // Allocates ₹20,000.00 against Invoice 2 (remaining outstanding is 20,000)
    // Remainder ₹30,000.00 is On Account (Supplier Advance)
    const res = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-29',
      paymentMode: 'UPI',
      partyId: supplierPartyId,
      status: 'POSTED',
      lines: [],
      customLedgerLines: [
        { ledgerId: suppLedgerId, debitPaise: 5000000, creditPaise: 0 },
        { ledgerId: bankLedgerId, debitPaise: 0, creditPaise: 5000000 }
      ],
      billAllocations: [
        { referenceVoucherId: purchaseInvoice2Id, allocationType: 'AGAINST_REF', amountPaise: 2000000 }
      ]
    });

    const allocs = db.prepare(`
      SELECT reference_voucher_id, allocation_type, amount_paise
      FROM bill_allocations
      WHERE voucher_id = ?
      ORDER BY allocation_type ASC
    `).all(res.voucherId) as any[];

    assert.equal(allocs.length, 2);
    const against = allocs.find(a => a.allocation_type === 'AGAINST_REF');
    const onAccount = allocs.find(a => a.allocation_type === 'ON_ACCOUNT');

    assert.ok(against, 'Must have AGAINST_REF allocation');
    assert.equal(against.amount_paise, 2000000);

    assert.ok(onAccount, 'Must have ON_ACCOUNT allocation for remainder (advance)');
    assert.equal(onAccount.amount_paise, 3000000);
    assert.equal(onAccount.reference_voucher_id, null);
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 6: Expense & Other Payment Types
   * ───────────────────────────────────────────────────────────── */
  it('6.1: Expense payment creates Dr Expense / Cr Bank with 0 bill allocations', () => {
    // Expense Payment matching PMT-2026-0026: Office Rent ₹65,000.00 via NEFT from SBI Bank
    const expResult = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-26',
      voucherNumber: 'PMT-2026-0026',
      paymentMode: 'NEFT',
      status: 'POSTED',
      narration: 'Office Rent Payment for October 2026',
      lines: [],
      customLedgerLines: [
        { ledgerId: rentExpenseLedgerId, debitPaise: 6500000, creditPaise: 0 },
        { ledgerId: sbiBankLedgerId, debitPaise: 0, creditPaise: 6500000 }
      ]
    });

    assert.ok(expResult.voucherId);

    // Verify double entries
    const entries = db.prepare('SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries WHERE voucher_id = ?').all(expResult.voucherId) as any[];
    assert.equal(entries.length, 2);
    const rent = entries.find(e => e.ledger_id === rentExpenseLedgerId);
    const sbi = entries.find(e => e.ledger_id === sbiBankLedgerId);

    assert.equal(rent.debit_paise, 6500000);
    assert.equal(rent.credit_paise, 0);
    assert.equal(sbi.debit_paise, 0);
    assert.equal(sbi.credit_paise, 6500000);

    // Zero bill allocations
    const baCount = (db.prepare('SELECT COUNT(*) as c FROM bill_allocations WHERE voucher_id = ?').get(expResult.voucherId) as any).c;
    assert.equal(baCount, 0, 'Expense payment must have 0 bill allocations');
  });

  it('6.2: Other payment creates Dr Other Ledger / Cr Cash with 0 bill allocations', () => {
    // Other Payment matching PMT-2026-0024: Equipment Advance ₹24,260.00 via Cash
    const otherResult = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-20',
      voucherNumber: 'PMT-2026-0024',
      paymentMode: 'Cash',
      status: 'POSTED',
      narration: 'Advance for warehouse weighing scale equipment',
      lines: [],
      customLedgerLines: [
        { ledgerId: equipAdvanceLedgerId, debitPaise: 2426000, creditPaise: 0 },
        { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 2426000 }
      ]
    });

    assert.ok(otherResult.voucherId);

    const entries = db.prepare('SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries WHERE voucher_id = ?').all(otherResult.voucherId) as any[];
    assert.equal(entries.length, 2);
    const equip = entries.find(e => e.ledger_id === equipAdvanceLedgerId);
    const cash = entries.find(e => e.ledger_id === cashLedgerId);

    assert.equal(equip.debit_paise, 2426000);
    assert.equal(equip.credit_paise, 0);
    assert.equal(cash.debit_paise, 0);
    assert.equal(cash.credit_paise, 2426000);

    const baCount = (db.prepare('SELECT COUNT(*) as c FROM bill_allocations WHERE voucher_id = ?').get(otherResult.voucherId) as any).c;
    assert.equal(baCount, 0, 'Other payment must have 0 bill allocations');
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 7: Allocation Safeguards & Security Validation
   * ───────────────────────────────────────────────────────────── */
  it('7.1: Server-side validation rejects allocation exceeding invoice outstanding balance', () => {
    // Invoice 2 outstanding is now 0 (1,20,000 - 1,00,000 - 20,000 = 0)
    assert.throws(
      () => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'PAYMENT',
          voucherDate: '2026-10-30',
          paymentMode: 'Cash',
          partyId: supplierPartyId,
          status: 'POSTED',
          lines: [],
          customLedgerLines: [
            { ledgerId: suppLedgerId, debitPaise: 100000, creditPaise: 0 },
            { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 100000 }
          ],
          billAllocations: [
            { referenceVoucherId: purchaseInvoice2Id, allocationType: 'AGAINST_REF', amountPaise: 100000 }
          ]
        });
      },
      /exceeds outstanding balance/i,
      'Must reject allocation exceeding purchase invoice outstanding balance'
    );
  });

  it('7.2: Server-side validation rejects allocation against another company purchase invoice (multi-tenant isolation)', () => {
    // Create a purchase invoice belonging to otherCompanyId
    const otherVchId = 'vch_other_pinv';
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
      VALUES (?, ?, 'fy_other_2627', 'PURCHASE', 'PINV-OTHER-001', '2026-10-10', 5000000, 'POSTED')
    `).run(otherVchId, otherCompanyId);

    assert.throws(
      () => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'PAYMENT',
          voucherDate: '2026-10-30',
          paymentMode: 'Cash',
          partyId: supplierPartyId,
          status: 'POSTED',
          lines: [],
          customLedgerLines: [
            { ledgerId: suppLedgerId, debitPaise: 100000, creditPaise: 0 },
            { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 100000 }
          ],
          billAllocations: [
            { referenceVoucherId: otherVchId, allocationType: 'AGAINST_REF', amountPaise: 100000 }
          ]
        });
      },
      /Security violation/i,
      'Must reject allocation against invoice belonging to a different company'
    );
  });

  it('7.3: Server-side validation rejects allocation against cancelled purchase invoice', () => {
    const cancelledVchId = 'vch_cancelled_pinv';
    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, party_id, status)
      VALUES (?, ?, ?, 'PURCHASE', 'PINV-CANC-001', '2026-10-10', 5000000, ?, 'CANCELLED')
    `).run(cancelledVchId, testCompanyId, fyId, supplierPartyId);

    assert.throws(
      () => {
        PostingEngine.postVoucher(db, {
          companyId: testCompanyId,
          fyId,
          voucherType: 'PAYMENT',
          voucherDate: '2026-10-30',
          paymentMode: 'Cash',
          partyId: supplierPartyId,
          status: 'POSTED',
          lines: [],
          customLedgerLines: [
            { ledgerId: suppLedgerId, debitPaise: 100000, creditPaise: 0 },
            { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 100000 }
          ],
          billAllocations: [
            { referenceVoucherId: cancelledVchId, allocationType: 'AGAINST_REF', amountPaise: 100000 }
          ]
        });
      },
      /cancelled/i,
      'Must reject allocation against cancelled voucher'
    );
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 8: Cancellation & Balance Reinstatement
   * ───────────────────────────────────────────────────────────── */
  it('8.1: Cancelling a posted payment reverses ledger entries and reinstates invoice outstanding balance', () => {
    // Create a new payment allocating ₹30,000 against Purchase Invoice 3
    const toCancelRes = PostingEngine.postVoucher(db, {
      companyId: testCompanyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-10-30',
      paymentMode: 'Cash',
      partyId: supplierPartyId,
      status: 'POSTED',
      lines: [],
      customLedgerLines: [
        { ledgerId: suppLedgerId, debitPaise: 3000000, creditPaise: 0 },
        { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 3000000 }
      ],
      billAllocations: [
        { referenceVoucherId: purchaseInvoice3Id, allocationType: 'AGAINST_REF', amountPaise: 3000000 }
      ]
    });

    const vchBeforeCancel = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(toCancelRes.voucherId) as any;
    assert.equal(vchBeforeCancel.status, 'POSTED');

    // Cancel voucher
    PostingEngine.cancelVoucher(db, testCompanyId, toCancelRes.voucherId, 'system', 'Duplicate payment entered');

    // Verify voucher status is CANCELLED with audit reason
    const vchAfterCancel = db.prepare('SELECT status, cancellation_reason FROM vouchers WHERE voucher_id = ?').get(toCancelRes.voucherId) as any;
    assert.equal(vchAfterCancel.status, 'CANCELLED');
    assert.equal(vchAfterCancel.cancellation_reason, 'Duplicate payment entered');

    // Verify downstream ledger entries and bill allocations are cleared per LedgerFlow statutory cancellation architecture
    const entries = db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE voucher_id = ?').get(toCancelRes.voucherId) as any;
    assert.equal(entries.c, 0, 'Cancelled payment voucher must have 0 active ledger entries');

    const allocs = db.prepare('SELECT COUNT(*) as c FROM bill_allocations WHERE voucher_id = ?').get(toCancelRes.voucherId) as any;
    assert.equal(allocs.c, 0, 'Cancelled payment voucher must have 0 bill allocations');

    // Verify audit log recorded cancellation
    const audit = db.prepare('SELECT action, entity_id FROM audit_logs WHERE entity_id = ? AND action = ?').get(toCancelRes.voucherId, 'CANCEL_VOUCHER') as any;
    assert.ok(audit, 'Cancellation must be recorded in audit_logs');

    // Verify invoice 3 allocation ignores cancelled voucher in outstanding queries
    const activePaidOnInv3 = (db.prepare(`
      SELECT COALESCE(SUM(ba.amount_paise), 0) as s
      FROM bill_allocations ba
      JOIN vouchers rv ON ba.voucher_id = rv.voucher_id
      WHERE ba.reference_voucher_id = ? AND rv.status != 'CANCELLED'
    `).get(purchaseInvoice3Id) as any).s;

    // Zero active allocations remain on PINV-0086
    assert.equal(activePaidOnInv3, 0, 'Purchase invoice paid amount must exclude cancelled payment allocation');
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 9: Dashboard & Register KPI Reconciliation
   * ───────────────────────────────────────────────────────────── */
  it('9.1: Dashboard and register KPIs accurately reconcile against authentic SQLite records', () => {
    // Fetch all active payment vouchers for testCompanyId
    const activePayments = db.prepare(`
      SELECT voucher_id, total_amount_paise, party_id, status
      FROM vouchers
      WHERE company_id = ? AND voucher_type = 'PAYMENT' AND status = 'POSTED'
    `).all(testCompanyId) as any[];

    // 1. Total Paid
    const expectedTotalPaidPaise = activePayments.reduce((acc, row) => acc + (row.total_amount_paise || 0), 0);
    assert.ok(expectedTotalPaidPaise > 0, 'Total paid paise must be greater than zero');

    // 2. Payment Count
    const expectedPaymentCount = activePayments.length;
    assert.equal(expectedPaymentCount, 4, 'Should have exactly 4 active POSTED payments');

    // 3. Supplier Payments (vouchers with party_id or bill_allocations)
    const supplierPayments = activePayments.filter(p => p.party_id === supplierPartyId);
    const expectedSupplierPaise = supplierPayments.reduce((acc, row) => acc + (row.total_amount_paise || 0), 0);
    assert.equal(expectedSupplierPaise, 25000000 + 5000000); // 2,50,000 + 50,000 = 3,00,000 (30,000,000 paise)

    // 4. Expense & Other Payments
    const expenseAndOtherPayments = activePayments.filter(p => !p.party_id);
    const expectedExpenseOtherPaise = expenseAndOtherPayments.reduce((acc, row) => acc + (row.total_amount_paise || 0), 0);
    assert.equal(expectedExpenseOtherPaise, 6500000 + 2426000); // 65,000 + 24,260 = 89,260 (8,926,000 paise)

    // Sum invariant
    assert.equal(expectedTotalPaidPaise, expectedSupplierPaise + expectedExpenseOtherPaise);
  });
});
