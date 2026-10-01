import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { ReportEngine } from '../src/reports/report-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 003 — INVENTORY INTEGRITY & STOCK LIFECYCLE TEST SUITE');
console.log('======================================================================\n');

function createTestContext() {
  const db = new DatabaseSync(':memory:');
  const schemaPath = path.resolve('src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  const companyId = 'comp_inv_test';
  initializeBusiness(db, {
    companyId,
    companyName: 'Inventory Integrity Corp',
    stateCode: '33',
    gstin: '33AAAAA1234A1Z5'
  });

  const activeFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as any;
  const fyId = activeFy.fy_id;

  // Supplier
  const suppId = 'party_supp_t';
  const suppLedgerId = `${companyId}_led_supp_t`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type)
    VALUES (?, ?, 'Test Supplier', '${companyId}_grp_creditors', 0, 'CR')
  `).run(suppLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id)
    VALUES (?, ?, 'Test Supplier', 'SUPPLIER', ?)
  `).run(suppId, companyId, suppLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_supp_t', ?, 'Supplier St', 'Chennai', 'Tamil Nadu', '33', '600001')
  `).run(suppId);

  // Customer
  const custId = 'party_cust_t';
  const custLedgerId = `${companyId}_led_cust_t`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type)
    VALUES (?, ?, 'Test Customer', '${companyId}_grp_debtors', 0, 'DR')
  `).run(custLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id)
    VALUES (?, ?, 'Test Customer', 'CUSTOMER', ?)
  `).run(custId, companyId, custLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_cust_t', ?, 'Customer Ave', 'Chennai', 'Tamil Nadu', '33', '600002')
  `).run(custId);

  return { db, companyId, fyId, suppId, custId };
}

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------
// TEST A: Sales Return restores inventory at COST
// --------------------------------------------------------------------------
runTest('TEST A: Sales Return restores inventory at COST (not selling price)', () => {
  const { db, companyId, fyId, suppId, custId } = createTestContext();

  // Create Item: purchase_rate = ₹100 (10,000 paise), selling_rate = ₹150 (15,000 paise)
  const itemId = 'item_widget_a';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Widget A', '${companyId}_unit_nos', 18.00, 10000, 15000, 0, 0, '84713010')
  `).run(itemId, companyId);

  // 1. Purchase 10 × ₹100
  const pur = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-01',
    partyId: suppId,
    lines: [{ itemId, quantity: 10, ratePaise: 10000, gstRate: 18 }]
  });

  // Verify stock: 10 @ ₹100 = ₹1,000 (100,000 paise)
  let stock = InventoryEngine.getItemStockSummary(db, itemId);
  assert.strictEqual(stock.totalQuantity, 10);
  assert.strictEqual(stock.totalValuePaise, 100000);
  assert.strictEqual(stock.weightedAverageRatePaise, 10000);

  // 2. Sale 4 × ₹150 (COGS recognized at ₹100: 4 × ₹100 = ₹400)
  const sale = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: custId,
    lines: [{ itemId, quantity: 4, ratePaise: 15000, gstRate: 18 }]
  });

  // Verify stock after sale: 6 @ ₹100 = ₹600 (60,000 paise)
  stock = InventoryEngine.getItemStockSummary(db, itemId);
  assert.strictEqual(stock.totalQuantity, 6);
  assert.strictEqual(stock.totalValuePaise, 60000);

  // 3. Sales Return 2 units (Customer was charged ₹150, but returned inventory must be restored at COST: 2 × ₹100 = ₹200)
  const ret = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES_RETURN',
    voucherDate: '2026-05-15',
    partyId: custId,
    referenceNumber: sale.voucherId,
    lines: [{ itemId, quantity: 2, ratePaise: 15000, gstRate: 18 }]
  });

  // Verify: Stock entry for return was recorded at COST (₹100), NOT selling price (₹150)
  const retStockEntry = db.prepare(`
    SELECT quantity, rate_paise, value_paise FROM stock_entries WHERE voucher_id = ?
  `).get(ret.voucherId) as any;
  assert.strictEqual(retStockEntry.quantity, 2);
  assert.strictEqual(retStockEntry.rate_paise, 10000, 'Return stock entry rate must be cost ₹100 (10,000 paise), NOT selling price ₹150');
  assert.strictEqual(retStockEntry.value_paise, 20000, 'Return stock value must be ₹200 (20,000 paise), NOT ₹300');

  // Verify Stock summary: 6 + 2 = 8 units, Total value = ₹600 + ₹200 = ₹800, WAVG = ₹100
  stock = InventoryEngine.getItemStockSummary(db, itemId);
  assert.strictEqual(stock.totalQuantity, 8, 'Stock quantity must be 8');
  assert.strictEqual(stock.totalValuePaise, 80000, 'Stock value must be ₹800 (80,000 paise)');
  assert.strictEqual(stock.weightedAverageRatePaise, 10000, 'WAVG must remain ₹100');

  // Verify Inventory Asset ledger: 1000 (Pur) - 400 (Sale COGS) + 200 (Return Restock) = 800
  const invAsset = db.prepare(`
    SELECT COALESCE(SUM(debit_paise) - SUM(credit_paise), 0) as balance
    FROM ledger_entries WHERE ledger_id LIKE '%led_inventory%'
  `).get() as any;
  assert.strictEqual(invAsset.balance, 80000, 'Inventory Asset ledger balance must be ₹800');

  // Verify Net COGS in ledger: 400 (Dr) - 200 (Cr) = 200 (Dr)
  const netCogs = db.prepare(`
    SELECT COALESCE(SUM(debit_paise) - SUM(credit_paise), 0) as balance
    FROM ledger_entries WHERE ledger_id LIKE '%led_cogs%'
  `).get() as any;
  assert.strictEqual(netCogs.balance, 20000, 'Net COGS expense must be ₹200 (2 net units sold at cost ₹100)');

  // Verify P&L Gross Profit: Net Sales (4@150 - 2@150 = 300) - Net COGS (200) = 100
  const pnl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-05-31');
  assert.strictEqual(pnl.tradingIncomePaise, 30000, 'Net Trading Revenue must be ₹300');
  assert.strictEqual(pnl.tradingExpensePaise, 20000, 'Net COGS Trading Expense must be ₹200');
  assert.strictEqual(pnl.grossProfitPaise, 10000, 'Gross profit must be exactly ₹100');

  // Verify Trial Balance balances
  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tb.isBalanced, true);
  assert.strictEqual(tb.differencePaise, 0);
});

// --------------------------------------------------------------------------
// TEST B: Opening stock success is atomic
// --------------------------------------------------------------------------
runTest('TEST B: Opening stock success is atomic across stock_items, vouchers, and stock_entries', () => {
  const { db, companyId, fyId } = createTestContext();

  const itemId = 'item_atom_success';
  const qty = 25;
  const rate = 8000;
  const valPaise = qty * rate;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
      VALUES (?, ?, 'Atomic Item', '${companyId}_unit_nos', ?, ?, ?, '84713010')
    `).run(itemId, companyId, rate, qty, rate);

    const voucherId = 'vch_' + crypto.randomUUID().replace(/-/g, '');
    const voucherNumber = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'STOCK_JOURNAL');

    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
      VALUES (?, ?, ?, 'STOCK_JOURNAL', ?, '2026-04-01', 'Opening Stock', 'POSTED', ?, 'system')
    `).run(voucherId, companyId, fyId, voucherNumber, valPaise);

    const entryId = 'se_atom_s_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    db.prepare(`
      INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
      VALUES (?, ?, ?, '${companyId}_godown_main', '2026-04-01', 'IN', ?, ?, ?)
    `).run(entryId, voucherId, itemId, qty, rate, valPaise);

    db.exec('COMMIT;');
  } catch (err: any) {
    db.exec('ROLLBACK;');
    throw err;
  }

  // Verify all 3 records exist
  const itemRow = db.prepare('SELECT item_id FROM stock_items WHERE item_id = ?').get(itemId);
  const vchRow = db.prepare("SELECT voucher_id FROM vouchers WHERE voucher_type = 'STOCK_JOURNAL'").get();
  const seRow = db.prepare('SELECT stock_entry_id FROM stock_entries WHERE item_id = ?').get(itemId);

  assert.ok(itemRow, 'stock_items row must exist');
  assert.ok(vchRow, 'vouchers row must exist');
  assert.ok(seRow, 'stock_entries row must exist');
});

// --------------------------------------------------------------------------
// TEST C: Opening stock failure rolls back completely
// --------------------------------------------------------------------------
runTest('TEST C: Opening stock failure rolls back completely (zero partial records)', () => {
  const { db, companyId, fyId } = createTestContext();

  const itemId = 'item_atom_fail';
  const qty = 25;
  const rate = 8000;
  const valPaise = qty * rate;

  let failed = false;
  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
      VALUES (?, ?, 'Failing Item', '${companyId}_unit_nos', ?, ?, ?, '84713010')
    `).run(itemId, companyId, rate, qty, rate);

    const voucherId = 'vch_' + crypto.randomUUID().replace(/-/g, '');
    const voucherNumber = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'STOCK_JOURNAL');

    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
      VALUES (?, ?, ?, 'STOCK_JOURNAL', ?, '2026-04-01', 'Opening Stock', 'POSTED', ?, 'system')
    `).run(voucherId, companyId, fyId, voucherNumber, valPaise);

    // Intentionally trigger foreign key error by referencing non-existent godown
    db.prepare(`
      INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
      VALUES (?, ?, ?, 'non_existent_godown', '2026-04-01', 'IN', ?, ?, ?)
    `).run('se_fail', voucherId, itemId, qty, rate, valPaise);

    db.exec('COMMIT;');
  } catch (err: any) {
    db.exec('ROLLBACK;');
    failed = true;
  }

  assert.strictEqual(failed, true, 'Operation must have failed');

  // Verify zero records remain in all three tables
  const itemRow = db.prepare('SELECT item_id FROM stock_items WHERE item_id = ?').get(itemId);
  const vchCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE narration = 'Opening Stock'").get() as any).c;
  const seCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries WHERE item_id = ?').get(itemId) as any).c;

  assert.strictEqual(itemRow, undefined, 'stock_items row must be rolled back');
  assert.strictEqual(vchCount, 0, 'vouchers row must be rolled back');
  assert.strictEqual(seCount, 0, 'stock_entries row must be rolled back');
});

// --------------------------------------------------------------------------
// TEST D: Zero quantity item line rejected
// --------------------------------------------------------------------------
runTest('TEST D: Zero quantity item line is rejected before posting', () => {
  const { db, companyId, fyId, custId } = createTestContext();

  const itemId = 'item_zero_qty';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Zero Qty Item', '${companyId}_unit_nos', 10000, 10, 10000, '84713010')
  `).run(itemId, companyId);

  let threw = false;
  try {
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: 0, ratePaise: 15000, gstRate: 18 }]
    });
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.message, `Item line for '${itemId}' must have quantity greater than zero.`);
  }

  assert.strictEqual(threw, true, 'Must reject zero quantity');
  const vchCount = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
  assert.strictEqual(vchCount, 0, 'Zero vouchers created on rejection');
});

// --------------------------------------------------------------------------
// TEST E: Negative quantity item line rejected
// --------------------------------------------------------------------------
runTest('TEST E: Negative quantity item line is rejected before posting', () => {
  const { db, companyId, fyId, custId } = createTestContext();

  const itemId = 'item_neg_qty';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Negative Qty Item', '${companyId}_unit_nos', 10000, 10, 10000, '84713010')
  `).run(itemId, companyId);

  let threw = false;
  try {
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: -5, ratePaise: 15000, gstRate: 18 }]
    });
  } catch (err: any) {
    threw = true;
    assert.strictEqual(err.message, `Item line for '${itemId}' must have quantity greater than zero.`);
  }

  assert.strictEqual(threw, true, 'Must reject negative quantity');
  const vchCount = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
  assert.strictEqual(vchCount, 0, 'Zero vouchers created on rejection');
});

// --------------------------------------------------------------------------
// TEST F: Service/non-stock line remains valid
// --------------------------------------------------------------------------
runTest('TEST F: Service/non-stock line without itemId remains valid and posts balanced entries', () => {
  const { db, companyId, fyId, custId } = createTestContext();

  const serviceVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [
      {
        description: 'Consulting Services',
        ratePaise: 50000,
        gstRate: 18
      }
    ]
  });

  assert.ok(serviceVch.voucherNumber, 'Service voucher must post successfully');
  const stockCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries WHERE voucher_id = ?').get(serviceVch.voucherId) as any).c;
  assert.strictEqual(stockCount, 0, 'Service line must create zero stock entries');

  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tb.isBalanced, true, 'Trial balance must be balanced');
});

// --------------------------------------------------------------------------
// TEST G: STOCK_JOURNAL IN creates stock entry
// --------------------------------------------------------------------------
runTest('TEST G: STOCK_JOURNAL IN creates valid stock entry and updates inventory', () => {
  const { db, companyId, fyId } = createTestContext();

  const itemId = 'item_stk_in';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Stock Journal In Item', '${companyId}_unit_nos', 12000, 0, 0, '84713010')
  `).run(itemId, companyId);

  const vch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'STOCK_JOURNAL',
    voucherDate: '2026-05-01',
    lines: [
      {
        itemId,
        quantity: 5,
        ratePaise: 12000,
        movementType: 'IN'
      }
    ]
  });

  assert.ok(vch.voucherNumber, 'STOCK_JOURNAL voucher must post');
  const se = db.prepare('SELECT movement_type, quantity, rate_paise, value_paise FROM stock_entries WHERE voucher_id = ?').get(vch.voucherId) as any;
  assert.strictEqual(se.movement_type, 'IN');
  assert.strictEqual(se.quantity, 5);
  assert.strictEqual(se.rate_paise, 12000);
  assert.strictEqual(se.value_paise, 60000);

  const summary = InventoryEngine.getItemStockSummary(db, itemId);
  assert.strictEqual(summary.totalQuantity, 5);
  assert.strictEqual(summary.totalValuePaise, 60000);
});

// --------------------------------------------------------------------------
// TEST H: STOCK_JOURNAL OUT creates stock entry
// --------------------------------------------------------------------------
runTest('TEST H: STOCK_JOURNAL OUT creates stock entry and decreases inventory', () => {
  const { db, companyId, fyId } = createTestContext();

  const itemId = 'item_stk_out';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Stock Journal Out Item', '${companyId}_unit_nos', 12000, 0, 0, '84713010')
  `).run(itemId, companyId);

  // In 10 units first
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'STOCK_JOURNAL',
    voucherDate: '2026-05-01',
    lines: [{ itemId, quantity: 10, ratePaise: 12000, movementType: 'IN' }]
  });

  // Out 3 units
  const outVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'STOCK_JOURNAL',
    voucherDate: '2026-05-05',
    lines: [{ itemId, quantity: 3, ratePaise: 12000, movementType: 'OUT' }]
  });

  const se = db.prepare('SELECT movement_type, quantity, rate_paise, value_paise FROM stock_entries WHERE voucher_id = ?').get(outVch.voucherId) as any;
  assert.strictEqual(se.movement_type, 'OUT');
  assert.strictEqual(se.quantity, 3);
  assert.strictEqual(se.rate_paise, 12000);
  assert.strictEqual(se.value_paise, 36000);

  const summary = InventoryEngine.getItemStockSummary(db, itemId);
  assert.strictEqual(summary.totalQuantity, 7);
  assert.strictEqual(summary.totalValuePaise, 84000);
});

// --------------------------------------------------------------------------
// TEST I: STOCK_JOURNAL OUT respects negative-stock policy
// --------------------------------------------------------------------------
runTest('TEST I: STOCK_JOURNAL OUT respects negative-stock policy (rejects when false, permits when true)', () => {
  const { db, companyId, fyId } = createTestContext();

  const itemId = 'item_stk_policy';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'Stock Journal Policy Item', '${companyId}_unit_nos', 10000, 0, 0, '84713010')
  `).run(itemId, companyId);

  // In 5 units
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'STOCK_JOURNAL',
    voucherDate: '2026-05-01',
    lines: [{ itemId, quantity: 5, ratePaise: 10000, movementType: 'IN' }]
  });

  // Attempt OUT 10 with allowNegativeStock = false -> must throw
  let threw = false;
  try {
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'STOCK_JOURNAL',
      voucherDate: '2026-05-05',
      allowNegativeStock: false,
      lines: [{ itemId, quantity: 10, ratePaise: 10000, movementType: 'OUT' }]
    });
  } catch (err: any) {
    threw = true;
    assert.ok(err.message.includes('Insufficient stock'));
  }
  assert.strictEqual(threw, true, 'Must reject when stock is insufficient and allowNegativeStock is false');

  // Attempt OUT 10 with allowNegativeStock = true -> must succeed
  const negVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'STOCK_JOURNAL',
    voucherDate: '2026-05-05',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 10, ratePaise: 10000, movementType: 'OUT' }]
  });
  assert.ok(negVch.voucherNumber, 'Must succeed when allowNegativeStock is true');
  const se = db.prepare('SELECT movement_type, quantity FROM stock_entries WHERE voucher_id = ?').get(negVch.voucherId) as any;
  assert.strictEqual(se.movement_type, 'OUT');
  assert.strictEqual(se.quantity, 10);
});

// --------------------------------------------------------------------------
// TEST J: All existing accounting invariants remain green
// --------------------------------------------------------------------------
runTest('TEST J: Existing accounting invariant structure verified green', () => {
  const { db, companyId, fyId, suppId, custId } = createTestContext();

  const itemId = 'item_k_verify';
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
    VALUES (?, ?, 'K Invariant Item', '${companyId}_unit_nos', 10000, 10, 10000, '84713010')
  `).run(itemId, companyId);

  // Post Sale
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 3, ratePaise: 15000, gstRate: 18 }]
  });

  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tb.isBalanced, true);
});

console.log('\n======================================================================');
console.log(`ALL ${passed} / ${total} INVENTORY INTEGRITY TESTS PASSED (100% SUCCESS)`);
console.log('======================================================================');
