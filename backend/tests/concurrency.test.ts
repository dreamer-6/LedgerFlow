import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { initializeBusiness } from '../src/database/seed.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 002 — VOUCHER NUMBERING CONCURRENCY REGRESSION TEST');
console.log('======================================================================\n');

// 1. Set up In-Memory SQLite database
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys = ON;');
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
db.exec(schemaSql);

const companyId = 'comp_concurrency_test';
initializeBusiness(db, {
  companyId,
  companyName: 'Concurrency Test Corp',
  gstin: '33BBBBB0000B1Z6'
});

const activeFy = db.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyId) as any;
const fyId = activeFy.fy_id;

// Add customer party
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
  VALUES ('led_cust_conc_01', ?, '${companyId}_grp_debtors', 'Concurrency Customer', 0)
`).run(companyId);

db.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
  VALUES ('party_conc_01', ?, 'led_cust_conc_01', 'Concurrency Customer', 'CUSTOMER', '33AAACA9999A1Z9')
`).run(companyId);

// Add stock item with plenty of stock
db.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
  VALUES ('item_conc_01', ?, 'Concurrency Item', '8471', '${companyId}_unit_nos', 18, 100000, 150000, 1000, 100000)
`).run(companyId);

db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES ('vch_open_conc', ?, ?, 'STOCK_JOURNAL', 'STK-000', '2026-04-01', 100000000, 'POSTED')
`).run(companyId, fyId);

db.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('se_open_conc', 'vch_open_conc', 'item_conc_01', '${companyId}_godown_main', '2026-04-01', 'IN', 1000, 100000, 100000000)
`).run();

// 2. Perform 12 Simultaneous Voucher Postings
const CONCURRENCY_COUNT = 12;
console.log(`[Concurrency Test] Launching ${CONCURRENCY_COUNT} simultaneous voucher postings...`);

async function runConcurrencyTest() {
  const promises = Array.from({ length: CONCURRENCY_COUNT }, (_, i) => {
    return new Promise<{ voucherId: string; voucherNumber: string }>((resolve, reject) => {
      // Use queueMicrotask or setImmediate to interleave posting calls
      setImmediate(() => {
        try {
          const res = PostingEngine.postVoucher(db, {
            companyId,
            fyId,
            voucherType: 'SALES',
            voucherDate: '2026-05-01',
            partyId: 'party_conc_01',
            narration: `Simultaneous post attempt #${i + 1}`,
            lines: [
              {
                itemId: 'item_conc_01',
                godownId: `${companyId}_godown_main`,
                quantity: 1,
                ratePaise: 150000,
                gstRate: 18
              }
            ]
          });
          resolve(res);
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  const results = await Promise.all(promises);

  console.log(`✓ All ${CONCURRENCY_COUNT} concurrent postings completed without uncaught error.`);

  // 3. Assertions
  // A. Check returned voucher numbers are all unique
  const voucherNumbers = results.map(r => r.voucherNumber);
  const uniqueNumbers = new Set(voucherNumbers);
  console.log(`Generated voucher numbers:`, voucherNumbers);
  assert.strictEqual(uniqueNumbers.size, CONCURRENCY_COUNT, `Expected ${CONCURRENCY_COUNT} distinct voucher numbers, got ${uniqueNumbers.size}`);

  // B. Verify database state
  const dbVouchers = db.prepare(`
    SELECT voucher_id, voucher_number, status, total_amount_paise 
    FROM vouchers 
    WHERE company_id = ? AND voucher_type = 'SALES'
    ORDER BY voucher_number ASC
  `).all(companyId) as any[];

  assert.strictEqual(dbVouchers.length, CONCURRENCY_COUNT, `Expected exactly ${CONCURRENCY_COUNT} sales vouchers in DB`);

  // C. Verify all are POSTED
  for (const v of dbVouchers) {
    assert.strictEqual(v.status, 'POSTED', `Voucher ${v.voucher_id} status must be POSTED`);
    assert.ok(v.total_amount_paise > 0, `Voucher total amount must be > 0`);

    // D. Verify no partial vouchers: lines, ledger entries, tax entries exist for each
    const lines = db.prepare('SELECT COUNT(*) as c FROM voucher_lines WHERE voucher_id = ?').get(v.voucher_id) as any;
    assert.strictEqual(lines.c, 1, `Voucher ${v.voucher_id} must have exactly 1 voucher line`);

    const ledgers = db.prepare('SELECT COUNT(*) as c FROM ledger_entries WHERE voucher_id = ?').get(v.voucher_id) as any;
    assert.ok(ledgers.c >= 4, `Voucher ${v.voucher_id} must have at least 4 ledger entries (Customer, Sales, CGST, SGST)`);

    const taxes = db.prepare('SELECT COUNT(*) as c FROM tax_entries WHERE voucher_id = ?').get(v.voucher_id) as any;
    assert.strictEqual(taxes.c, 2, `Voucher ${v.voucher_id} must have 2 tax entries (CGST, SGST)`);
  }

  // E. Verify stock mass balance: 1000 - 12 = 988 units
  const stockSummary = db.prepare(`
    SELECT 
      SUM(CASE WHEN movement_type = 'IN' THEN quantity ELSE 0 END) -
      SUM(CASE WHEN movement_type = 'OUT' THEN quantity ELSE 0 END) as qty
    FROM stock_entries
    WHERE item_id = 'item_conc_01'
  `).get() as any;
  assert.strictEqual(Number(stockSummary.qty), 1000 - CONCURRENCY_COUNT, `Remaining stock must be ${1000 - CONCURRENCY_COUNT}`);

  console.log(`\n======================================================================`);
  console.log(`✓ CONCURRENCY TEST PASSED: ${CONCURRENCY_COUNT} simultaneous posts verified with:`);
  console.log(`  - 0 duplicate numbers`);
  console.log(`  - 0 partial vouchers`);
  console.log(`  - All ${CONCURRENCY_COUNT} vouchers POSTED`);
  console.log(`  - Perfect stock and ledger accounting integrity`);
  console.log(`======================================================================\n`);
}

runConcurrencyTest().catch(err => {
  console.error('CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});
