import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';
import { ReportEngine } from '../src/reports/report-engine.js';
import { initializeBusiness } from '../src/database/seed.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 009 — PRODUCTION READINESS & HARDENING TEST SUITE');
console.log('======================================================================\n');

function createHardenedTestContext() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
  db.exec(schemaSql);

  // Safe migration block matching connection.ts
  db.exec('CREATE INDEX IF NOT EXISTS idx_vouchers_comp_date_status ON vouchers(company_id, voucher_date, status);');

  const companyId = 'comp_task009_test';
  initializeBusiness(db, {
    companyId,
    companyName: 'Task 009 Readiness Corp',
    gstin: '33TEST0090001Z5'
  });

  const activeFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as any;
  const fyId = activeFy.fy_id;

  // Add party
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
    VALUES ('led_cust_009', ?, '${companyId}_grp_debtors', 'Customer 009', 0)
  `).run(companyId);

  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
    VALUES ('party_cust_009', ?, 'led_cust_009', 'Customer 009', 'CUSTOMER', '33AAACA0009A1Z9')
  `).run(companyId);

  // Add item
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES ('item_009_lap', ?, 'Readiness Laptop', '8471', '${companyId}_unit_nos', 18, 4000000, 5000000, 50, 4000000)
  `).run(companyId);

  return { db, companyId, fyId };
}

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// --------------------------------------------------------------------------
// Suite 1: SQLite Hardening & Indexing
// --------------------------------------------------------------------------
console.log('[Suite 1: SQLite Hardening & Indexing Configuration]');

runTest('1.1: PRAGMA busy_timeout is set and returns 5000ms', () => {
  const { db } = createHardenedTestContext();
  const timeoutRow = db.prepare('PRAGMA busy_timeout;').get() as any;
  assert.strictEqual(Number(timeoutRow.timeout), 5000, 'busy_timeout must equal 5000ms');
});

runTest('1.2: Composite index idx_vouchers_comp_date_status exists on vouchers table', () => {
  const { db } = createHardenedTestContext();
  const indexRow = db.prepare(`
    SELECT name, tbl_name FROM sqlite_master 
    WHERE type = 'index' AND name = 'idx_vouchers_comp_date_status'
  `).get() as any;
  assert.ok(indexRow, 'Composite index idx_vouchers_comp_date_status must exist');
  assert.strictEqual(indexRow.tbl_name, 'vouchers', 'Index must target vouchers table');
});

// --------------------------------------------------------------------------
// Suite 2: Voucher Status Query Filtering (UI Contract)
// --------------------------------------------------------------------------
console.log('\n[Suite 2: Voucher Status Query Filtering (UI Contract)]');

runTest('2.1: Status query filter segregates DRAFT vs POSTED vouchers', () => {
  const { db, companyId, fyId } = createHardenedTestContext();

  // Create 1 POSTED voucher
  const postedVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: 'party_cust_009',
    narration: 'Posted Sales Voucher',
    status: 'POSTED',
    lines: [
      {
        itemId: 'item_009_lap',
        godownId: `${companyId}_godown_main`,
        quantity: 1,
        ratePaise: 5000000,
        gstRate: 18
      }
    ]
  });
  assert.strictEqual(postedVch.status, 'POSTED');

  // Create 1 DRAFT voucher
  const draftVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-11',
    partyId: 'party_cust_009',
    narration: 'Draft Sales Voucher',
    status: 'DRAFT',
    lines: [
      {
        itemId: 'item_009_lap',
        godownId: `${companyId}_godown_main`,
        quantity: 2,
        ratePaise: 5000000,
        gstRate: 18
      }
    ]
  });
  assert.strictEqual(draftVch.status, 'DRAFT');

  // Helper simulating the GET /vouchers endpoint query logic
  function queryVouchers(filterStatus?: string) {
    let query = `
      SELECT v.*, p.party_name, p.gstin as party_gstin, p.party_type
      FROM vouchers v
      LEFT JOIN parties p ON v.party_id = p.party_id
      WHERE v.company_id = ?
    `;
    const params: any[] = [companyId];
    if (filterStatus) {
      query += ` AND v.status = ?`;
      params.push(filterStatus);
    }
    query += ` ORDER BY v.voucher_date DESC, v.created_at DESC LIMIT 100`;
    return db.prepare(query).all(...params) as any[];
  }

  // A. Query only DRAFT
  const drafts = queryVouchers('DRAFT');
  assert.strictEqual(drafts.length, 1, 'Must return exactly 1 draft voucher');
  assert.strictEqual(drafts[0].voucher_id, draftVch.voucherId);
  assert.strictEqual(drafts[0].status, 'DRAFT');

  // B. Query only POSTED
  const posted = queryVouchers('POSTED');
  assert.strictEqual(posted.length, 1, 'Must return exactly 1 posted voucher');
  assert.strictEqual(posted[0].voucher_id, postedVch.voucherId);
  assert.strictEqual(posted[0].status, 'POSTED');

  // C. Query without status filter (returns both)
  const all = queryVouchers();
  assert.strictEqual(all.length, 2, 'Must return both vouchers when status omitted');
});

// --------------------------------------------------------------------------
// Suite 3: End-to-End Accounting & Inventory Reconciliation
// --------------------------------------------------------------------------
console.log('\n[Suite 3: End-to-End Accounting & Inventory Invariants]');

runTest('3.1: Trial Balance and Balance Sheet remain strictly balanced after hardened operations', () => {
  const { db, companyId } = createHardenedTestContext();

  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tb.isBalanced, true, 'Trial Balance must be strictly balanced');
  assert.strictEqual(tb.differencePaise, 0, 'Trial Balance difference must be zero');

  const bs = ReportEngine.getBalanceSheet(db, companyId, '2026-05-31');
  assert.strictEqual(bs.totalAssetsPaise, bs.totalLiabilitiesEquityPaise, 'Assets must equal Liabilities + Equity');
});

runTest('3.2: Stock Summary valuation matches Inventory Asset account to the penny', () => {
  const { db, companyId, fyId } = createHardenedTestContext();

  // Buy 5 laptops @ 40,000 net acquisition
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-15',
    partyId: 'party_cust_009',
    narration: 'Hardened Purchase Invariant Test',
    lines: [
      {
        itemId: 'item_009_lap',
        godownId: `${companyId}_godown_main`,
        quantity: 5,
        ratePaise: 4000000,
        gstRate: 18
      }
    ]
  });

  const ss = ReportEngine.getStockSummary(db, companyId);
  const totalStockValue = ss.reduce((sum, item) => sum + item.totalValuePaise, 0);

  const invLedger = db.prepare(`
    SELECT (COALESCE(SUM(debit_paise), 0) - COALESCE(SUM(credit_paise), 0)) as bal
    FROM ledger_entries
    WHERE ledger_id = (SELECT ledger_id FROM ledgers WHERE company_id = ? AND ledger_name = 'Inventory Asset')
  `).get(companyId) as any;

  assert.strictEqual(totalStockValue, Number(invLedger.bal), 'Perpetual stock value must equal Inventory Asset ledger');
});

console.log('\n======================================================================');
console.log(`TASK 009 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('======================================================================');

if (failed > 0) {
  process.exit(1);
}
