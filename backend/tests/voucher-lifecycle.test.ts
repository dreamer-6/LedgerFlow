import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 006 — VOUCHER LIFECYCLE & INTEGRITY REGRESSION SUITE');
console.log('======================================================================\n');

function createTestHarness(companyId: string = 'comp_vch_test') {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const schemaPath = path.resolve('src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Connection extensions
  db.exec(`
    ALTER TABLE parties ADD COLUMN banking_account_no TEXT;
    ALTER TABLE parties ADD COLUMN banking_ifsc TEXT;
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_item_serials (
      serial_id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
      serial_number TEXT NOT NULL,
      status TEXT CHECK(status IN ('AVAILABLE', 'SOLD')) DEFAULT 'AVAILABLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, serial_number)
    );
  `);

  initializeBusiness(db, {
    companyId,
    companyName: 'Voucher Lifecycle Corp',
    stateCode: '27', // Maharashtra
    gstin: '27AABCV1234V1Z1'
  });

  const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(companyId) as any;
  const fyId = activeFy.fy_id;
  const godownId = `${companyId}_godown_main`;

  // Add Customer Party
  const custId = `${companyId}_party_cust_1`;
  const custLedgerId = `${companyId}_led_cust_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Alpha Customer', '${companyId}_grp_debtors', 0, 'DR', 1)
  `).run(custLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Alpha Customer', 'CUSTOMER', ?, '27ABCDE1234F1Z5')
  `).run(custId, companyId, custLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${custId}', ?, '101 Customer Blvd', 'Mumbai', 'Maharashtra', '27', '400001')
  `).run(custId);

  // Add Supplier Party
  const suppId = `${companyId}_party_supp_1`;
  const suppLedgerId = `${companyId}_led_supp_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Beta Supplier', '${companyId}_grp_creditors', 0, 'CR', 1)
  `).run(suppLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Beta Supplier', 'SUPPLIER', ?, '27SUPPL1234S1Z9')
  `).run(suppId, companyId, suppLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${suppId}', ?, '202 Supplier Ave', 'Pune', 'Maharashtra', '27', '411001')
  `).run(suppId);

  // Add Stock Items
  const itemId = `${companyId}_item_widget`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES (?, ?, 'Widget Alpha', '8471', '${companyId}_unit_nos', 18, 10000, 15000, 100, 10000)
  `).run(itemId, companyId);

  // Initialize opening stock entries so stock is available in godown
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
    VALUES ('vch_open_${companyId}', ?, ?, 'STOCK_JOURNAL', 'STK-000', '2026-04-01', 1000000, 'POSTED')
  `).run(companyId, fyId);

  db.prepare(`
    INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
    VALUES ('se_open_${companyId}', 'vch_open_${companyId}', ?, ?, '2026-04-01', 'IN', 100, 10000, 1000000)
  `).run(itemId, godownId);

  return { db, companyId, fyId, custId, custLedgerId, suppId, suppLedgerId, itemId, godownId };
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

// ======================================================================
// TEST_VCH_01: Illegal lifecycle transitions
// ======================================================================
runTest('TEST_VCH_01: Illegal lifecycle transitions', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t01');

  // 1. Post a normal voucher
  const vch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });

  // Attempt to promote an already POSTED voucher via postDraftVoucher
  assert.throws(
    () => PostingEngine.postDraftVoucher(db, companyId, vch.voucherId),
    /already POSTED/i
  );

  // Cancel the voucher
  PostingEngine.cancelVoucher(db, companyId, vch.voucherId, 'admin', 'Cancelled for test');

  // Attempt to promote a CANCELLED voucher
  assert.throws(
    () => PostingEngine.postDraftVoucher(db, companyId, vch.voucherId),
    /Cannot post CANCELLED voucher/i
  );

  // Attempt to amend a CANCELLED voucher
  assert.throws(
    () => PostingEngine.amendVoucher(db, vch.voucherId, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
    }),
    /Cannot amend voucher.*current status is CANCELLED/i
  );

  // Attempt to create a voucher with status AMENDED directly
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      status: 'AMENDED' as any,
      lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
    }),
    /Status 'AMENDED' is reserved/i
  );

  // Create a DRAFT voucher
  const draft = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'DRAFT',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });

  // Attempt to amend a DRAFT voucher (only POSTED can be amended)
  assert.throws(
    () => PostingEngine.amendVoucher(db, draft.voucherId, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
    }),
    /Cannot amend voucher.*current status is DRAFT/i
  );
});

// ======================================================================
// TEST_VCH_02: Posted voucher immutability
// ======================================================================
runTest('TEST_VCH_02: Posted voucher immutability', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t02');

  const vch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
  });

  // Direct mutation of ledger entries without amendment is prohibited by design
  const leCountBefore = db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE voucher_id = ?').get(vch.voucherId) as any;
  assert.strictEqual(leCountBefore.cnt > 0, true);

  // Amending creates a new replacement and marks original as CANCELLED
  const amended = PostingEngine.amendVoucher(db, vch.voucherId, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 3, ratePaise: 15000, godownId }]
  });

  assert.notStrictEqual(amended.replacementVoucherId, vch.voucherId);
  const origRow = db.prepare('SELECT status, cancelled_by, cancellation_reason FROM vouchers WHERE voucher_id = ?').get(vch.voucherId) as any;
  assert.strictEqual(origRow.status, 'CANCELLED');
  assert.strictEqual(origRow.cancellation_reason, 'Edited — replaced by amended voucher');
});

// ======================================================================
// TEST_VCH_03: Double cancellation rejection
// ======================================================================
runTest('TEST_VCH_03: Double cancellation rejection', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t03');

  const vch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });

  // First cancellation succeeds
  PostingEngine.cancelVoucher(db, companyId, vch.voucherId, 'admin', 'First cancellation');
  const check = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(vch.voucherId) as any;
  assert.strictEqual(check.status, 'CANCELLED');

  // Second cancellation must throw
  assert.throws(
    () => PostingEngine.cancelVoucher(db, companyId, vch.voucherId, 'admin', 'Second cancellation'),
    /already cancelled/i
  );
});

// ======================================================================
// TEST_VCH_04: Cancelled invoice releases settlement into FIFO/unallocated pool
// ======================================================================
runTest('TEST_VCH_04: Cancelled invoice releases settlement into FIFO/unallocated pool', () => {
  const { db, companyId, fyId, custId, custLedgerId, itemId, godownId } = createTestHarness('comp_t04');

  // Invoice 1: 1 unit @ 10,000 paise (with 18% GST -> 11,800 paise)
  const inv1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 10000, gstRate: 18, godownId }]
  });

  // Invoice 2: 2 units @ 10,000 paise (with 18% GST -> 23,600 paise)
  const inv2 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    lines: [{ itemId, quantity: 2, ratePaise: 10000, gstRate: 18, godownId }]
  });

  // Receipt allocating against Invoice 1: 11,800 paise
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-03',
    partyId: custId,
    billAllocation: {
      allocationType: 'AGAINST_REF',
      referenceVoucherId: inv1.voucherId
    },
    customLedgerLines: [
      { ledgerId: `${companyId}_led_sbi_bank`, debitPaise: 11800, creditPaise: 0 },
      { ledgerId: custLedgerId, debitPaise: 0, creditPaise: 11800 }
    ],
    lines: []
  });

  // Check outstanding before cancellation:
  // Total sales: 11800 + 23600 = 35400. Settled: 11800. Net outstanding: 23600 (Invoice 2).
  const repBefore = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  const totalBefore = repBefore.reduce((s, r) => s + r.totalOutstandingPaise, 0);
  assert.strictEqual(totalBefore, 23600);

  // Cancel Invoice 1
  PostingEngine.cancelVoucher(db, companyId, inv1.voucherId, 'admin', 'Cancelled invoice 1');

  // Verify historical bill_allocations are NOT wiped from receipt
  const receiptAlloc = db.prepare("SELECT * FROM bill_allocations WHERE reference_voucher_id = ?").all(inv1.voucherId);
  assert.strictEqual(receiptAlloc.length > 0, true, 'Historical allocation row must be preserved');

  // Outstanding after cancellation:
  // Invoice 1 is cancelled. The receipt (11,800) has an allocation pointing to a cancelled invoice,
  // so the 11,800 is released back into the unallocated pool and settles Invoice 2 via FIFO!
  // Remaining outstanding on Invoice 2: 23,600 - 11,800 = 11,800 paise!
  const repAfter = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  const totalAfter = repAfter.reduce((s, r) => s + r.totalOutstandingPaise, 0);
  assert.strictEqual(totalAfter, 11800, 'Cancelled invoice releases settlement into unallocated pool settling active bills via FIFO');
});

// ======================================================================
// TEST_VCH_05: Failed amendment preserves original POSTED voucher
// ======================================================================
runTest('TEST_VCH_05: Failed amendment preserves original POSTED voucher', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t05');

  const orig = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
  });

  const leOrig = db.prepare('SELECT * FROM ledger_entries WHERE voucher_id = ?').all(orig.voucherId);
  const seOrig = db.prepare('SELECT * FROM stock_entries WHERE voucher_id = ?').all(orig.voucherId);
  const teOrig = db.prepare('SELECT * FROM tax_entries WHERE voucher_id = ?').all(orig.voucherId);
  const baOrig = db.prepare('SELECT * FROM bill_allocations WHERE voucher_id = ?').all(orig.voucherId);

  // Attempt amendment with invalid line (negative quantity)
  assert.throws(
    () => PostingEngine.amendVoucher(db, orig.voucherId, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: -5, ratePaise: 15000, godownId }]
    }),
    /quantity greater than zero/i
  );

  // Verify original voucher is STILL POSTED and has all rows intact
  const origAfter = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(orig.voucherId) as any;
  assert.strictEqual(origAfter.status, 'POSTED');

  const leAfter = db.prepare('SELECT * FROM ledger_entries WHERE voucher_id = ?').all(orig.voucherId);
  const seAfter = db.prepare('SELECT * FROM stock_entries WHERE voucher_id = ?').all(orig.voucherId);
  const teAfter = db.prepare('SELECT * FROM tax_entries WHERE voucher_id = ?').all(orig.voucherId);
  const baAfter = db.prepare('SELECT * FROM bill_allocations WHERE voucher_id = ?').all(orig.voucherId);

  assert.strictEqual(leAfter.length, leOrig.length);
  assert.strictEqual(seAfter.length, seOrig.length);
  assert.strictEqual(teAfter.length, teOrig.length);
  assert.strictEqual(baAfter.length, baOrig.length);

  // Verify zero orphan replacement vouchers
  const orphanVch = db.prepare("SELECT * FROM vouchers WHERE reference_number LIKE ?").all(`AMEND-%`);
  assert.strictEqual(orphanVch.length, 0);
});

// ======================================================================
// TEST_VCH_06: Closed FY cancellation rejected
// ======================================================================
runTest('TEST_VCH_06: Closed FY cancellation rejected', () => {
  const { db, companyId, custId, itemId, godownId } = createTestHarness('comp_t06');

  // Create a CLOSED financial year
  const closedFyId = `${companyId}_fy_closed`;
  db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, '2025-2026', '2025-04-01', '2026-03-31', 'CLOSED')
  `).run(closedFyId, companyId);

  // Insert a voucher directly into closed FY
  const vchId = 'vch_closed_test';
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
    VALUES (?, ?, ?, 'SALES', 'INV-CLOSED-01', '2025-10-10', 10000, 'POSTED')
  `).run(vchId, companyId, closedFyId);

  // Attempt to cancel voucher belonging to closed FY
  assert.throws(
    () => PostingEngine.cancelVoucher(db, companyId, vchId, 'admin', 'Cancel closed FY'),
    /Financial Year status is CLOSED. Cancellation prohibited/i
  );

  const check = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(vchId) as any;
  assert.strictEqual(check.status, 'POSTED');
});

// ======================================================================
// TEST_VCH_07: Consumed PURCHASE cancellation rejected
// ======================================================================
runTest('TEST_VCH_07: Consumed PURCHASE cancellation rejected', () => {
  const { db, companyId, fyId, suppId, custId, godownId } = createTestHarness('comp_t07');

  // Create a fresh item with zero initial stock
  const freshItemId = `${companyId}_item_consumed_test`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES (?, ?, 'Fresh Batch Item', '8471', '${companyId}_unit_nos', 18, 5000, 8000, 0, 0)
  `).run(freshItemId, companyId);

  // 1. Purchase 10 units
  const pur = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-01',
    partyId: suppId,
    lines: [{ itemId: freshItemId, quantity: 10, ratePaise: 5000, godownId }]
  });

  // 2. Sell 8 units (leaving 2 units in stock)
  const sale = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    lines: [{ itemId: freshItemId, quantity: 8, ratePaise: 8000, godownId }]
  });

  // 3. Attempt to cancel the Purchase voucher (would remove 10 units, leaving 2 - 10 = -8)
  assert.throws(
    () => PostingEngine.cancelVoucher(db, companyId, pur.voucherId, 'admin', 'Cancel purchase'),
    /result in negative stock.*Dependent outward vouchers have consumed this stock/i
  );

  const purCheck = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(pur.voucherId) as any;
  assert.strictEqual(purCheck.status, 'POSTED');

  // Now cancel the Sales voucher first (restores stock to 10)
  PostingEngine.cancelVoucher(db, companyId, sale.voucherId, 'admin', 'Cancel sale first');

  // Now cancelling the Purchase voucher succeeds!
  PostingEngine.cancelVoucher(db, companyId, pur.voucherId, 'admin', 'Cancel purchase now');
  const purCheck2 = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(pur.voucherId) as any;
  assert.strictEqual(purCheck2.status, 'CANCELLED');
});

// ======================================================================
// TEST_VCH_08: Sales cancellation restores serial SOLD -> AVAILABLE
// ======================================================================
runTest('TEST_VCH_08: Sales cancellation restores serial SOLD -> AVAILABLE', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t08');

  // Insert serials
  db.prepare(`
    INSERT INTO stock_item_serials (serial_id, item_id, serial_number, status)
    VALUES ('ser_alpha_1', ?, 'SN-ALPHA-01', 'AVAILABLE'),
           ('ser_beta_2', ?, 'SN-BETA-02', 'AVAILABLE'),
           ('ser_gamma_3', ?, 'SN-GAMMA-03', 'SOLD')
  `).run(itemId, itemId, itemId);

  // Post sales voucher for SN-ALPHA-01
  const sale = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 15000, serialNumber: 'SN-ALPHA-01', godownId }]
  });

  const serAlphaSold = db.prepare("SELECT status FROM stock_item_serials WHERE serial_number = 'SN-ALPHA-01'").get() as any;
  assert.strictEqual(serAlphaSold.status, 'SOLD');

  // Cancel the sales voucher
  PostingEngine.cancelVoucher(db, companyId, sale.voucherId, 'admin', 'Customer return cancellation');

  // Verify SN-ALPHA-01 is restored to AVAILABLE
  const serAlphaAfter = db.prepare("SELECT status FROM stock_item_serials WHERE serial_number = 'SN-ALPHA-01'").get() as any;
  assert.strictEqual(serAlphaAfter.status, 'AVAILABLE', 'Sold serial must be restored to AVAILABLE');

  // Verify unrelated serials are untouched
  const serBeta = db.prepare("SELECT status FROM stock_item_serials WHERE serial_number = 'SN-BETA-02'").get() as any;
  const serGamma = db.prepare("SELECT status FROM stock_item_serials WHERE serial_number = 'SN-GAMMA-03'").get() as any;
  assert.strictEqual(serBeta.status, 'AVAILABLE');
  assert.strictEqual(serGamma.status, 'SOLD');
});

// ======================================================================
// TEST_VCH_09: Cross-tenant domain cancellation rejected
// ======================================================================
runTest('TEST_VCH_09: Cross-tenant domain cancellation rejected', () => {
  const { db, companyId: compA, fyId: fyA, custId: custA, itemId: itemA, godownId: godownA } = createTestHarness('comp_t09_a');

  // Create Company B in same DB
  const compB = 'comp_t09_b';
  initializeBusiness(db, { companyId: compB, companyName: 'Company B', stateCode: '27', gstin: '27COMPB1234B1Z2' });
  const activeFyB = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(compB) as any;
  const fyB = activeFyB.fy_id;

  const custB = `${compB}_cust`;
  const custLedB = `${compB}_led_cust`;
  db.prepare(`INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party) VALUES (?, ?, 'Cust B', '${compB}_grp_debtors', 1)`).run(custLedB, compB);
  db.prepare(`INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id) VALUES (?, ?, 'Cust B', 'CUSTOMER', ?)`).run(custB, compB, custLedB);

  const itemB = `${compB}_item`;
  db.prepare(`INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty) VALUES (?, ?, 'Item B', '8471', '${compB}_unit_nos', 18, 1000, 2000, 10)`).run(itemB, compB);

  // Initialize stock for Company B
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
    VALUES ('vch_open_${compB}', ?, ?, 'STOCK_JOURNAL', 'STK-000', '2026-04-01', 20000, 'POSTED')
  `).run(compB, fyB);
  db.prepare(`
    INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
    VALUES ('se_open_${compB}', 'vch_open_${compB}', ?, ?, '2026-04-01', 'IN', 10, 1000, 10000)
  `).run(itemB, `${compB}_godown_main`);

  // Post voucher in Company B
  const vchB = PostingEngine.postVoucher(db, {
    companyId: compB,
    fyId: fyB,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custB,
    lines: [{ itemId: itemB, quantity: 1, ratePaise: 2000, godownId: `${compB}_godown_main` }]
  });

  // Attempt to cancel Company B's voucher using Company A's tenant context
  assert.throws(
    () => PostingEngine.cancelVoucher(db, compA, vchB.voucherId, 'admin', 'Malicious cancellation'),
    /Security violation: Voucher '.*' does not belong to company/i
  );

  const vchBCheck = db.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(vchB.voucherId) as any;
  assert.strictEqual(vchBCheck.status, 'POSTED', 'Foreign voucher must remain POSTED');
});

// ======================================================================
// TEST_VCH_10: Invalid bill allocation reference rejected
// ======================================================================
runTest('TEST_VCH_10: Invalid bill allocation reference rejected', () => {
  const { db, companyId, fyId, custId, custLedgerId, itemId, godownId } = createTestHarness('comp_t10');

  // 1. Reference non-existent voucher
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'RECEIPT',
      voucherDate: '2026-05-01',
      partyId: custId,
      billAllocation: {
        allocationType: 'AGAINST_REF',
        referenceVoucherId: 'vch_non_existent'
      },
      customLedgerLines: [
        { ledgerId: `${companyId}_led_cash`, debitPaise: 5000, creditPaise: 0 },
        { ledgerId: custLedgerId, debitPaise: 0, creditPaise: 5000 }
      ],
      lines: []
    }),
    /Referenced voucher 'vch_non_existent' not found/i
  );

  // 2. Reference cancelled voucher
  const inv = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 10000, godownId }]
  });
  PostingEngine.cancelVoucher(db, companyId, inv.voucherId, 'admin', 'Cancel before alloc');

  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'RECEIPT',
      voucherDate: '2026-05-02',
      partyId: custId,
      billAllocation: {
        allocationType: 'AGAINST_REF',
        referenceVoucherId: inv.voucherId
      },
      customLedgerLines: [
        { ledgerId: `${companyId}_led_cash`, debitPaise: 5000, creditPaise: 0 },
        { ledgerId: custLedgerId, debitPaise: 0, creditPaise: 5000 }
      ],
      lines: []
    }),
    /Referenced voucher '.*' is cancelled and cannot be allocated against/i
  );

  // Verify zero orphan receipts created
  const orphanReceipts = db.prepare("SELECT * FROM vouchers WHERE voucher_type = 'RECEIPT' AND company_id = ?").all(companyId);
  assert.strictEqual(orphanReceipts.length, 0);
});

// ======================================================================
// TEST_VCH_11: Duplicate explicit voucher number rejected
// ======================================================================
runTest('TEST_VCH_11: Duplicate explicit voucher number rejected', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t11');

  // Post with explicit voucher number
  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherNumber: 'CUSTOM-INV-001',
    voucherDate: '2026-05-01',
    partyId: custId,
    lines: [{ itemId, quantity: 1, ratePaise: 10000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'CUSTOM-INV-001');

  // Attempt duplicate explicit voucher number
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherNumber: 'CUSTOM-INV-001',
      voucherDate: '2026-05-02',
      partyId: custId,
      lines: [{ itemId, quantity: 1, ratePaise: 10000, godownId }]
    }),
    /Voucher number 'CUSTOM-INV-001' already exists/i
  );

  // Verify only 1 voucher exists with that number
  const count = db.prepare("SELECT COUNT(*) as cnt FROM vouchers WHERE voucher_number = 'CUSTOM-INV-001'").get() as any;
  assert.strictEqual(count.cnt, 1);
});

// ======================================================================
// TEST_VCH_12: Concurrent automatic voucher numbering remains collision-free
// ======================================================================
runTest('TEST_VCH_12: Concurrent automatic voucher numbering remains collision-free', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t12');

  const numbers = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const v = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: custId,
      lines: [{ itemId, quantity: 1, ratePaise: 10000, godownId }]
    });
    assert.strictEqual(numbers.has(v.voucherNumber), false, `Duplicate number: ${v.voucherNumber}`);
    numbers.add(v.voucherNumber);
  }

  assert.strictEqual(numbers.size, 10);
});

// ======================================================================
// TEST_VCH_13: Draft has zero accounting/stock/GST effects
// ======================================================================
runTest('TEST_VCH_13: Draft has zero accounting/stock/GST effects', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_t13');

  // Create DRAFT
  const draft = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'DRAFT',
    lines: [{ itemId, quantity: 5, ratePaise: 10000, godownId }]
  });

  // Draft number must not consume production sequence (starts with DFT-)
  assert.strictEqual(draft.voucherNumber.startsWith('DFT-'), true);
  assert.strictEqual(draft.status, 'DRAFT');

  // ZERO downstream entries
  const leCount = db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE voucher_id = ?').get(draft.voucherId) as any;
  const seCount = db.prepare('SELECT COUNT(*) as cnt FROM stock_entries WHERE voucher_id = ?').get(draft.voucherId) as any;
  const teCount = db.prepare('SELECT COUNT(*) as cnt FROM tax_entries WHERE voucher_id = ?').get(draft.voucherId) as any;
  const baCount = db.prepare('SELECT COUNT(*) as cnt FROM bill_allocations WHERE voucher_id = ?').get(draft.voucherId) as any;

  assert.strictEqual(leCount.cnt, 0);
  assert.strictEqual(seCount.cnt, 0);
  assert.strictEqual(teCount.cnt, 0);
  assert.strictEqual(baCount.cnt, 0);

  // Reports must not see draft
  const tb = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  // Opening stock has 1,000,000 paise in stock journal, but sales draft has zero effect
  const salesDebits = tb.rows.filter(r => r.ledgerName.includes('Sales'));
  const custDebits = tb.rows.filter(r => r.ledgerName.includes('Alpha Customer'));
  assert.strictEqual(salesDebits.reduce((s, r) => s + r.creditPaise, 0), 0);
  assert.strictEqual(custDebits.reduce((s, r) => s + r.debitPaise, 0), 0);

  // Promote DRAFT -> POSTED
  const promoted = PostingEngine.postDraftVoucher(db, companyId, draft.voucherId, 'admin');
  assert.strictEqual(promoted.status, 'POSTED');
  assert.strictEqual(promoted.voucherId, draft.voucherId);
  assert.strictEqual(promoted.voucherNumber.startsWith('DFT-'), false, 'Promoted voucher must have official statutory number');

  // Now entries exist
  const leCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM ledger_entries WHERE voucher_id = ?').get(draft.voucherId) as any;
  assert.strictEqual(leCountAfter.cnt > 0, true);
});

// ======================================================================
// TEST_VCH_14: Party-based receipt/payment without partyId rejected
// ======================================================================
runTest('TEST_VCH_14: Party-based receipt/payment without partyId rejected', () => {
  const { db, companyId, fyId, custLedgerId } = createTestHarness('comp_t14');

  // Attempt PAYMENT touching debtor ledger without partyId
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'PAYMENT',
      voucherDate: '2026-05-01',
      customLedgerLines: [
        { ledgerId: custLedgerId, debitPaise: 5000, creditPaise: 0 },
        { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 5000 }
      ],
      lines: []
    }),
    /Party is mandatory for PAYMENT voucher affecting party\/debtor\/creditor ledger/i
  );

  // Non-party payment (e.g. Office Expense to Cash) without partyId succeeds cleanly
  const expLedgerId = `${companyId}_led_expense`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, is_party)
    VALUES (?, ?, 'Office Tea Expense', '${companyId}_grp_indirect_expense', 0)
  `).run(expLedgerId, companyId);

  const nonPartyVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PAYMENT',
    voucherDate: '2026-05-01',
    customLedgerLines: [
      { ledgerId: expLedgerId, debitPaise: 500, creditPaise: 0 },
      { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 500 }
    ],
    lines: []
  });

  assert.strictEqual(nonPartyVch.status, 'POSTED');
  // No bogus bill_allocations rows created
  const ba = db.prepare('SELECT * FROM bill_allocations WHERE voucher_id = ?').all(nonPartyVch.voucherId);
  assert.strictEqual(ba.length, 0);
});

// ======================================================================
// TEST_VCH_15: Partial posting failure leaves zero orphan rows
// ======================================================================
runTest('TEST_VCH_15: Partial posting failure leaves zero orphan rows', () => {
  const { db, companyId, fyId, custId, custLedgerId } = createTestHarness('comp_t15');

  // Attempt posting an unbalanced customLedgerLines voucher
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'JOURNAL',
      voucherDate: '2026-05-01',
      customLedgerLines: [
        { ledgerId: custLedgerId, debitPaise: 10000, creditPaise: 0 },
        { ledgerId: `${companyId}_led_cash`, debitPaise: 0, creditPaise: 9000 } // Unbalanced!
      ],
      lines: []
    }),
    /Accounting Invariant Violated/i
  );

  const vCount = db.prepare("SELECT COUNT(*) as cnt FROM vouchers WHERE voucher_type = 'JOURNAL'").get() as any;
  const leCount = db.prepare("SELECT COUNT(*) as cnt FROM ledger_entries WHERE particulars LIKE '%JOURNAL%'").get() as any;
  assert.strictEqual(vCount.cnt, 0);
  assert.strictEqual(leCount.cnt, 0);
});

// ======================================================================
// TEST_VCH_16: Full reporting reconciliation after cancellation
// ======================================================================
runTest('TEST_VCH_16: Full reporting reconciliation after cancellation', () => {
  const { db, companyId, fyId, suppId, custId, itemId, godownId } = createTestHarness('comp_t16');

  // 1. Purchase 10 @ 10,000 (total 100,000 + 18,000 GST = 118,000 paise)
  const pur = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-01',
    partyId: suppId,
    lines: [{ itemId, quantity: 10, ratePaise: 10000, godownId }]
  });

  // 2. Sales 4 @ 15,000 (total 60,000 + 10,800 GST = 70,800 paise)
  const sale = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    lines: [{ itemId, quantity: 4, ratePaise: 15000, godownId }]
  });

  // Verify Trial Balance balanced before cancellation
  const tbBefore = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tbBefore.isBalanced, true);
  assert.strictEqual(tbBefore.totalDebitPaise, tbBefore.totalCreditPaise);

  // Cancel Sales voucher
  PostingEngine.cancelVoucher(db, companyId, sale.voucherId, 'admin', 'Cancel sale for reconciliation test');

  // Verify Trial Balance balanced after cancellation
  const tbAfter = ReportEngine.getTrialBalance(db, companyId, '2026-05-31');
  assert.strictEqual(tbAfter.isBalanced, true, 'Trial balance must balance after voucher cancellation');
  assert.strictEqual(tbAfter.totalDebitPaise, tbAfter.totalCreditPaise);

  // Verify P&L sales revenue is 0
  const pl = ReportEngine.getProfitAndLoss(db, companyId, '2026-04-01', '2026-05-31');
  assert.strictEqual(pl.tradingIncomePaise, 0, 'Sales revenue must be 0 after sales cancellation');

  // Verify GST output tax is 0
  const gst = ReportEngine.getGstSummary(db, companyId, '2026-04-01', '2026-05-31');
  assert.strictEqual(gst.totalOutputTaxPaise, 0, 'Output tax must be 0 after sales cancellation');

  // Verify stock summary has 110 units (100 opening + 10 purchase - 0 sale = 110)
  const stock = ReportEngine.getStockSummary(db, companyId);
  assert.strictEqual(stock[0].quantity, 110, 'Stock must restore after sales cancellation');

  // Customer outstanding must be 0
  const recv = ReportEngine.getOutstandingReport(db, companyId, 'CUSTOMER');
  const totalRecv = recv.reduce((s, r) => s + r.totalOutstandingPaise, 0);
  assert.strictEqual(totalRecv, 0);
});

// ======================================================================
// CRITICAL_SERIAL_SAFETY_TEST: Inward purchase cancellation never deletes pre-existing serial
// ======================================================================
runTest('CRITICAL_SERIAL_SAFETY_TEST: Inward purchase cancellation never deletes pre-existing serial', () => {
  const { db, companyId, fyId, suppId, itemId, godownId } = createTestHarness('comp_t_serial');

  // 1. Pre-existing serial introduced at master setup / opening
  db.prepare(`
    INSERT INTO stock_item_serials (serial_id, item_id, serial_number, status)
    VALUES ('ser_pre_exist_99', ?, 'SN-PRE-EXISTING-99', 'AVAILABLE')
  `).run(itemId);

  // 2. Post a purchase voucher that references the pre-existing serial AND introduces a new serial
  const pur = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-01',
    partyId: suppId,
    lines: [
      { itemId, quantity: 1, ratePaise: 10000, serialNumber: 'SN-PRE-EXISTING-99', godownId },
      { itemId, quantity: 1, ratePaise: 10000, serialNumber: 'SN-INTRODUCED-NEW-01', godownId }
    ]
  });

  // Verify both serials exist and are AVAILABLE
  const checkPre = db.prepare("SELECT * FROM stock_item_serials WHERE serial_number = 'SN-PRE-EXISTING-99'").get() as any;
  const checkNew = db.prepare("SELECT * FROM stock_item_serials WHERE serial_number = 'SN-INTRODUCED-NEW-01'").get() as any;
  assert.ok(checkPre);
  assert.ok(checkNew);
  assert.strictEqual(checkPre.serial_id, 'ser_pre_exist_99', 'Pre-existing serial ID must be preserved');

  // 3. Cancel the Purchase voucher
  PostingEngine.cancelVoucher(db, companyId, pur.voucherId, 'admin', 'Cancel purchase');

  // 4. VERIFY:
  // - SN-INTRODUCED-NEW-01 was introduced by this voucher, so it is safely deleted
  const newAfter = db.prepare("SELECT * FROM stock_item_serials WHERE serial_number = 'SN-INTRODUCED-NEW-01'").get();
  assert.strictEqual(newAfter, undefined, 'Introduced serial must be deleted on purchase cancellation');

  // - SN-PRE-EXISTING-99 was NOT introduced by this voucher, so it MUST REMAIN INTACT!
  const preAfter = db.prepare("SELECT * FROM stock_item_serials WHERE serial_number = 'SN-PRE-EXISTING-99'").get() as any;
  assert.ok(preAfter, 'CRITICAL: Pre-existing serial must NEVER be deleted when inward voucher is cancelled');
  assert.strictEqual(preAfter.serial_id, 'ser_pre_exist_99');
  assert.strictEqual(preAfter.status, 'AVAILABLE');
});

console.log(`\n======================================================================`);
console.log(`VOUCHER LIFECYCLE TESTS: ${passed} passed, ${failed} failed`);
console.log(`======================================================================`);

if (failed > 0) {
  process.exit(1);
}
