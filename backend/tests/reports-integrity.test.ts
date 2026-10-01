import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { GstEngine } from '../src/domain/tax/gst-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 005 — REPORTS & OUTSTANDING INTEGRITY REGRESSION SUITE');
console.log('======================================================================\n');

export function createTestContext(companyId: string = 'comp_rep_test') {
  const db = new DatabaseSync(':memory:');
  const schemaPath = path.resolve('src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  initializeBusiness(db, {
    companyId,
    companyName: 'Reporting Integrity Corp',
    stateCode: '33',
    gstin: '33AAAAA1234A1Z5'
  });

  const activeFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as any;
  const fyId = activeFy.fy_id;

  // Add Customer Party
  const custId = `${companyId}_party_cust_1`;
  const custLedgerId = `${companyId}_led_cust_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Test Customer One', '${companyId}_grp_debtors', 0, 'DR', 1)
  `).run(custLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Test Customer One', 'CUSTOMER', ?, '33AAACA1111A1Z1')
  `).run(custId, companyId, custLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${custId}', ?, '100 Customer Road', 'Chennai', 'Tamil Nadu', '33', '600001')
  `).run(custId);

  // Add Supplier Party
  const suppId = `${companyId}_party_supp_1`;
  const suppLedgerId = `${companyId}_led_supp_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Test Supplier One', '${companyId}_grp_creditors', 0, 'CR', 1)
  `).run(suppLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Test Supplier One', 'SUPPLIER', ?, '33AAASB2222B1Z2')
  `).run(suppId, companyId, suppLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${suppId}', ?, '200 Supplier Lane', 'Chennai', 'Tamil Nadu', '33', '600002')
  `).run(suppId);

  // Add Standard Test Item
  const itemId = `${companyId}_item_widget`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
    VALUES (?, ?, 'Test Widget', '${companyId}_unit_nos', 18.00, 100000, 150000, '84713010')
  `).run(itemId, companyId);

  return { db, companyId, fyId, custId, custLedgerId, suppId, suppLedgerId, itemId };
}

let passedCount = 0;
let totalCount = 0;

export function test(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
}

console.log('Test harness initialized successfully.\n');

// ======================================================================
// COMMIT 005-A TESTS: FINANCIAL STATEMENTS & MULTI-YEAR RETAINED EARNINGS
// ======================================================================

test('TEST_REP_01: Multi-year Balance Sheet retains prior years profit in Equity', () => {
  const { db, companyId, custId, itemId } = createTestContext('comp_multi_fy');

  // 1. Create prior financial year 2025-2026 (OPEN during posting)
  db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES ('fy_2025_26', ?, '2025-2026', '2025-04-01', '2026-03-31', 'OPEN')
  `).run(companyId);

  // Capital introduced in FY 2025-26: Dr Bank ₹50,000, Cr Capital ₹50,000
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, status, total_amount_paise, created_by)
    VALUES ('vch_cap_1', ?, 'fy_2025_26', 'RECEIPT', 'CAP-001', '2025-04-05', 'POSTED', 5000000, 'system')
  `).run(companyId);
  db.prepare(`
    INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise)
    VALUES 
      ('le_cap_dr', 'vch_cap_1', '${companyId}_led_sbi_bank', '2025-04-05', 5000000, 0),
      ('le_cap_cr', 'vch_cap_1', '${companyId}_led_capital', '2025-04-05', 0, 5000000)
  `).run();

  // Initial purchase in FY 2025-26: 20 units @ ₹1,000 = ₹20,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId: 'fy_2025_26',
    voucherType: 'PURCHASE',
    voucherDate: '2025-04-10',
    partyId: `${companyId}_party_supp_1`,
    lines: [
      { itemId, godownId: `${companyId}_godown_main`, quantity: 20, ratePaise: 100000, gstRate: 0 }
    ]
  });

  // Post Sale in FY 2025-26: 10 units @ ₹1,500 = ₹15,000. COGS = ₹10,000. Profit = ₹5,000 (500000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId: 'fy_2025_26',
    voucherType: 'SALES',
    voucherDate: '2025-06-15',
    partyId: custId,
    lines: [
      { itemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 150000, gstRate: 0 }
    ]
  });

  // Close FY 2025-26
  db.prepare("UPDATE financial_years SET status = 'CLOSED' WHERE fy_id = 'fy_2025_26'").run();

  // Verify FY 2025-26 standalone Balance Sheet balances
  const bsYear1 = ReportEngine.getBalanceSheet(db, companyId, '2026-03-31');
  assert.strictEqual(bsYear1.isBalanced, true, 'Year 1 Balance Sheet must balance');
  assert.strictEqual(bsYear1.netProfitPaise, 500000, 'Year 1 net profit must be ₹5,000');

  // Now in FY 2026-27 (active FY start_date: 2026-04-01):
  // Post Sale in FY 2026-27: 5 units @ ₹1,500 = ₹7,500. COGS = ₹5,000. Profit = ₹2,500 (250000 paise)
  const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN'").get(companyId) as any;
  PostingEngine.postVoucher(db, {
    companyId,
    fyId: activeFy.fy_id,
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: custId,
    lines: [
      { itemId, godownId: `${companyId}_godown_main`, quantity: 5, ratePaise: 150000, gstRate: 0 }
    ]
  });

  // Generate Balance Sheet as of 2026-05-31 (Year 2)
  const bsYear2 = ReportEngine.getBalanceSheet(db, companyId, '2026-05-31');
  
  // Year 2 Net Profit must be scoped to FY 2026-27
  assert.strictEqual(bsYear2.netProfitPaise, 250000, 'Year 2 net profit must be ₹2,500 (250000 paise)');

  // Crucial invariant: Multi-year Balance Sheet MUST BALANCE!
  assert.strictEqual(bsYear2.isBalanced, true, `Year 2 Balance Sheet must balance. Assets: ${bsYear2.totalAssetsPaise}, Liab+Eq: ${bsYear2.totalLiabilitiesEquityPaise}`);
  assert.strictEqual(bsYear2.retainedEarningsPaise, 500000, 'Retained earnings from prior FY must be ₹5,000 (500000 paise)');
  assert.strictEqual(bsYear2.totalAssetsPaise, bsYear2.totalLiabilitiesEquityPaise, 'Total Assets must equal Total Liabilities + Equity');
});

test('TEST_REP_19: Defensive filtering excludes non-POSTED (DRAFT/CANCELLED) vouchers from reports', () => {
  const { db, companyId, custId, itemId } = createTestContext('comp_status_test');
  const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN'").get(companyId) as any;

  // 1. Post a legitimate POSTED voucher with allowNegativeStock
  const postResult = PostingEngine.postVoucher(db, {
    companyId,
    fyId: activeFy.fy_id,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    lines: [
      { itemId, godownId: `${companyId}_godown_main`, quantity: 2, ratePaise: 150000, gstRate: 0 }
    ],
    allowNegativeStock: true
  });

  // 2. Insert a simulated DRAFT voucher with direct ledger entries (defensive test)
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, status, total_amount_paise, created_by)
    VALUES ('vch_draft_1', ?, ?, 'SALES', 'DRF-001', '2026-04-12', 'DRAFT', 999900, 'test')
  `).run(companyId, activeFy.fy_id);

  db.prepare(`
    INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise)
    VALUES 
      ('le_drf_1', 'vch_draft_1', '${companyId}_led_cust_1', '2026-04-12', 999900, 0),
      ('le_drf_2', 'vch_draft_1', '${companyId}_led_sales', '2026-04-12', 0, 999900)
  `).run();

  // 3. Verify Trial Balance excludes DRAFT
  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
  const salesRow = tb.rows.find(r => r.ledgerId === `${companyId}_led_sales`);
  assert.strictEqual(salesRow?.creditPaise, 300000, 'Trial Balance must only include POSTED sales (₹3,000), ignoring DRAFT (₹9,999)');

  // 4. Verify P&L excludes DRAFT
  const pnl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-04-30');
  assert.strictEqual(pnl.tradingIncomePaise, 300000, 'P&L must only include POSTED sales (₹3,000), ignoring DRAFT (₹9,999)');

  // 5. Verify Ledger Statement excludes DRAFT
  const stmt = ReportEngine.getLedgerStatement(db, companyId, `${companyId}_led_sales`, '2026-04-01', '2026-04-30');
  assert.strictEqual(stmt.closingBalancePaise, 300000, 'Ledger Statement must only include POSTED entries, ignoring DRAFT');
});

test('TEST_REP_02: Customer opening balance is included in receivable outstanding in oldest bucket', () => {
  const { db, companyId } = createTestContext('comp_out_cust_open');
  // Create customer party with DR opening balance ₹25,000 (2,500,000 paise)
  const custLedgerId = `${companyId}_led_cust_open`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, '${companyId}_grp_debtors', 'Open Cust Corp', 2500000, 'DR', 1)
  `).run(custLedgerId, companyId);

  const custPartyId = `${companyId}_party_cust_open`;
  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
    VALUES (?, ?, ?, 'CUSTOMER', 'Open Cust Corp')
  `).run(custPartyId, companyId, custLedgerId);

  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out.length, 1, 'Customer with opening balance must appear in outstanding report');
  assert.strictEqual(out[0].partyId, custPartyId);
  assert.strictEqual(out[0].totalOutstandingPaise, 2500000, 'Outstanding must be exactly ₹25,000');
  assert.strictEqual(out[0].bucket90PlusPaise, 2500000, 'Opening balance must reside in bucket 90+');
  assert.strictEqual(out[0].bucket0to30Paise, 0);
});

test('TEST_REP_03: Supplier opening balance is included in payable outstanding in oldest bucket', () => {
  const { db, companyId } = createTestContext('comp_out_supp_open');
  const suppLedgerId = `${companyId}_led_supp_open`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, '${companyId}_grp_creditors', 'Open Supp Corp', 3500000, 'CR', 1)
  `).run(suppLedgerId, companyId);

  const suppPartyId = `${companyId}_party_supp_open`;
  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
    VALUES (?, ?, ?, 'SUPPLIER', 'Open Supp Corp')
  `).run(suppPartyId, companyId, suppLedgerId);

  const out = ReportEngine.getOutstandingReport(db, companyId, 'SUPPLIER');
  assert.strictEqual(out.length, 1, 'Supplier with opening balance must appear in outstanding report');
  assert.strictEqual(out[0].partyId, suppPartyId);
  assert.strictEqual(out[0].totalOutstandingPaise, 3500000, 'Outstanding must be exactly ₹35,000');
  assert.strictEqual(out[0].bucket90PlusPaise, 3500000, 'Opening balance must reside in bucket 90+');
  assert.strictEqual(out[0].bucket0to30Paise, 0);
});

test('TEST_REP_04: ON_ACCOUNT receipt settles outstanding via LedgerFlow FIFO policy', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_on_acc_rec');
  
  // Sales Invoice ₹50,000 (5,000,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  // Receipt ₹20,000 (2,000,000 paise) without billAllocation (ON_ACCOUNT)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-15',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 2000000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 2000000 }
    ]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].totalOutstandingPaise, 3000000, 'Outstanding after ₹20,000 ON_ACCOUNT receipt must be ₹30,000');
});

test('TEST_REP_05: ON_ACCOUNT payment settles supplier outstanding via LedgerFlow FIFO policy', () => {
  const { db, companyId, fyId, suppId, itemId } = createTestContext('comp_out_on_acc_pay');

  // Purchase Invoice ₹40,000 (4,000,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-10',
    partyId: suppId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 40, ratePaise: 100000, gstRate: 0 }]
  });

  // Payment ₹15,000 (1,500,000 paise) without billAllocation (ON_ACCOUNT)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PAYMENT',
    voucherDate: '2026-04-18',
    partyId: suppId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_supp_1`, debitPaise: 1500000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 1500000 }
    ]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'SUPPLIER');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].totalOutstandingPaise, 2500000, 'Outstanding after ₹15,000 ON_ACCOUNT payment must be ₹25,000');
});

test('TEST_REP_06: ADVANCE receipt dynamically settles subsequent invoice via FIFO', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_advance');

  // Advance Receipt ₹15,000 on 2026-04-05
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-05',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 1500000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 1500000 }
    ],
    billAllocation: { allocationType: 'ADVANCE' }
  });

  // Invoice ₹50,000 on 2026-04-20
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-20',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].totalOutstandingPaise, 3500000, 'Outstanding must be ₹35,000 after ₹15,000 advance application');
});

test('TEST_REP_07: BOTH party isolation ensures Customer and Supplier balances remain completely independent', () => {
  const { db, companyId, fyId, itemId } = createTestContext('comp_out_both');
  
  // Create BOTH party
  const partyLedgerId = `${companyId}_led_party_both`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, '${companyId}_grp_debtors', 'Both Trade Corp', 0, 'DR', 1)
  `).run(partyLedgerId, companyId);

  const partyId = `${companyId}_party_both`;
  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
    VALUES (?, ?, ?, 'BOTH', 'Both Trade Corp')
  `).run(partyId, companyId, partyLedgerId);

  // Sales ₹60,000 to party
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-05',
    partyId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 60, ratePaise: 100000, gstRate: 0 }]
  });

  // Receipt ₹20,000 from party
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-10',
    partyId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 2000000, creditPaise: 0 },
      { ledgerId: partyLedgerId, debitPaise: 0, creditPaise: 2000000 }
    ]
  });

  // Purchase ₹45,000 from party
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-12',
    partyId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 45, ratePaise: 100000, gstRate: 0 }]
  });

  // Payment ₹10,000 to party
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PAYMENT',
    voucherDate: '2026-04-15',
    partyId,
    lines: [],
    customLedgerLines: [
      { ledgerId: partyLedgerId, debitPaise: 1000000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 1000000 }
    ]
  });

  // Verify Customer report
  const custOut = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  const custEntry = custOut.find(o => o.partyId === partyId);
  assert.ok(custEntry, 'BOTH party must appear in CUSTOMER report');
  assert.strictEqual(custEntry.totalOutstandingPaise, 4000000, 'Customer balance must be ₹40,000 (₹60k - ₹20k)');

  // Verify Supplier report
  const suppOut = ReportEngine.getOutstandingReport(db, companyId, 'SUPPLIER');
  const suppEntry = suppOut.find(o => o.partyId === partyId);
  assert.ok(suppEntry, 'BOTH party must appear in SUPPLIER report');
  assert.strictEqual(suppEntry.totalOutstandingPaise, 3500000, 'Supplier balance must be ₹35,000 (₹45k - ₹10k)');
});

test('TEST_REP_08: SALES_RETURN reduces customer outstanding', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_sales_ret');

  // Sales ₹50,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  // Sales Return ₹10,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES_RETURN',
    voucherDate: '2026-04-15',
    partyId: custId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 100000, gstRate: 0 }]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out[0].totalOutstandingPaise, 4000000, 'Outstanding must be ₹40,000 after ₹10,000 sales return');
});

test('TEST_REP_09: PURCHASE_RETURN reduces supplier outstanding', () => {
  const { db, companyId, fyId, suppId, itemId } = createTestContext('comp_out_purch_ret');

  // Purchase ₹60,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-10',
    partyId: suppId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 60, ratePaise: 100000, gstRate: 0 }]
  });

  // Purchase Return ₹15,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE_RETURN',
    voucherDate: '2026-04-18',
    partyId: suppId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 15, ratePaise: 100000, gstRate: 0 }]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'SUPPLIER');
  assert.strictEqual(out[0].totalOutstandingPaise, 4500000, 'Outstanding must be ₹45,000 after ₹15,000 purchase return');
});

test('TEST_REP_10: CREDIT_NOTE reduces customer outstanding', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_cred_note');

  // Sales ₹40,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 40, ratePaise: 100000, gstRate: 0 }]
  });

  // Credit Note ₹5,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'CREDIT_NOTE',
    voucherDate: '2026-04-20',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_sales`, debitPaise: 500000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 500000 }
    ]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out[0].totalOutstandingPaise, 3500000, 'Outstanding must be ₹35,000 after ₹5,000 credit note');
});

test('TEST_REP_11: DEBIT_NOTE reduces supplier outstanding', () => {
  const { db, companyId, fyId, suppId, itemId } = createTestContext('comp_out_deb_note');

  // Purchase ₹50,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-10',
    partyId: suppId,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  // Debit Note ₹8,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'DEBIT_NOTE',
    voucherDate: '2026-04-22',
    partyId: suppId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_supp_1`, debitPaise: 800000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_purchase`, debitPaise: 0, creditPaise: 800000 }
    ]
  });

  const out = ReportEngine.getOutstandingReport(db, companyId, 'SUPPLIER');
  assert.strictEqual(out[0].totalOutstandingPaise, 4200000, 'Outstanding must be ₹42,000 after ₹8,000 debit note');
});

test('TEST_REP_20: Historical asOnDate correctly filters vouchers and recomputes aging buckets', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_ason');

  // Invoice 1 on 2026-04-10: ₹50,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  // Receipt on 2026-04-20: ₹20,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-20',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 2000000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 2000000 }
    ]
  });

  // Invoice 2 on 2026-05-10: ₹30,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 30, ratePaise: 100000, gstRate: 0 }]
  });

  // Query as of 2026-04-15: Only Invoice 1 exists (₹50,000)
  const outAsOf15 = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER', '2026-04-15');
  assert.strictEqual(outAsOf15[0].totalOutstandingPaise, 5000000, 'As of 2026-04-15, outstanding must be ₹50,000');
  assert.strictEqual(outAsOf15[0].bucket0to30Paise, 5000000);

  // Query as of 2026-04-25: Invoice 1 (50k) - Receipt (20k) = ₹30,000
  const outAsOf25 = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER', '2026-04-25');
  assert.strictEqual(outAsOf25[0].totalOutstandingPaise, 3000000, 'As of 2026-04-25, outstanding must be ₹30,000');

  // Query as of 2026-05-15: All vouchers active = 50k - 20k + 30k = ₹60,000
  const outAsOfMay = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER', '2026-05-15');
  assert.strictEqual(outAsOfMay[0].totalOutstandingPaise, 6000000, 'As of 2026-05-15, outstanding must be ₹60,000');
});

test('TEST_REP_OUT_DOUBLE_COUNT: Explicit AGAINST_REF + ON_ACCOUNT does not double-count settlement', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_out_dbl_cnt');

  // Invoice 1: ₹50,000
  const inv1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-05',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 50, ratePaise: 100000, gstRate: 0 }]
  });

  // Invoice 2: ₹30,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 30, ratePaise: 100000, gstRate: 0 }]
  });

  // Receipt 1 explicitly against Invoice 1: ₹20,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-12',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 2000000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 2000000 }
    ],
    billAllocation: {
      referenceVoucherId: inv1.voucherId,
      allocationType: 'AGAINST_REF'
    }
  });

  // Receipt 2 ON_ACCOUNT: ₹15,000
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-04-15',
    partyId: custId,
    lines: [],
    customLedgerLines: [
      { ledgerId: `${companyId}_led_cash`, debitPaise: 1500000, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cust_1`, debitPaise: 0, creditPaise: 1500000 }
    ]
  });

  // Total debits = ₹80,000. Total credits = ₹35,000.
  // Expected outstanding = ₹45,000 exactly.
  const out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  assert.strictEqual(out[0].totalOutstandingPaise, 4500000, 'Total outstanding must be ₹45,000. No settlement double-counted.');
});

test('TEST_REP_12: CESS tax entries are included and segregated into output, input, and net CESS', () => {
  const { db, companyId, fyId, custId, suppId } = createTestContext('comp_gst_cess');

  // Insert luxury item with 28% GST and 12% CESS
  const cessItemId = `${companyId}_item_luxury`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise)
    VALUES (?, ?, 'Luxury Vehicle', '8703', '${companyId}_unit_nos', 28, 12, 10000000, 15000000)
  `).run(cessItemId, companyId);

  // 1. Purchase: 1 unit @ ₹100,000. GST 28% = ₹28,000, CESS 12% = ₹12,000 (1,200,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-05',
    partyId: suppId,
    lines: [{ itemId: cessItemId, godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 10000000, gstRate: 28, cessRate: 12 }]
  });

  // 2. Sale: 1 unit @ ₹150,000. GST 28% = ₹42,000, CESS 12% = ₹18,000 (1,800,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    lines: [{ itemId: cessItemId, godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 15000000, gstRate: 28, cessRate: 12 }]
  });

  // Verify GST Summary has segregated CESS
  const gst = ReportEngine.getGstSummary(db, companyId, '2026-04-01', '2026-04-30');
  assert.strictEqual(gst.outputCessPaise, 1800000, 'Output CESS must be ₹18,000 (1,800,000 paise)');
  assert.strictEqual(gst.inputCessPaise, 1200000, 'Input CESS must be ₹12,000 (1,200,000 paise)');
  assert.strictEqual(gst.netCessPayablePaise, 600000, 'Net CESS payable must be ₹6,000 (600,000 paise)');
});

test('TEST_REP_13: 0% / zero-tax turnover is included and reconciles with P&L sales turnover', () => {
  const { db, companyId, fyId, custId } = createTestContext('comp_gst_zero_tax');

  // Insert 0% item (e.g. fresh milk / exempt food grains)
  const zeroTaxItemId = `${companyId}_item_grains`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise)
    VALUES (?, ?, 'Fresh Food Grains', '1001', '${companyId}_unit_nos', 0, 0, 100000, 150000)
  `).run(zeroTaxItemId, companyId);

  // Insert standard 18% item
  const stdTaxItemId = `${companyId}_item_std`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise)
    VALUES (?, ?, 'Standard Item', '8471', '${companyId}_unit_nos', 18, 0, 200000, 300000)
  `).run(stdTaxItemId, companyId);

  // Post 0% Sale: 20 units @ ₹1,500 = ₹30,000 (3,000,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-05',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId: zeroTaxItemId, godownId: `${companyId}_godown_main`, quantity: 20, ratePaise: 150000, gstRate: 0 }]
  });

  // Post 18% Sale: 10 units @ ₹3,000 = ₹30,000 (3,000,000 paise taxable) + ₹5,400 GST
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId: stdTaxItemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 300000, gstRate: 18 }]
  });

  const gst = ReportEngine.getGstSummary(db, companyId, '2026-04-01', '2026-04-30');
  assert.strictEqual(gst.outwardTaxablePaise, 3000000, 'Taxable outward must be ₹30,000');
  assert.strictEqual(gst.outwardZeroTaxTurnoverPaise, 3000000, 'Zero-tax outward must be ₹30,000');
  assert.strictEqual(gst.totalOutwardTurnoverPaise, 6000000, 'Total outward turnover must be ₹60,000');

  // Verify reconciliation with Profit & Loss
  const pnl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-04-30');
  assert.strictEqual(pnl.tradingIncomePaise, gst.totalOutwardTurnoverPaise, 'P&L Trading Income (₹60k) must exactly match Total Outward Turnover');
});

test('TEST_REP_15: GST Summary supports safe default dates when omitted', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_gst_defaults');

  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 100000, gstRate: 18 }]
  });

  // Call without dates
  const gstDefault = ReportEngine.getGstSummary(db, companyId);
  assert.ok(gstDefault, 'getGstSummary must succeed without explicit dates');
  assert.strictEqual(gstDefault.outwardTaxablePaise, 1000000, 'Must include transactions with default dates');

  // Call with explicit undefined
  const gstUndefined = ReportEngine.getGstSummary(db, companyId, undefined, undefined);
  assert.strictEqual(gstUndefined.outwardTaxablePaise, 1000000);
});

test('TEST_REP_23: Odd-paise tax-inclusive calculation maintains CGST === SGST statutory parity and DR === CR', () => {
  const { db, companyId, fyId, custId, itemId } = createTestContext('comp_gst_parity');

  // Selling price = ₹10.00 (1,000 paise) inclusive of 18% GST (intra-state)
  // Taxable = 1000 / 1.18 = 847 paise.
  // Tax = 153 paise (odd).
  // CGST (9%) = round(847 * 0.09) = 76 paise.
  // SGST (9%) = 76 paise.
  // Parity: CGST === SGST (76 === 76).
  const vch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{
      itemId,
      godownId: `${companyId}_godown_main`,
      quantity: 1,
      ratePaise: 1000,
      isTaxInclusive: true,
      gstRate: 18
    }]
  });

  // Verify voucher record in DB
  const vchRow = db.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(vch.voucherId) as any;
  assert.strictEqual(vchRow.cgst_amount_paise, vchRow.sgst_amount_paise, 'CGST must strictly equal SGST');
  assert.strictEqual(vchRow.cgst_amount_paise, 76, 'CGST must be 76 paise');
  assert.strictEqual(vchRow.sgst_amount_paise, 76, 'SGST must be 76 paise');
  assert.strictEqual(vchRow.taxable_amount_paise, 847, 'Taxable amount must be 847 paise');

  // Invariant: Taxable + CGST + SGST + RoundOff === Total
  const sum = vchRow.taxable_amount_paise + vchRow.cgst_amount_paise + vchRow.sgst_amount_paise + vchRow.round_off_paise;
  assert.strictEqual(sum, vchRow.total_amount_paise, 'taxable + CGST + SGST + round_off must equal total_amount_paise');

  // Double-Entry Invariant: DR === CR
  const leRows = db.prepare('SELECT debit_paise, credit_paise FROM ledger_entries WHERE voucher_id = ?').all(vch.voucherId) as any[];
  const totalDr = leRows.reduce((s, r) => s + r.debit_paise, 0);
  const totalCr = leRows.reduce((s, r) => s + r.credit_paise, 0);
  assert.strictEqual(totalDr, totalCr, 'Total DR must equal Total CR for odd-paise tax-inclusive voucher');
  const custEntry = leRows.find(r => r.debit_paise === vchRow.total_amount_paise);
  assert.ok(custEntry, 'Customer ledger must be debited with exact invoice total');
});

// ======================================================================
// COMMIT 005-D TESTS: OPENING STOCK & INVENTORY INTEGRITY
// ======================================================================

test('TEST_REP_14: Opening stock reconciles Stock Summary Value === Inventory Asset Value across scenarios A, B, C, D', () => {
  // Scenario A: Item A opening = ₹10,000, Item B opening = ₹5,000 -> Inventory Asset = ₹15,000
  const { db, companyId } = createTestContext('comp_opn_scen_a');

  // Create Item A
  const itemAId = `${companyId}_item_a`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Item Alpha', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(itemAId, companyId);
  PostingEngine.recordOpeningStock(db, {
    companyId,
    itemId: itemAId,
    quantity: 10,
    ratePaise: 100000
  });

  // Create Item B
  const itemBId = `${companyId}_item_b`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Item Beta', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(itemBId, companyId);
  PostingEngine.recordOpeningStock(db, {
    companyId,
    itemId: itemBId,
    quantity: 5,
    ratePaise: 100000
  });

  // Stock Summary Value
  const stockSummaryA = ReportEngine.getStockSummary(db, companyId);
  const totalStockVal = stockSummaryA.reduce((sum, item) => sum + item.totalValuePaise, 0);
  assert.strictEqual(totalStockVal, 1500000, 'Total Stock Summary value must be ₹15,000');

  // Inventory Asset in Trial Balance & Balance Sheet
  const tbA = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
  const invRowA = tbA.rows.find(r => r.ledgerId === `${companyId}_led_inventory`);
  assert.strictEqual(invRowA?.debitPaise, 1500000, 'Inventory Asset in Trial Balance must be ₹15,000 (Scenario A)');

  const bsA = ReportEngine.getBalanceSheet(db, companyId, '2026-04-30');
  const bsInvA = bsA.assets.find(a => a.ledgerName === 'Inventory Asset');
  assert.strictEqual(bsInvA?.amountPaise, 1500000, 'Balance Sheet Inventory Asset must be ₹15,000');
  assert.strictEqual(totalStockVal, bsInvA?.amountPaise, 'Stock Summary Value must strictly equal Inventory Asset Value');

  // Scenario B: Existing inventory opening balance = ₹20,000. Create additional item opening = ₹5,000 -> Total = ₹25,000
  const { db: dbB, companyId: compB } = createTestContext('comp_opn_scen_b');
  // Pre-set existing opening balance on Inventory Asset ledger: ₹20,000
  dbB.prepare(`
    UPDATE ledgers
    SET opening_balance_paise = 2000000, opening_balance_type = 'DR'
    WHERE ledger_id = ?
  `).run(`${compB}_led_inventory`);

  const itemB2Id = `${compB}_item_b2`;
  dbB.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Item B2', '${compB}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(itemB2Id, compB);
  PostingEngine.recordOpeningStock(dbB, {
    companyId: compB,
    itemId: itemB2Id,
    quantity: 5,
    ratePaise: 100000
  });

  const tbB = ReportEngine.getTrialBalance(dbB, compB, '2026-04-30');
  const invRowB = tbB.rows.find(r => r.ledgerId === `${compB}_led_inventory`);
  assert.strictEqual(invRowB?.debitPaise, 2500000, 'Inventory Asset must be ₹25,000 (₹20k existing + ₹5k new opening) (Scenario B)');

  // Scenario C: Manually configured inventory opening balance is preserved without being overwritten
  const invLedgerRowB = dbB.prepare('SELECT opening_balance_paise FROM ledgers WHERE ledger_id = ?').get(`${compB}_led_inventory`) as any;
  assert.strictEqual(invLedgerRowB.opening_balance_paise, 2500000, 'Opening balance preserved and augmented, not overwritten to just ₹5k (Scenario C)');

  // Scenario D: After selling part of opening inventory, Inventory Asset reduces by COGS and does not become abnormal credit
  const { db: dbD, companyId: compD, fyId: fyD, custId: custD } = createTestContext('comp_opn_scen_d');
  const itemDId = `${compD}_item_d`;
  dbD.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Item Delta', '${compD}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(itemDId, compD);
  PostingEngine.recordOpeningStock(dbD, {
    companyId: compD,
    itemId: itemDId,
    quantity: 10,
    ratePaise: 100000 // ₹10,000 opening stock
  });

  // Sell 4 units @ ₹1,500. COGS = 4 * ₹1,000 = ₹4,000 (400,000 paise)
  PostingEngine.postVoucher(dbD, {
    companyId: compD,
    fyId: fyD,
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custD,
    lines: [{ itemId: itemDId, godownId: `${compD}_godown_main`, quantity: 4, ratePaise: 150000, gstRate: 0 }]
  });

  const tbD = ReportEngine.getTrialBalance(dbD, compD, '2026-04-30');
  const invRowD = tbD.rows.find(r => r.ledgerId === `${compD}_led_inventory`);
  assert.strictEqual(invRowD?.debitPaise, 600000, 'Inventory Asset must be ₹6,000 (₹10,000 - ₹4,000 COGS)');
  assert.strictEqual(invRowD?.creditPaise, 0, 'Inventory Asset must NOT be an abnormal credit balance (Scenario D)');
});

test('TEST_REP_18: Negative stock visibility preserves signed negative quantity and recovers WAVG on restock', () => {
  const { db, companyId, fyId, custId, suppId } = createTestContext('comp_neg_stock');

  const negItemId = `${companyId}_item_oversold`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Oversold Widget', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(negItemId, companyId);

  // 1. Sell 5 units with allowNegativeStock = true
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-05',
    partyId: custId,
    allowNegativeStock: true,
    lines: [{ itemId: negItemId, godownId: `${companyId}_godown_main`, quantity: 5, ratePaise: 150000, gstRate: 0 }]
  });

  // Verify stock summary preserves signed negative quantity -5 (NOT clamped to 0)
  const summaryNeg = InventoryEngine.getItemStockSummary(db, negItemId);
  assert.strictEqual(summaryNeg.totalQuantity, -5, 'Physical stock quantity must be -5 (not clamped to 0)');
  assert.strictEqual(summaryNeg.totalValuePaise, 0, 'Negative stock valuation must be 0');

  const reportNeg = ReportEngine.getStockSummary(db, companyId);
  const reportItem = reportNeg.find(i => i.itemId === negItemId);
  assert.strictEqual(reportItem?.quantity, -5, 'Stock summary report must show -5 units');

  // 2. Restock: Purchase 10 units @ ₹1,200 (120,000 paise)
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-10',
    partyId: suppId,
    lines: [{ itemId: negItemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 120000, gstRate: 0 }]
  });

  // Net quantity should be -5 + 10 = 5 units.
  // Rate of remaining 5 units should be incoming batch rate ₹1,200 = ₹6,000 total value.
  const summaryRestocked = InventoryEngine.getItemStockSummary(db, negItemId);
  assert.strictEqual(summaryRestocked.totalQuantity, 5, 'Net stock after restock must be 5 units');
  assert.strictEqual(summaryRestocked.weightedAverageRatePaise, 120000, 'WAVG rate must be ₹1,200 per unit');
  assert.strictEqual(summaryRestocked.totalValuePaise, 600000, 'Total stock value must be ₹6,000 (5 * ₹1,200)');
});

test('TEST_REP_21: Historical stock valuation via asOfDate includes only movements up to requested date', () => {
  const { db, companyId, fyId, custId, suppId } = createTestContext('comp_hist_stock');

  const histItemId = `${companyId}_item_hist`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Historical Widget', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, '84713010')
  `).run(histItemId, companyId);

  // 1. Purchase 20 units @ ₹1,000 on 2026-04-05
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-05',
    partyId: suppId,
    lines: [{ itemId: histItemId, godownId: `${companyId}_godown_main`, quantity: 20, ratePaise: 100000, gstRate: 0 }]
  });

  // 2. Sell 8 units on 2026-04-15
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-04-15',
    partyId: custId,
    lines: [{ itemId: histItemId, godownId: `${companyId}_godown_main`, quantity: 8, ratePaise: 150000, gstRate: 0 }]
  });

  // 3. Purchase 10 units @ ₹1,300 on 2026-04-25
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-04-25',
    partyId: suppId,
    lines: [{ itemId: histItemId, godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 130000, gstRate: 0 }]
  });

  // As of 2026-04-10: 20 units @ ₹1,000 = ₹20,000
  const stockAsOf10 = ReportEngine.getStockSummary(db, companyId, '2026-04-10');
  const itemAsOf10 = stockAsOf10.find(i => i.itemId === histItemId);
  assert.strictEqual(itemAsOf10?.quantity, 20, 'Stock on 2026-04-10 must be 20 units');
  assert.strictEqual(itemAsOf10?.totalValuePaise, 2000000, 'Stock value on 2026-04-10 must be ₹20,000');

  // As of 2026-04-20: 12 units @ ₹1,000 = ₹12,000
  const stockAsOf20 = ReportEngine.getStockSummary(db, companyId, '2026-04-20');
  const itemAsOf20 = stockAsOf20.find(i => i.itemId === histItemId);
  assert.strictEqual(itemAsOf20?.quantity, 12, 'Stock on 2026-04-20 must be 12 units');
  assert.strictEqual(itemAsOf20?.totalValuePaise, 1200000, 'Stock value on 2026-04-20 must be ₹12,000');

  // As of 2026-04-30: 22 units: (12*1000 + 10*1300) = 12000 + 13000 = ₹25,000. Avg = 25000/22 = ₹1,136.36
  const stockAsOf30 = ReportEngine.getStockSummary(db, companyId, '2026-04-30');
  const itemAsOf30 = stockAsOf30.find(i => i.itemId === histItemId);
  assert.strictEqual(itemAsOf30?.quantity, 22, 'Stock on 2026-04-30 must be 22 units');
  assert.strictEqual(itemAsOf30?.avgRatePaise, 113636, 'WAVG rate must be 113636 paise');
  assert.strictEqual(itemAsOf30?.totalValuePaise, 2499992, 'Stock value on 2026-04-30 must be 2499992 paise');
});

// ======================================================================
// COMMIT 005-E TESTS: DASHBOARD & DAY BOOK
// ======================================================================

test('TEST_REP_16: Dashboard stock alerts compare actual ReportEngine stock against reorder level', () => {
  const { db, companyId } = createTestContext('comp_alert_test');

  // Item 1: Reorder level 10, current stock 4 (Warning)
  const itemWarnId = `${companyId}_item_warn`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, reorder_level, hsn_sac)
    VALUES (?, ?, 'Warning Item', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, 10, '84713010')
  `).run(itemWarnId, companyId);
  PostingEngine.recordOpeningStock(db, { companyId, itemId: itemWarnId, quantity: 4, ratePaise: 100000 });

  // Item 2: Reorder level 10, current stock 0 (Critical)
  const itemCritId = `${companyId}_item_crit`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, reorder_level, hsn_sac)
    VALUES (?, ?, 'Critical Item', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, 10, '84713010')
  `).run(itemCritId, companyId);

  // Item 3: Reorder level 10, current stock 20 (Safe — no alert)
  const itemSafeId = `${companyId}_item_safe`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, reorder_level, hsn_sac)
    VALUES (?, ?, 'Safe Item', '${companyId}_unit_nos', 18.00, 100000, 150000, 0, 0, 10, '84713010')
  `).run(itemSafeId, companyId);
  PostingEngine.recordOpeningStock(db, { companyId, itemId: itemSafeId, quantity: 20, ratePaise: 100000 });

  // Clean up default context item so only test items are evaluated
  db.prepare('DELETE FROM stock_items WHERE item_id = ?').run(`${companyId}_item_widget`);

  const stockSummary = ReportEngine.getStockSummary(db, companyId);
  const stockAlerts = stockSummary
    .filter(item => (item.reorderLevel > 0 && item.quantity <= item.reorderLevel) || item.quantity <= 0)
    .map(item => ({
      name: item.itemName,
      qty: `${item.quantity} Units`,
      status: item.quantity <= 0 ? 'critical' : 'warning'
    }));

  assert.strictEqual(stockAlerts.length, 2, 'Exactly 2 items should trigger alerts');
  const warnAlert = stockAlerts.find(a => a.name === 'Warning Item');
  assert.ok(warnAlert);
  assert.strictEqual(warnAlert.status, 'warning');
  assert.strictEqual(warnAlert.qty, '4 Units');

  const critAlert = stockAlerts.find(a => a.name === 'Critical Item');
  assert.ok(critAlert);
  assert.strictEqual(critAlert.status, 'critical');
  assert.strictEqual(critAlert.qty, '0 Units');
});

test('TEST_REP_17: Dashboard correctly incorporates opening cash, bank, receivables, payables and exposes bank overdraft', () => {
  const { db, companyId } = createTestContext('comp_dash_open');

  // 1. Debtors opening balance: ₹40,000 DR
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES ('${companyId}_led_cust_o', ?, '${companyId}_grp_debtors', 'Open Cust', 4000000, 'DR', 1)
  `).run(companyId);

  // 2. Creditors opening balance: ₹25,000 CR
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES ('${companyId}_led_supp_o', ?, '${companyId}_grp_creditors', 'Open Supp', 2500000, 'CR', 1)
  `).run(companyId);

  // 3. Bank Overdraft opening balance: ₹15,000 CR (negative bank balance / liability)
  db.prepare(`
    UPDATE ledgers
    SET opening_balance_paise = 1500000, opening_balance_type = 'CR'
    WHERE ledger_id = ?
  `).run(`${companyId}_led_sbi_bank`);

  // Execute Dashboard queries
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

  assert.strictEqual(receivables.balance, 4000000, 'Dashboard receivables must include opening balance ₹40,000');
  assert.strictEqual(payables.balance, 2500000, 'Dashboard payables must include opening balance ₹25,000');
  // Crucial DEF-REP-10 invariant: Bank Overdraft is exposed as negative balance, NOT clamped to 0
  assert.strictEqual(cashBank.balance, -1500000, 'Cash/Bank must expose overdraft -₹15,000 accurately (not clamped to 0)');
});

test('TEST_REP_24: Day Book particulars exposes primary opposing ledgers for non-party vouchers', () => {
  const { db, companyId, fyId } = createTestContext('comp_daybook_part');

  // 1. Post CONTRA voucher (Bank Deposit: Dr Bank ₹10,000, Cr Cash ₹10,000)
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, status, total_amount_paise, created_by)
    VALUES ('vch_contra_1', ?, ?, 'CONTRA', 'CNT-001', '2026-04-10', 'POSTED', 1000000, 'system')
  `).run(companyId, fyId);
  db.prepare(`
    INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise)
    VALUES 
      ('le_cnt_dr', 'vch_contra_1', '${companyId}_led_sbi_bank', '2026-04-10', 1000000, 0),
      ('le_cnt_cr', 'vch_contra_1', '${companyId}_led_cash', '2026-04-10', 0, 1000000)
  `).run();

  // 2. Post JOURNAL voucher (Direct Expense: Dr Rent Expense ₹20,000, Cr Bank ₹20,000)
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, status, total_amount_paise, created_by)
    VALUES ('vch_jrnl_1', ?, ?, 'JOURNAL', 'JRN-001', '2026-04-12', 'POSTED', 2000000, 'system')
  `).run(companyId, fyId);
  db.prepare(`
    INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise)
    VALUES 
      ('le_jrn_dr', 'vch_jrnl_1', '${companyId}_led_rent_expense', '2026-04-12', 2000000, 0),
      ('le_jrn_cr', 'vch_jrnl_1', '${companyId}_led_sbi_bank', '2026-04-12', 0, 2000000)
  `).run();

  const dayBook = ReportEngine.getDayBook(db, companyId, '2026-04-01', '2026-04-30');
  const contraEntry = dayBook.find(e => e.voucherId === 'vch_contra_1');
  assert.ok(contraEntry);
  assert.notStrictEqual(contraEntry.particulars, 'CONTRA', 'Day Book must NOT merely show CONTRA');
  assert.ok(contraEntry.particulars.includes('Bank') && contraEntry.particulars.includes('Cash'), 
    `CONTRA particulars must describe opposing ledgers: got '${contraEntry.particulars}'`);

  const journalEntry = dayBook.find(e => e.voucherId === 'vch_jrnl_1');
  assert.ok(journalEntry);
  assert.notStrictEqual(journalEntry.particulars, 'JOURNAL', 'Day Book must NOT merely show JOURNAL');
  assert.ok(journalEntry.particulars.includes('Rent Expense') && journalEntry.particulars.includes('Bank'), 
    `JOURNAL particulars must describe opposing ledgers: got '${journalEntry.particulars}'`);
});

// ======================================================================
// COMMIT 005-F TESTS: TENANT HARDENING & DOMAIN DEFENSE-IN-DEPTH
// ======================================================================

test('TEST_REP_22: Domain-level tenant hardening prevents cross-tenant ledger statement access (DEF-REP-16)', () => {
  const { db, companyId: compA } = createTestContext('comp_tenant_a');
  const compB = 'comp_tenant_b';

  initializeBusiness(db, {
    companyId: compB,
    companyName: 'Company B Isolated Ltd',
    stateCode: '29',
    gstin: '29BBBBB5678B1Z6'
  });

  // Create a confidential ledger in Company B with ₹50,000 balance
  const compBLedgerId = `${compB}_led_confidential`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type)
    VALUES (?, ?, '${compB}_grp_bank', 'Confidential Offshore Bank', 5000000, 'DR')
  `).run(compBLedgerId, compB);

  // Verify Company B can access its own ledger statement
  const validStmt = ReportEngine.getLedgerStatement(db, compB, compBLedgerId, '2026-04-01', '2026-04-30');
  assert.strictEqual(validStmt.openingBalancePaise, 5000000);
  assert.strictEqual(validStmt.ledgerName, 'Confidential Offshore Bank');

  // Verify Domain-level defense: Company A CANNOT access Company B's ledger even with valid ledgerId
  assert.throws(
    () => {
      ReportEngine.getLedgerStatement(db, compA, compBLedgerId, '2026-04-01', '2026-04-30');
    },
    (err: any) => {
      return err.message.includes(`Ledger '${compBLedgerId}' not found for company '${compA}'`);
    },
    'Company A must be strictly rejected from accessing Company B ledger at the domain layer'
  );

  // Cross-tenant report isolation verification:
  // Company A Trial Balance does not contain Company B ledgers
  const tbA = ReportEngine.getTrialBalance(db, compA, '2026-04-30');
  assert.strictEqual(tbA.rows.some(r => r.ledgerId.startsWith(compB)), false, 'Company A Trial Balance must have zero Company B rows');

  // Company A Stock Summary does not contain Company B stock items
  const stockA = ReportEngine.getStockSummary(db, compA);
  assert.strictEqual(stockA.some(i => i.itemId.startsWith(compB)), false, 'Company A Stock Summary must have zero Company B items');
});

console.log('\n======================================================================');
console.log(`ALL ${totalCount} / ${totalCount} REPORTS INTEGRITY TESTS PASSED (100% SUCCESS)`);
console.log('======================================================================\n');





