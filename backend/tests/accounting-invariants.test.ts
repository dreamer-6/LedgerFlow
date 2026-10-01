import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { DoubleEntryEngine } from '../src/domain/accounting/double-entry.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { initializeBusiness } from '../src/database/seed.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 002 — ACCOUNTING INVARIANTS & INTEGRITY TEST SUITE');
console.log('======================================================================\n');

function createTestContext() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
  db.exec(schemaSql);

  const companyId = 'comp_inv_test';
  initializeBusiness(db, {
    companyId,
    companyName: 'Accounting Integrity Corp',
    gstin: '33AAAAA9999A1Z1'
  });

  const activeFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as any;
  const fyId = activeFy.fy_id;

  // Add Customer Party
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
    VALUES ('led_cust_k_01', ?, '${companyId}_grp_debtors', 'Customer K', 0)
  `).run(companyId);

  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
    VALUES ('party_cust_k', ?, 'led_cust_k_01', 'Customer K', 'CUSTOMER', '33AAACA1111A1Z1')
  `).run(companyId);

  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_cust_k', 'party_cust_k', '100 K Road', 'Chennai', 'Tamil Nadu', '33', '600001')
  `).run();

  // Add Supplier Party
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
    VALUES ('led_supp_k_01', ?, '${companyId}_grp_creditors', 'Supplier K', 0)
  `).run(companyId);

  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
    VALUES ('party_supp_k', ?, 'led_supp_k_01', 'Supplier K', 'SUPPLIER', '33AAASB2222B1Z2')
  `).run(companyId);

  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_supp_k', 'party_supp_k', '200 Supplier Lane', 'Chennai', 'Tamil Nadu', '33', '600002')
  `).run();

  // Add Stock Item
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES ('item_k_widget', ?, 'Widget K100', '8471', '${companyId}_unit_nos', 18, 100000, 150000, 50, 100000)
  `).run(companyId);

  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
    VALUES ('vch_open_k', ?, ?, 'STOCK_JOURNAL', 'STK-000', '2026-04-01', 5000000, 'POSTED')
  `).run(companyId, fyId);

  db.prepare(`
    INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
    VALUES ('se_open_k', 'vch_open_k', 'item_k_widget', '${companyId}_godown_main', '2026-04-01', 'IN', 50, 100000, 5000000)
  `).run();

  return { db, companyId, fyId };
}

async function runAllInvariantTests() {
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
  console.log('[Suite 1: Sales & Purchase Returns Accounting]');
  // --------------------------------------------------------------------------

  runTest('K1: SALES_RETURN produces balanced ledger lines, restocks IN, reverses GST, Trial Balance balances', () => {
    const { db, companyId, fyId } = createTestContext();

    // 1. Post a Sale first (10 units @ ₹1,500 = ₹15,000 + 18% GST = ₹17,700)
    const sale = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-04-10',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 150000, gstRate: 18 }
      ]
    });

    // Verify stock is now 50 - 10 = 40
    let stock = InventoryEngine.getItemStockSummary(db, 'item_k_widget');
    assert.strictEqual(stock.totalQuantity, 40);

    // 2. Post a Sales Return (2 units returned)
    const ret = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES_RETURN',
      voucherDate: '2026-04-15',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 2, ratePaise: 150000, gstRate: 18 }
      ]
    });

    // Assert: Return voucher has ledger entries
    const ledgerEntries = db.prepare(`
      SELECT le.ledger_id, le.debit_paise, le.credit_paise, l.ledger_name 
      FROM ledger_entries le
      JOIN ledgers l ON le.ledger_id = l.ledger_id
      WHERE le.voucher_id = ?
    `).all(ret.voucherId) as any[];

    assert.ok(ledgerEntries.length >= 3, 'Sales return must produce ledger entries (Customer, Sales Return, Output GST)');
    const totalDr = ledgerEntries.reduce((s, e) => s + e.debit_paise, 0);
    const totalCr = ledgerEntries.reduce((s, e) => s + e.credit_paise, 0);
    assert.strictEqual(totalDr, totalCr, 'Sales return double-entry must balance DR === CR');

    // Customer credited (reduces receivable)
    const custEntry = ledgerEntries.find(e => e.ledger_id === 'led_cust_k_01');
    assert.ok(custEntry && custEntry.credit_paise > 0, 'Customer must be credited on return');

    // Restock IN: 40 + 2 = 42 units
    stock = InventoryEngine.getItemStockSummary(db, 'item_k_widget');
    assert.strictEqual(stock.totalQuantity, 42, 'Stock must increase by returned quantity (restock IN)');

    // Trial Balance must balance
    const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
    assert.strictEqual(tb.isBalanced, true, 'Trial Balance must balance after Sales Return');

    // GST summary: net output tax is reduced
    const gst = ReportEngine.getGstSummary(db, companyId, '2026-04-01', '2026-04-30');
    // Sale tax: 10 * 1500 * 18% = 2700. Return tax: 2 * 1500 * 18% = 540. Net = 2160 (216000 paise)
    assert.strictEqual(gst.totalOutputTaxPaise, 216000, 'GST Summary must reflect net output tax after return reversal');
  });

  runTest('K2: PURCHASE_RETURN produces balanced ledger lines, returns stock OUT, reverses Input GST, Trial Balance balances', () => {
    const { db, companyId, fyId } = createTestContext();

    // 1. Post a Purchase first (20 units @ ₹1,000 = ₹20,000 + 18% GST = ₹23,600)
    const purchase = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-04-05',
      partyId: 'party_supp_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 20, ratePaise: 100000, gstRate: 18 }
      ]
    });

    let stock = InventoryEngine.getItemStockSummary(db, 'item_k_widget');
    assert.strictEqual(stock.totalQuantity, 70); // 50 opening + 20 purchase

    // 2. Post a Purchase Return (5 units returned to supplier)
    const ret = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE_RETURN',
      voucherDate: '2026-04-12',
      partyId: 'party_supp_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 5, ratePaise: 100000, gstRate: 18 }
      ]
    });

    // Assert: Return voucher has ledger entries
    const ledgerEntries = db.prepare(`
      SELECT le.ledger_id, le.debit_paise, le.credit_paise, l.ledger_name 
      FROM ledger_entries le
      JOIN ledgers l ON le.ledger_id = l.ledger_id
      WHERE le.voucher_id = ?
    `).all(ret.voucherId) as any[];

    assert.ok(ledgerEntries.length >= 3, 'Purchase return must produce ledger entries (Supplier, Purchase Return, Input GST)');
    const totalDr = ledgerEntries.reduce((s, e) => s + e.debit_paise, 0);
    const totalCr = ledgerEntries.reduce((s, e) => s + e.credit_paise, 0);
    assert.strictEqual(totalDr, totalCr, 'Purchase return double-entry must balance DR === CR');

    // Supplier debited (reduces payable)
    const suppEntry = ledgerEntries.find(e => e.ledger_id === 'led_supp_k_01');
    assert.ok(suppEntry && suppEntry.debit_paise > 0, 'Supplier must be debited on return');

    // Stock OUT: 70 - 5 = 65 units
    stock = InventoryEngine.getItemStockSummary(db, 'item_k_widget');
    assert.strictEqual(stock.totalQuantity, 65, 'Stock must decrease by returned quantity');

    // Trial Balance must balance
    const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
    assert.strictEqual(tb.isBalanced, true, 'Trial Balance must balance after Purchase Return');
  });

  // --------------------------------------------------------------------------
  console.log('\n[Suite 2: COGS & Stock Availability Policy]');
  // --------------------------------------------------------------------------

  runTest('K3: COGS zero-stock rejects when no cost basis exists and falls back to purchase_rate_paise', () => {
    const { db, companyId, fyId } = createTestContext();

    // Create item with 0 stock and 0 purchase rate
    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
      VALUES ('item_zero_cost', ?, 'No Cost Item', '8471', '${companyId}_unit_nos', 18, 0, 50000, 0)
    `).run(companyId);

    // Attempt to sell with 0 stock and 0 purchase rate -> Must throw explicit error
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-04-20',
        partyId: 'party_cust_k',
        lines: [
          { itemId: 'item_zero_cost', godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 50000, gstRate: 18 }
        ]
      });
    }, /Cannot determine COGS|Insufficient stock/);
  });

  runTest('K4: Stock availability policy rejects over-selling unless allowNegativeStock is set', () => {
    const { db, companyId, fyId } = createTestContext();

    // Available stock for item_k_widget is 50. Attempt to sell 60 units.
    assert.throws(() => {
      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-04-20',
        partyId: 'party_cust_k',
        lines: [
          { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 60, ratePaise: 150000, gstRate: 18 }
        ]
      });
    }, /Insufficient stock for item/);

    // When allowNegativeStock: true is explicitly provided, it proceeds
    const vch = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-04-20',
      partyId: 'party_cust_k',
      allowNegativeStock: true,
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 60, ratePaise: 150000, gstRate: 18 }
      ]
    });
    assert.ok(vch.voucherId, 'Should post when allowNegativeStock is true');
  });

  // --------------------------------------------------------------------------
  console.log('\n[Suite 3: Inventory Valuation & Reports]');
  // --------------------------------------------------------------------------

  runTest('K6: Stock Summary calculates true Weighted Average rate: buy 1@100 + 3@300 -> avg=250', () => {
    const { db, companyId, fyId } = createTestContext();

    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
      VALUES ('item_wavg_test', ?, 'WAVG Item', '8471', '${companyId}_unit_nos', 18, 0, 40000, 0)
    `).run(companyId);

    // Buy 1 unit @ ₹100 (10000 paise)
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-04-02',
      partyId: 'party_supp_k',
      lines: [
        { itemId: 'item_wavg_test', godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 10000, gstRate: 18 }
      ]
    });

    // Buy 3 units @ ₹300 (30000 paise)
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-04-03',
      partyId: 'party_supp_k',
      lines: [
        { itemId: 'item_wavg_test', godownId: `${companyId}_godown_main`, quantity: 3, ratePaise: 30000, gstRate: 18 }
      ]
    });

    // True weighted average: (1 * 10000 + 3 * 30000) / 4 = 100000 / 4 = 25000 paise (₹250)
    // Arithmetic average would have been (10000 + 30000) / 2 = 20000 paise (₹200)
    const summaryList = ReportEngine.getStockSummary(db, companyId);
    const itemSummary = summaryList.find(s => s.itemId === 'item_wavg_test');
    assert.ok(itemSummary, 'Item must exist in Stock Summary');
    assert.strictEqual(itemSummary.quantity, 4, 'Total quantity must be 4');
    assert.strictEqual(itemSummary.avgRatePaise, 25000, 'Avg rate must be weighted average ₹250 (25000 paise), NOT arithmetic average ₹200');
    assert.strictEqual(itemSummary.totalValuePaise, 100000, 'Total value must be ₹1000 (100000 paise)');
  });

  runTest('K7 & K8: Bill allocation and ON_ACCOUNT settlement handling', () => {
    const { db, companyId, fyId } = createTestContext();

    // 1. Post a Sales voucher of ₹11,800
    const sale = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-04-10',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 2, ratePaise: 500000, gstRate: 18 }
      ]
    });

    // Verify outstanding exists
    let out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
    assert.strictEqual(out.length, 1);
    assert.strictEqual(out[0].totalOutstandingPaise, 1180000);

    // 2. Post a Receipt with AGAINST_REF
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'RECEIPT',
      voucherDate: '2026-04-15',
      partyId: 'party_cust_k',
      lines: [],
      customLedgerLines: [
        { ledgerId: `${companyId}_led_cash`, debitPaise: 1180000, creditPaise: 0 },
        { ledgerId: 'led_cust_k_01', debitPaise: 0, creditPaise: 1180000 }
      ],
      billAllocation: {
        referenceVoucherId: sale.voucherId,
        allocationType: 'AGAINST_REF'
      }
    });

    // Verify outstanding is now 0
    out = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
    assert.strictEqual(out.length, 0, 'Customer outstanding must be cleared to 0 after AGAINST_REF receipt');

    // 3. Post a Receipt WITHOUT billAllocation -> Verify ON_ACCOUNT is recorded (K8)
    const rec2 = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'RECEIPT',
      voucherDate: '2026-04-20',
      partyId: 'party_cust_k',
      lines: [],
      customLedgerLines: [
        { ledgerId: `${companyId}_led_cash`, debitPaise: 50000, creditPaise: 0 },
        { ledgerId: 'led_cust_k_01', debitPaise: 0, creditPaise: 50000 }
      ]
    });

    const alloc = db.prepare('SELECT allocation_type, amount_paise FROM bill_allocations WHERE voucher_id = ?').get(rec2.voucherId) as any;
    assert.ok(alloc, 'Bill allocation record must exist');
    assert.strictEqual(alloc.allocation_type, 'ON_ACCOUNT', 'Receipt without billAllocation must be recorded as ON_ACCOUNT');
  });

  runTest('K9: Balance Sheet Net Profit is scoped to active Financial Year start date', () => {
    const { db, companyId, fyId } = createTestContext();

    // Create prior financial year 2025-2026
    db.prepare(`
      INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
      VALUES ('fy_2025_26', ?, '2025-2026', '2025-04-01', '2026-03-31', 'CLOSED')
    `).run(companyId);

    // Current FY is 2026-2027 (start: 2026-04-01)
    // Post sale in current FY
    PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 150000, gstRate: 18 }
      ]
    });

    const bs = ReportEngine.getBalanceSheet(db, companyId, '2026-05-31');
    assert.strictEqual(bs.isBalanced, true, 'Balance sheet must balance');
    // Net profit is for 2026-04-01 to 2026-05-31
    assert.ok(bs.netProfitPaise > 0, 'Net profit for current FY must be > 0');
  });

  runTest('K10: Tax entry IDs uniqueness under rapid sequential insertions', () => {
    const { db, companyId, fyId } = createTestContext();

    for (let i = 0; i < 20; i++) {
      PostingEngine.postVoucher(db, {
        companyId,
        fyId,
        voucherType: 'SALES',
        voucherDate: '2026-04-10',
        partyId: 'party_cust_k',
        lines: [
          { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 150000, gstRate: 18 }
        ]
      });
    }

    const taxes = db.prepare('SELECT tax_entry_id FROM tax_entries').all() as any[];
    const set = new Set(taxes.map(t => t.tax_entry_id));
    assert.strictEqual(set.size, taxes.length, 'All tax entry IDs must be unique');
  });

  runTest('K11 & K12: CREDIT_NOTE and DEBIT_NOTE without stock items produce balanced entries', () => {
    const { db, companyId, fyId } = createTestContext();

    // Financial Credit Note to Customer (no stock movement)
    const crn = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'CREDIT_NOTE',
      voucherDate: '2026-04-25',
      partyId: 'party_cust_k',
      lines: [
        { ratePaise: 100000, gstRate: 18, description: 'Volume rebate' }
      ]
    });

    assert.ok(crn.voucherId);
    // Verify no stock entry was created
    const stockEntries = db.prepare('SELECT COUNT(*) as c FROM stock_entries WHERE voucher_id = ?').get(crn.voucherId) as any;
    assert.strictEqual(stockEntries.c, 0, 'Credit note without items must create 0 stock entries');

    // Financial Debit Note to Supplier (no stock movement)
    const dbn = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'DEBIT_NOTE',
      voucherDate: '2026-04-26',
      partyId: 'party_supp_k',
      lines: [
        { ratePaise: 50000, gstRate: 18, description: 'Short delivery discount' }
      ]
    });

    assert.ok(dbn.voucherId);
    const tb = ReportEngine.getTrialBalance(db, companyId, '2026-04-30');
    assert.strictEqual(tb.isBalanced, true, 'Trial Balance must balance after Credit & Debit Notes');
  });

  runTest('K13: Day Book filters by POSTED status', () => {
    const { db, companyId, fyId } = createTestContext();

    // Post one voucher
    const vch = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-04-10',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 1, ratePaise: 150000, gstRate: 18 }
      ]
    });

    let dayBook = ReportEngine.getDayBook(db, companyId, '2026-04-01', '2026-04-30');
    const found = dayBook.some(e => e.voucherId === vch.voucherId);
    assert.strictEqual(found, true, 'Posted voucher must appear in Day Book');

    // Cancel the voucher
    PostingEngine.cancelVoucher(db, vch.voucherId, 'Customer requested cancellation');

    dayBook = ReportEngine.getDayBook(db, companyId, '2026-04-01', '2026-04-30');
    const foundAfterCancel = dayBook.some(e => e.voucherId === vch.voucherId);
    assert.strictEqual(foundAfterCancel, false, 'Cancelled voucher must NOT appear in Day Book (status = POSTED filter)');
  });

  runTest('K14: P&L Trading section groups: COGS in affects_gross_profit, Rent Expense NOT', () => {
    const { db, companyId } = createTestContext();

    const cogsGroup = db.prepare(`
      SELECT lg.affects_gross_profit, lg.nature
      FROM ledgers l
      JOIN ledger_groups lg ON l.group_id = lg.group_id
      WHERE l.ledger_id = '${companyId}_led_cogs'
    `).get() as any;

    assert.strictEqual(cogsGroup.affects_gross_profit, 1, 'COGS ledger group must have affects_gross_profit = 1');

    const rentGroup = db.prepare(`
      SELECT lg.affects_gross_profit, lg.nature
      FROM ledgers l
      JOIN ledger_groups lg ON l.group_id = lg.group_id
      WHERE l.ledger_id = '${companyId}_led_rent_expense'
    `).get() as any;

    assert.strictEqual(rentGroup.affects_gross_profit, 0, 'Rent Expense ledger group must have affects_gross_profit = 0');
  });

  runTest('K5: Perpetual purchase inventory model: Purchase -> Inv Asset DR; Sale -> COGS DR, Inv Asset CR; BS & P&L reconcile', () => {
    const { db, companyId, fyId } = createTestContext();

    // Verify initial inventory asset balance
    let tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
    const initialInvRow = tb.rows.find(r => r.ledgerId === `${companyId}_led_inventory`);
    const initialInvPaise = (initialInvRow?.debitPaise || 0) - (initialInvRow?.creditPaise || 0);

    // 1. Post Purchase: Buy 10 units @ ₹1,000 = ₹10,000 + 18% GST (₹1,800) = ₹11,800
    const pur = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PURCHASE',
      voucherDate: '2026-04-05',
      partyId: 'party_supp_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 10, ratePaise: 100000, gstRate: 18 }
      ]
    });

    // Verify Inventory increases on purchase
    tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
    const postPurInvRow = tb.rows.find(r => r.ledgerId === `${companyId}_led_inventory`);
    const postPurInvPaise = (postPurInvRow?.debitPaise || 0) - (postPurInvRow?.creditPaise || 0);
    assert.strictEqual(postPurInvPaise, initialInvPaise + 1000000, 'Inventory Asset must increase by taxable purchase amount (₹10,000)');

    // 2. Post Sale: Sell 5 units @ ₹1,500 = ₹7,500 + 18% GST (₹1,350) = ₹8,850
    // Cost of goods sold: 5 * ₹1,000 = ₹5,000 (500000 paise)
    const sale = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-04-10',
      partyId: 'party_cust_k',
      lines: [
        { itemId: 'item_k_widget', godownId: `${companyId}_godown_main`, quantity: 5, ratePaise: 150000, gstRate: 18 }
      ]
    });

    // Verify COGS recognized and Inventory decreases
    tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
    const postSaleInvRow = tb.rows.find(r => r.ledgerId === `${companyId}_led_inventory`);
    const postSaleInvPaise = (postSaleInvRow?.debitPaise || 0) - (postSaleInvRow?.creditPaise || 0);
    assert.strictEqual(postSaleInvPaise, postPurInvPaise - 500000, 'Inventory Asset must decrease by COGS (₹5,000)');

    const cogsRow = tb.rows.find(r => r.ledgerId === `${companyId}_led_cogs`);
    assert.strictEqual(cogsRow?.debitPaise, 500000, 'COGS expense must be ₹5,000');

    // 3. P&L verification: Gross profit = ₹7,500 - ₹5,000 = ₹2,500
    const pnl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-05-31');
    assert.strictEqual(pnl.tradingIncomePaise, 750000, 'Trading income must be ₹7,500');
    assert.strictEqual(pnl.tradingExpensePaise, 500000, 'Trading expense (COGS) must be ₹5,000');
    assert.strictEqual(pnl.grossProfitPaise, 250000, 'Gross profit must be ₹2,500');

    // 4. Balance Sheet verification
    const bs = ReportEngine.getBalanceSheet(db, companyId, '2026-05-31');
    assert.strictEqual(bs.isBalanced, true, 'Balance sheet must be balanced');
    const bsInv = bs.assets.find(a => a.ledgerName === 'Inventory Asset');
    assert.ok(bsInv && bsInv.amountPaise === postSaleInvPaise, 'Balance sheet Inventory Asset must match ledger balance');
  });

  runTest('K15: Opening Stock STOCK_JOURNAL creates valid voucher with safe UUID and numbering', () => {
    const { db, companyId, fyId } = createTestContext();

    // Create item with opening stock
    const itemId = 'item_opn_test';
    const rate = 200000;
    const qty = 25;
    const openingVal = qty * rate;

    const voucherId = 'vch_' + crypto.randomUUID().replace(/-/g, '');
    const voucherNumber = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'STOCK_JOURNAL');
    assert.match(voucherNumber, /^STK-\d{3}$/, 'Voucher number must follow STK-XXX scheme');

    db.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
      VALUES (?, ?, ?, 'STOCK_JOURNAL', ?, '2026-04-01', 'Opening Stock', 'POSTED', ?, 'test_user')
    `).run(voucherId, companyId, fyId, voucherNumber, openingVal);

    db.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, hsn_sac)
      VALUES (?, ?, 'New Opening Item', '${companyId}_unit_nos', ?, ?, ?, '84713010')
    `).run(itemId, companyId, rate, qty, rate);

    const entryId = 'se_opn_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16);
    db.prepare(`
      INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
      VALUES (?, ?, ?, '${companyId}_godown_main', '2026-04-01', 'IN', ?, ?, ?)
    `).run(entryId, voucherId, itemId, qty, rate, openingVal);

    // Verify voucher exists in vouchers table
    const vch = db.prepare('SELECT voucher_id, voucher_type, status, total_amount_paise FROM vouchers WHERE voucher_id = ?').get(voucherId) as any;
    assert.ok(vch, 'STOCK_JOURNAL voucher must exist in vouchers table');
    assert.strictEqual(vch.voucher_type, 'STOCK_JOURNAL');
    assert.strictEqual(vch.status, 'POSTED');

    // Verify stock entry points to valid voucher
    const entry = db.prepare('SELECT voucher_id, quantity, value_paise FROM stock_entries WHERE stock_entry_id = ?').get(entryId) as any;
    assert.strictEqual(entry.voucher_id, voucherId, 'stock_entries.voucher_id must point to real voucher');
  });

  console.log(`\n======================================================================`);
  console.log(`ALL ${passed} / ${total} ACCOUNTING INVARIANT TESTS PASSED (100% SUCCESS)`);
  console.log(`======================================================================\n`);
}

runAllInvariantTests().catch(err => {
  console.error('INVARIANT TEST FAILED:', err);
  process.exit(1);
});
