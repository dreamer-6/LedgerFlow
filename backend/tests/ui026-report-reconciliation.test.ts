import assert from 'node:assert';
import { getDatabase } from '../src/database/connection.js';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { GstEngine } from '../src/domain/tax/gst-engine.js';

console.log('============================================================');
console.log('LEDGERFLOW FINANCIAL REPORT RECONCILIATION TEST SUITE');
console.log('Phase 8: Trial Balance, Balance Sheet, P&L, GST & Inventory');
console.log('============================================================\n');

const db = getDatabase(':memory:');
const companyId = 'comp_reconcile_01';
const fyId = `${companyId}_fy_2026_27`;

// Provision Users
db.prepare(`
  INSERT INTO users (user_id, username, email, password_hash, full_name, role)
  VALUES ('usr_auditor_01', 'auditor', 'auditor@audit.com', 'hash', 'Chief Auditor', 'ADMIN')
`).run();

// Initialize Company
initializeBusiness(db, {
  companyId,
  companyName: 'Precision Engineering Ltd',
  legalName: 'Precision Engineering Limited',
  gstin: '33AAACP5555P1Z9',
  ownerUserId: 'usr_auditor_01'
});

// Setup Masters
const custId = `${companyId}_pty_cust_prec`;
const custLedgerId = `${companyId}_led_cust_prec`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'Precision Client Inc', '${companyId}_grp_debtors', 0, 'DR', 1)
`).run(custLedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
  VALUES (?, ?, 'Precision Client Inc', 'CUSTOMER', ?, '33BBBCP6666P1Z1')
`).run(custId, companyId, custLedgerId);
db.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_${custId}', ?, '100 Industrial Road', 'Chennai', 'Tamil Nadu', '33', '600001')
`).run(custId);

const suppId = `${companyId}_pty_supp_prec`;
const suppLedgerId = `${companyId}_led_supp_prec`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'Steel Supplies Co', '${companyId}_grp_creditors', 0, 'CR', 1)
`).run(suppLedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
  VALUES (?, ?, 'Steel Supplies Co', 'SUPPLIER', ?, '33CCCDE7777C1Z2')
`).run(suppId, companyId, suppLedgerId);
db.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_${suppId}', ?, '200 Metal Way', 'Chennai', 'Tamil Nadu', '33', '600002')
`).run(suppId);

const itemId = `${companyId}_item_gear`;
db.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, hsn_sac)
  VALUES (?, ?, 'Precision Steel Gearbox', '${companyId}_unit_nos', 18.00, 200000, 350000, '84834000')
`).run(itemId, companyId);

// 1. Initial Capital Injection: Debit Bank ₹500,000.00 (50000000 paise), Credit Capital 50000000
const vchCapital = 'vch_capital_01';
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES (?, ?, ?, 'RECEIPT', 'REC-001', '2026-04-01', 50000000, 'POSTED')
`).run(vchCapital, companyId, fyId);
db.prepare(`
  INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, debit_paise, credit_paise, entry_date)
  VALUES
    ('le_cap_1', ?, '${companyId}_led_sbi_bank', 50000000, 0, '2026-04-01'),
    ('le_cap_2', ?, '${companyId}_led_capital', 0, 50000000, '2026-04-01')
`).run(vchCapital, vchCapital);

// 2. Purchase: 50 gears @ ₹2,000 = ₹100,000 (10000000 paise) + 18% GST (1800000 paise) = 11800000 paise
const vchPur = 'vch_pur_rec_01';
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status, party_id)
  VALUES (?, ?, ?, 'PURCHASE', 'PUR-001', '2026-04-10', 11800000, 'POSTED', ?)
`).run(vchPur, companyId, fyId, suppId);
db.prepare(`
  INSERT INTO voucher_lines (line_id, voucher_id, line_number, item_id, quantity, rate_paise, taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise)
  VALUES ('vl_pur_01', ?, 1, ?, 50, 200000, 10000000, 18, 900000, 900000, 0, 11800000)
`).run(vchPur, itemId);
db.prepare(`
  INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, debit_paise, credit_paise, entry_date)
  VALUES
    ('le_p_1', ?, '${companyId}_led_purchase', 10000000, 0, '2026-04-10'),
    ('le_p_2', ?, '${companyId}_led_input_cgst', 900000, 0, '2026-04-10'),
    ('le_p_3', ?, '${companyId}_led_input_sgst', 900000, 0, '2026-04-10'),
    ('le_p_4', ?, ?, 0, 11800000, '2026-04-10')
`).run(vchPur, vchPur, vchPur, vchPur, suppLedgerId);
db.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('stk_pur_01', ?, ?, '${companyId}_godown_main', '2026-04-10', 'IN', 50, 200000, 10000000)
`).run(vchPur, itemId);

// 3. Sales: 30 gears @ ₹3,500 = ₹105,000 (10500000 paise) + 18% GST (1890000 paise) = 12390000 paise
const vchSale = 'vch_sale_rec_01';
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status, party_id)
  VALUES (?, ?, ?, 'SALES', 'INV-001', '2026-04-15', 12390000, 'POSTED', ?)
`).run(vchSale, companyId, fyId, custId);
db.prepare(`
  INSERT INTO voucher_lines (line_id, voucher_id, line_number, item_id, quantity, rate_paise, taxable_amount_paise, gst_rate, cgst_amount_paise, sgst_amount_paise, igst_amount_paise, total_amount_paise)
  VALUES ('vl_sale_01', ?, 1, ?, 30, 350000, 10500000, 18, 945000, 945000, 0, 12390000)
`).run(vchSale, itemId);
db.prepare(`
  INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, debit_paise, credit_paise, entry_date)
  VALUES
    ('le_s_1', ?, ?, 12390000, 0, '2026-04-15'),
    ('le_s_2', ?, '${companyId}_led_sales', 0, 10500000, '2026-04-15'),
    ('le_s_3', ?, '${companyId}_led_output_cgst', 0, 945000, '2026-04-15'),
    ('le_s_4', ?, '${companyId}_led_output_sgst', 0, 945000, '2026-04-15')
`).run(vchSale, custLedgerId, vchSale, vchSale, vchSale);
db.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('stk_sale_01', ?, ?, '${companyId}_godown_main', '2026-04-15', 'OUT', 30, 200000, 6000000)
`).run(vchSale, itemId);

// 4. Draft Voucher (Must have ZERO impact on all reports)
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES ('vch_draft_unposted', ?, ?, 'SALES', 'DFT-001', '2026-04-20', 9999999, 'DRAFT')
`).run(companyId, fyId);

// 5. Cancelled Voucher (Must have ZERO financial impact on posted reports)
const vchCancelled = 'vch_canc_01';
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES (?, ?, ?, 'SALES', 'INV-002', '2026-04-22', 500000, 'CANCELLED')
`).run(vchCancelled, companyId, fyId);

console.log('✓ Test transactions, master data, draft, and cancelled vouchers populated.\n');

// ============================================================
// RECONCILIATION VERIFICATION
// ============================================================

// 1. TRIAL BALANCE RECONCILIATION
console.log('--- 1. TRIAL BALANCE DEBIT-CREDIT EQUALITY ---');
{
  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
  assert.ok(tb.rows.length > 0, 'Trial balance must return ledger rows');
  assert.strictEqual(
    tb.totalDebitPaise,
    tb.totalCreditPaise,
    `Trial Balance debits (${tb.totalDebitPaise}) must exactly equal credits (${tb.totalCreditPaise})`
  );
  assert.strictEqual(tb.isBalanced, true);
  console.log(`✓ Trial Balance debits (₹${(tb.totalDebitPaise / 100).toFixed(2)}) == credits (₹${(tb.totalCreditPaise / 100).toFixed(2)}) down to integer paise.`);
}

// 2. LEDGER TO TRIAL BALANCE RECONCILIATION
console.log('--- 2. LEDGER STATEMENT TO TRIAL BALANCE RECONCILIATION ---');
{
  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
  for (const item of tb.rows) {
    const stmt = ReportEngine.getLedgerStatement(db, companyId, item.ledgerId, '2026-04-01', '2026-04-30');
    if (stmt.closingBalanceType === 'DR') {
      assert.strictEqual(stmt.closingBalancePaise, item.debitPaise, `Ledger ${item.ledgerName} DR balance must match TB`);
    } else {
      assert.strictEqual(stmt.closingBalancePaise, item.creditPaise, `Ledger ${item.ledgerName} CR balance must match TB`);
    }
  }
  console.log('✓ All ledger balances reconcile 100% to Trial Balance rows.');
}

// 3. PROFIT & LOSS RECONCILIATION
console.log('--- 3. PROFIT & LOSS STATEMENT ---');
{
  const pl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-04-30');
  // Sales revenue = ₹105,000.00 = 10500000 paise
  assert.strictEqual(pl.tradingIncomePaise, 10500000);
  // Purchases = ₹100,000.00 = 10000000 paise
  assert.strictEqual(pl.tradingExpensePaise, 10000000);
  // Gross Profit = Sales (10500000) - Expense (10000000) = 500000 paise
  assert.strictEqual(pl.grossProfitPaise, 500000);
  assert.strictEqual(pl.netProfitPaise, 500000);
  console.log(`✓ Profit & Loss reconciled: Trading Income ₹${(pl.tradingIncomePaise/100).toFixed(2)}, Expense ₹${(pl.tradingExpensePaise/100).toFixed(2)}, Net Profit ₹${(pl.netProfitPaise/100).toFixed(2)}.`);
}

// 4. BALANCE SHEET ASSETS = LIABILITIES + EQUITY RECONCILIATION
console.log('--- 4. BALANCE SHEET A = L + E RECONCILIATION ---');
{
  const bs = ReportEngine.getBalanceSheet(db, companyId, '2026-04-30');
  assert.strictEqual(
    bs.totalAssetsPaise,
    bs.totalLiabilitiesEquityPaise,
    `Balance Sheet must balance: Assets (${bs.totalAssetsPaise}) === L + E (${bs.totalLiabilitiesEquityPaise})`
  );
  assert.strictEqual(bs.isBalanced, true);
  console.log(`✓ Balance Sheet balanced: Assets ₹${(bs.totalAssetsPaise/100).toFixed(2)} == Liab + Equity ₹${(bs.totalLiabilitiesEquityPaise/100).toFixed(2)}.`);
}

// 5. RECEIVABLES & PAYABLES RECONCILIATION
console.log('--- 5. RECEIVABLES & PAYABLES RECONCILIATION ---');
{
  const custStmt = ReportEngine.getLedgerStatement(db, companyId, custLedgerId, '2026-04-01', '2026-04-30');
  assert.strictEqual(custStmt.closingBalancePaise, 12390000);

  const suppStmt = ReportEngine.getLedgerStatement(db, companyId, suppLedgerId, '2026-04-01', '2026-04-30');
  assert.strictEqual(suppStmt.closingBalancePaise, 11800000);
  console.log('✓ Trade Debtors and Trade Creditors reconcile to exact party ledger balances.');
}

// 6. INVENTORY VALUATION & STOCK SUMMARY RECONCILIATION
console.log('--- 6. INVENTORY VALUATION & STOCK SUMMARY ---');
{
  const summary = InventoryEngine.getItemStockSummary(db, itemId, '2026-04-30');
  assert.strictEqual(summary.totalQuantity, 20); // 50 in - 30 out = 20
  assert.strictEqual(summary.totalValuePaise, 4000000); // 20 * 200000 = 4000000
  console.log(`✓ Inventory valuation: 20 units @ ₹2,000.00 = ₹${(summary.totalValuePaise/100).toFixed(2)}.`);
}

// 7. DAY BOOK RECONCILIATION
console.log('--- 7. DAY BOOK RECONCILIATION ---');
{
  const dayBook = ReportEngine.getDayBook(db, companyId, '2026-04-01', '2026-04-30');
  // Must contain only POSTED vouchers: Capital Receipt, Purchase, Sales = 3 vouchers
  assert.strictEqual(dayBook.length, 3, 'Day Book must contain exactly 3 active POSTED vouchers');
  assert.ok(!dayBook.some(v => v.voucherId === 'vch_draft_unposted'), 'Draft voucher must not appear in Day Book');
  assert.ok(!dayBook.some(v => v.voucherId === vchCancelled), 'Cancelled voucher must not appear in Day Book');
  console.log('✓ Day Book contains only active POSTED vouchers; drafts and cancelled excluded.');
}

console.log('\n============================================================');
console.log('ALL FINANCIAL REPORT RECONCILIATIONS PASSED (100% GREEN)');
console.log('============================================================\n');
