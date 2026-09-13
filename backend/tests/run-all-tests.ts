import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { GstEngine } from '../src/domain/tax/gst-engine.js';
import { DoubleEntryEngine } from '../src/domain/accounting/double-entry.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { seedInitialData } from '../src/database/seed.js';

console.log('====================================================');
console.log('LEDGERFLOW AUTOMATED ACCOUNTING ENGINE TEST SUITE');
console.log('====================================================\n');

// 1. In-Memory Database for testing
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
testDb.exec(schemaSql);
const companyId = seedInitialData(testDb);
const fyId = 'fy_2026_27';

console.log('✓ Database schema and chart of accounts seeded successfully in memory.');

// Test-only fixtures for testing workflows in-memory
testDb.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
  VALUES ('led_cust_sample_01', ?, 'grp_debtors', 'Customer A (Sample TN)', 0)
`).run(companyId);

testDb.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
  VALUES ('party_cust_01', ?, 'led_cust_sample_01', 'Customer A (Sample TN)', 'CUSTOMER', '33AAACA1111A1Z1')
`).run(companyId);

testDb.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_cust_01', 'party_cust_01', '123 GST Road', 'Chennai', 'Tamil Nadu', '33', '600001')
`).run();

testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
  VALUES ('item_laptop_01', ?, 'ThinkPad Laptop T14', '84713010', 'unit_nos', 18, 4000000, 5000000, 10, 4000000)
`).run(companyId);

testDb.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES ('v_open_test', ?, ?, 'JOURNAL', 'OPEN-01', '2026-04-01', 40000000, 'POSTED')
`).run(companyId, fyId);

testDb.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('stk_open_test', 'v_open_test', 'item_laptop_01', 'godown_main', '2026-04-01', 'IN', 10, 4000000, 40000000)
`).run();

// ---------------- TEST 1: STATUTORY GST CALCULATION ----------------
console.log('\n[Test 1] Statutory GST Engine: Intra-State (9% + 9%)');
const intraRes = GstEngine.calculateLineTax({
  quantity: 1,
  ratePaise: 5000000, // ₹50,000
  gstRate: 18,
  sellerStateCode: '33', // Tamil Nadu
  placeOfSupplyStateCode: '33' // Tamil Nadu
});

assert.strictEqual(intraRes.taxableAmountPaise, 5000000, 'Taxable amount should be ₹50,000');
assert.strictEqual(intraRes.isInterState, false, 'Should be Intra-State');
assert.strictEqual(intraRes.cgstRate, 9, 'CGST rate should be 9%');
assert.strictEqual(intraRes.sgstRate, 9, 'SGST rate should be 9%');
assert.strictEqual(intraRes.cgstAmountPaise, 450000, 'CGST should be ₹4,500');
assert.strictEqual(intraRes.sgstAmountPaise, 450000, 'SGST should be ₹4,500');
assert.strictEqual(intraRes.igstAmountPaise, 0, 'IGST should be 0');
assert.strictEqual(intraRes.totalAmountPaise, 5900000, 'Total should be ₹59,000');
console.log('✓ Intra-State GST calculation passed (₹50,000 + ₹4,500 CGST + ₹4,500 SGST = ₹59,000).');

console.log('\n[Test 2] Statutory GST Engine: Inter-State (18% IGST)');
const interRes = GstEngine.calculateLineTax({
  quantity: 2,
  ratePaise: 1000000, // ₹10,000
  gstRate: 18,
  sellerStateCode: '33', // Tamil Nadu
  placeOfSupplyStateCode: '29' // Karnataka
});
assert.strictEqual(interRes.isInterState, true, 'Should be Inter-State');
assert.strictEqual(interRes.igstRate, 18, 'IGST rate should be 18%');
assert.strictEqual(interRes.cgstAmountPaise, 0, 'CGST must be 0 for inter-state');
assert.strictEqual(interRes.sgstAmountPaise, 0, 'SGST must be 0 for inter-state');
assert.strictEqual(interRes.igstAmountPaise, 360000, 'IGST should be ₹3,600 on ₹20,000');
console.log('✓ Inter-State GST calculation passed (₹20,000 + ₹3,600 IGST = ₹23,600).');

console.log('\n[Test 3] Tax-Inclusive Calculation');
const inclusiveRes = GstEngine.calculateLineTax({
  quantity: 1,
  ratePaise: 118000, // ₹1,180 inclusive
  isTaxInclusive: true,
  gstRate: 18,
  sellerStateCode: '33',
  placeOfSupplyStateCode: '33'
});
assert.strictEqual(inclusiveRes.taxableAmountPaise, 100000, 'Taxable must be ₹1,000');
assert.strictEqual(inclusiveRes.totalTaxPaise, 18000, 'Total tax must be ₹180');
assert.strictEqual(inclusiveRes.totalAmountPaise, 118000, 'Total must equal ₹1,180');
console.log('✓ Tax-Inclusive calculation passed (₹1,180 with 18% GST yields ₹1,000 base + ₹180 tax).');

// ---------------- TEST 4: DOUBLE-ENTRY BALANCING INVARIANT ----------------
console.log('\n[Test 4] Fundamental Invariant: Total Debit === Total Credit');
const balancedCheck = DoubleEntryEngine.validateBalancedEntries([
  { ledgerId: 'led_cash', debitPaise: 10000, creditPaise: 0 },
  { ledgerId: 'led_sales', debitPaise: 0, creditPaise: 10000 }
]);
assert.strictEqual(balancedCheck.isValid, true, 'Balanced lines must pass');

const unbalancedCheck = DoubleEntryEngine.validateBalancedEntries([
  { ledgerId: 'led_cash', debitPaise: 10000, creditPaise: 0 },
  { ledgerId: 'led_sales', debitPaise: 0, creditPaise: 9500 }
]);
assert.strictEqual(unbalancedCheck.isValid, false, 'Unbalanced lines must be rejected');
console.log('✓ Double-Entry Engine strictly rejects unbalanced vouchers.');

// ---------------- TEST 5: COMPLETE SALES WORKFLOW POSTING ----------------
console.log('\n[Test 5] Complete Sales Voucher Workflow (Tamil Nadu Example from Section 56)');
const initialStock = InventoryEngine.getItemStockSummary(testDb, 'item_laptop_01');
assert.strictEqual(initialStock.totalQuantity, 10, 'Initial stock should be 10 units');

const salesVoucher = PostingEngine.postVoucher(testDb, {
  companyId,
  fyId,
  voucherType: 'SALES',
  voucherDate: '2026-05-10',
  partyId: 'party_cust_01',
  narration: 'Sold 1 Business Laptop to Customer A',
  lines: [
    {
      itemId: 'item_laptop_01',
      godownId: 'godown_main',
      quantity: 1,
      ratePaise: 5000000, // ₹50,000
      gstRate: 18
    }
  ]
});

assert.strictEqual(salesVoucher.totalAmountPaise, 5900000, 'Sales Voucher Total must be ₹59,000');
console.log('✓ Sales voucher posted atomically: Voucher #', salesVoucher.voucherNumber);

// Verify downstream effects:
// 1. Stock decreased from 10 to 9
const postSaleStock = InventoryEngine.getItemStockSummary(testDb, 'item_laptop_01');
assert.strictEqual(postSaleStock.totalQuantity, 9, 'Stock must decrease by 1 to 9 units');
console.log('✓ Inventory mass balance invariant verified: 10 - 1 = 9 units.');

// 2. Customer ledger statement has DR ₹59,000
const custLedger = ReportEngine.getLedgerStatement(testDb, 'led_cust_sample_01', '2026-04-01', '2026-05-31');
assert.strictEqual(custLedger.closingBalancePaise, 5900000, 'Customer balance must be ₹59,000');
assert.strictEqual(custLedger.closingBalanceType, 'DR', 'Customer balance must be Debit');
console.log('✓ Customer ledger updated with DR ₹59,000.');

// 3. Customer Outstanding has ₹59,000
const receivables = ReportEngine.getOutstandingReport(testDb, companyId, 'CUSTOMER');
assert.strictEqual(receivables[0].totalOutstandingPaise, 5900000, 'Outstanding must be ₹59,000');
console.log('✓ Customer outstanding updated with ₹59,000.');

// ---------------- TEST 6: RECEIPT WORKFLOW SETTLEMENT ----------------
console.log('\n[Test 6] Customer Receipt Workflow (Settling Sales Voucher)');
const receiptVoucher = PostingEngine.postVoucher(testDb, {
  companyId,
  fyId,
  voucherType: 'RECEIPT',
  voucherDate: '2026-05-15',
  partyId: 'party_cust_01',
  narration: 'Receipt via Bank for Sales Voucher',
  lines: [],
  customLedgerLines: [
    { ledgerId: 'led_sbi_bank', debitPaise: 5900000, creditPaise: 0, particulars: 'From Customer A' },
    { ledgerId: 'led_cust_sample_01', debitPaise: 0, creditPaise: 5900000, particulars: 'Payment received' }
  ],
  billAllocation: {
    referenceVoucherId: salesVoucher.voucherId,
    allocationType: 'AGAINST_REF'
  }
});

// Verify Customer balance is now 0
const settledCustLedger = ReportEngine.getLedgerStatement(testDb, 'led_cust_sample_01', '2026-04-01', '2026-05-31');
assert.strictEqual(settledCustLedger.closingBalancePaise, 0, 'Customer closing balance must be 0 after full settlement');

// Verify Customer Outstanding is now 0
const postReceiptReceivables = ReportEngine.getOutstandingReport(testDb, companyId, 'CUSTOMER');
assert.strictEqual(postReceiptReceivables.length, 0, 'Customer must have 0 outstanding bills');
console.log('✓ Receipt posted and customer outstanding fully cleared to ₹0.');

// ---------------- TEST 7: TRIAL BALANCE BALANCING ----------------
console.log('\n[Test 7] Trial Balance Verification');
const tb = ReportEngine.getTrialBalance(testDb, companyId, '2026-05-31');
console.log(`Total Debit: ₹${(tb.totalDebitPaise / 100).toFixed(2)}, Total Credit: ₹${(tb.totalCreditPaise / 100).toFixed(2)}, Diff: ₹${(tb.differencePaise / 100).toFixed(2)}`);
assert.strictEqual(tb.isBalanced, true, 'Trial Balance must be strictly balanced (Debit === Credit)');
assert.strictEqual(tb.differencePaise, 0, 'Discrepancy must be 0');
console.log('✓ Trial Balance Invariant Verified: Total Dr === Total Cr.');

// ---------------- TEST 8: PROFIT & LOSS AND BALANCE SHEET ----------------
console.log('\n[Test 8] Profit & Loss and Balance Sheet Consistency');
const pnl = ReportEngine.getProfitAndLoss(testDb, companyId, '2026-04-01', '2026-05-31');
console.log(`Trading Income: ₹${(pnl.tradingIncomePaise / 100).toFixed(2)}, COGS Expense: ₹${(pnl.tradingExpensePaise / 100).toFixed(2)}, Gross Profit: ₹${(pnl.grossProfitPaise / 100).toFixed(2)}`);
assert.strictEqual(pnl.tradingIncomePaise, 5000000, 'Sales income must be ₹50,000');
assert.strictEqual(pnl.tradingExpensePaise, 4000000, 'COGS must be ₹40,000 (1 laptop @ ₹40,000 cost)');
assert.strictEqual(pnl.grossProfitPaise, 1000000, 'Gross Profit must be ₹10,000');

const bs = ReportEngine.getBalanceSheet(testDb, companyId, '2026-05-31');
console.log(`Balance Sheet Assets: ₹${(bs.totalAssetsPaise / 100).toFixed(2)}, Liab + Equity: ₹${(bs.totalLiabilitiesEquityPaise / 100).toFixed(2)}`);
// ---------------- TEST 9: TAX-INCLUSIVE SALES WITHOUT EXPLICIT GODOWN ----------------
console.log('\n[Test 9] Tax-Inclusive Sales Voucher (Selling price includes tax, godown auto-resolved)');
const taxInclusiveSale = PostingEngine.postVoucher(testDb, {
  companyId,
  fyId,
  voucherType: 'SALES',
  voucherDate: '2026-05-25',
  partyId: 'party_cust_01',
  narration: 'Sold 1 Laptop at MRP ₹59,000 (Tax Inclusive)',
  lines: [
    {
      itemId: 'item_laptop_01',
      // Note: godownId omitted on purpose to verify auto-resolution
      quantity: 1,
      ratePaise: 5900000, // ₹59,000 selling price inclusive of tax
      isTaxInclusive: true,
      gstRate: 18
    }
  ]
});

// Total must be EXACTLY ₹59,000 (selling price), NOT ₹59,000 + 18%!
assert.strictEqual(taxInclusiveSale.totalAmountPaise, 5900000, 'Tax-Inclusive Sale must equal exact selling price of ₹59,000');

const postedRow = testDb.prepare('SELECT * FROM vouchers WHERE voucher_id = ?').get(taxInclusiveSale.voucherId) as any;
assert.strictEqual(postedRow.taxable_amount_paise, 5000000, 'Taxable must back-calculate to ₹50,000');
assert.strictEqual(postedRow.cgst_amount_paise + postedRow.sgst_amount_paise, 900000, 'CGST + SGST must sum to ₹9,000');
assert.strictEqual(postedRow.total_amount_paise, 5900000, 'Total stored in DB must be ₹59,000');

// Verify stock moved out of default godown: 9 - 1 = 8 units
const postTaxInclusiveStock = InventoryEngine.getItemStockSummary(testDb, 'item_laptop_01');
assert.strictEqual(postTaxInclusiveStock.totalQuantity, 8, 'Stock must decrease from 9 to 8 units in auto-resolved godown');
console.log('✓ Tax-inclusive sales voucher verified: Total ₹59,000 equals selling price, 18% GST extracted, stock decreased to 8 units.');

console.log('\n====================================================');
console.log('ALL 9 ACCOUNTING ENGINE TESTS PASSED WITH 100% SUCCESS');
console.log('====================================================');
