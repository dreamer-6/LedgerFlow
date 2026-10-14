import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('======================================================================');
console.log('LEDGERFLOW UI-025 — VOUCHER NUMBERING & LIFECYCLE TEST SUITE');
console.log('======================================================================\n');

function createTestHarness(companyId: string = 'comp_ui025_test', companyName: string = 'Alpha Corp') {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const schemaPath = path.resolve(__dirname, '../src/database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // Column migrations matching connection.ts
  try { db.exec('ALTER TABLE companies ADD COLUMN invoice_settings TEXT;'); } catch {}
  try { db.exec('ALTER TABLE companies ADD COLUMN accounting_preferences TEXT;'); } catch {}
  try { db.exec('ALTER TABLE vouchers ADD COLUMN is_hidden INTEGER DEFAULT 0;'); } catch {}

  initializeBusiness(db, {
    companyId,
    companyName,
    stateCode: '33',
    gstin: '33AABCV1234V1Z1'
  });

  const activeFy = db.prepare("SELECT fy_id FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(companyId) as any;
  const fyId = activeFy.fy_id;
  const godownId = `${companyId}_godown_main`;

  // Create Customer Party
  const custId = `${companyId}_party_cust_1`;
  const custLedgerId = `${companyId}_led_cust_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Test Customer', '${companyId}_grp_debtors', 0, 'DR', 1)
  `).run(custLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Test Customer', 'CUSTOMER', ?, '33ABCDE1234F1Z5')
  `).run(custId, companyId, custLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${custId}', ?, '101 Street', 'Chennai', 'Tamil Nadu', '33', '600001')
  `).run(custId);

  // Create Supplier Party
  const suppId = `${companyId}_party_supp_1`;
  const suppLedgerId = `${companyId}_led_supp_1`;
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'Test Supplier', '${companyId}_grp_creditors', 0, 'CR', 1)
  `).run(suppLedgerId, companyId);
  db.prepare(`
    INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
    VALUES (?, ?, 'Test Supplier', 'SUPPLIER', ?, '33SUPPL1234S1Z9')
  `).run(suppId, companyId, suppLedgerId);
  db.prepare(`
    INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
    VALUES ('addr_${suppId}', ?, '202 Ave', 'Chennai', 'Tamil Nadu', '33', '600001')
  `).run(suppId);

  // Create Stock Item
  const itemId = `${companyId}_item_1`;
  db.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES (?, ?, 'Standard Item', '8471', '${companyId}_unit_nos', 18, 10000, 15000, 1000, 10000)
  `).run(itemId, companyId);

  // Initialize stock in godown via STOCK_JOURNAL
  db.prepare(`
    INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
    VALUES ('vch_open_${companyId}', ?, ?, 'STOCK_JOURNAL', 'STK-000', '2026-04-01', 10000000, 'POSTED')
  `).run(companyId, fyId);
  db.prepare(`
    INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
    VALUES ('se_open_${companyId}', 'vch_open_${companyId}', ?, ?, '2026-04-01', 'IN', 1000, 10000, 10000000)
  `).run(itemId, godownId);

  return { db, companyId, fyId, custId, custLedgerId, suppId, suppLedgerId, itemId, godownId };
}

let passedCount = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedCount++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// ----------------------------------------------------------------------
// Suite 1: Draft Lifecycle & Number Release
// ----------------------------------------------------------------------
console.log('[Suite 1: Draft Voucher Creation, Deletion & Number Release]');

test('1.1: Initial preview shows 001 without consuming sequence', () => {
  const { db, companyId, fyId } = createTestHarness('comp_1_1', 'Alpha Corp');
  const preview = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(preview, 'AC-2627-001');

  // Verify preview is non-destructive (no rows written)
  const count = db.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE company_id = ?').get(companyId) as any;
  assert.strictEqual(count.cnt, 1); // Only the opening stock journal
});

test('1.2: Creating an eligible draft assigns temporary DFT- number and does not consume 001', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_1_2', 'Alpha Corp');
  const draft = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'DRAFT',
    lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
  });

  assert.strictEqual(draft.status, 'DRAFT');
  assert.strictEqual(draft.voucherNumber.startsWith('DFT-'), true);

  // Next voucher number preview is STILL 001
  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-001', 'Draft must not consume statutory sequence 001');
});

test('1.3: Deleting an eligible unposted draft preserves continuous numbering without gaps', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_1_3', 'Alpha Corp');
  const draft = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'DRAFT',
    lines: [{ itemId, quantity: 2, ratePaise: 15000, godownId }]
  });

  // Delete the unposted draft
  db.prepare('DELETE FROM voucher_lines WHERE voucher_id = ?').run(draft.voucherId);
  db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(draft.voucherId);
  db.prepare(`
    INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
    VALUES ('log_del_draft', ?, 'admin', 'DRAFT_VOUCHER_DELETED', 'vouchers', ?, ?)
  `).run(companyId, draft.voucherId, JSON.stringify({ voucher_number: draft.voucherNumber, status: 'DRAFT' }));

  // Create next voucher after draft deletion -> MUST receive 001
  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-001', 'Next voucher after draft deletion must be 001');

  const posted = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(posted.voucherNumber, 'AC-2627-001', 'Posted voucher must claim 001');
});

// ----------------------------------------------------------------------
// Suite 2: Posting & Cancellation Accounting Invariants
// ----------------------------------------------------------------------
console.log('\n[Suite 2: Posting, Sequential Increment & Cancellation Immutability]');

test('2.1: Posting voucher 001 advances sequence to 002', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_2_1', 'Alpha Corp');
  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'AC-2627-001');

  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-002');

  const v2 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v2.voucherNumber, 'AC-2627-002');
});

test('2.2: Cancelling posted voucher 001 NEVER reuses 001 (audit integrity)', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_2_2', 'Alpha Corp');
  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'AC-2627-001');

  // Cancel voucher 001
  PostingEngine.cancelVoucher(db, companyId, v1.voucherId, 'admin', 'Cancelled customer order');

  // Cancellation status verified
  const cancelledVch = db.prepare('SELECT status, voucher_number FROM vouchers WHERE voucher_id = ?').get(v1.voucherId) as any;
  assert.strictEqual(cancelledVch.status, 'CANCELLED');
  assert.strictEqual(cancelledVch.voucher_number, 'AC-2627-001');

  // Next voucher number MUST be 002 — NEVER reuse cancelled 001!
  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-002', 'Next voucher after cancelling 001 must be 002');

  const v2 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v2.voucherNumber, 'AC-2627-002');
});

test('2.3: Permanently purged cancelled voucher retains consumed number in audit_logs and is NEVER reused', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_2_3', 'Alpha Corp');
  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'AC-2627-001');

  PostingEngine.cancelVoucher(db, companyId, v1.voucherId, 'admin', 'Test cancellation');

  // Admin permanently purges cancelled voucher with audit tombstone
  db.prepare(`
    INSERT INTO audit_logs (log_id, company_id, user_id, action, entity_name, entity_id, details)
    VALUES ('log_purge_v1', ?, 'admin', 'VOUCHER_PERMANENT_PURGE', 'vouchers', ?, ?)
  `).run(companyId, v1.voucherId, JSON.stringify({
    voucher_id: v1.voucherId,
    voucher_number: 'AC-2627-001',
    voucher_type: 'SALES',
    fy_id: fyId,
    original_status: 'CANCELLED'
  }));

  db.prepare('DELETE FROM vouchers WHERE voucher_id = ?').run(v1.voucherId);

  // Number 001 must STILL be recognized as consumed via audit tombstone
  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-002', 'Next voucher after permanent purge of cancelled 001 must be 002');
});

// ----------------------------------------------------------------------
// Suite 3: Scoping: FY, Voucher Types & Cross-Company Isolation
// ----------------------------------------------------------------------
console.log('\n[Suite 3: Multi-Entity, Financial Year & Voucher Type Scoping]');

test('3.1: Financial year change restarts sequence for new year', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_3_1', 'Alpha Corp');
  PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });

  // Create next Financial Year (2027-2028)
  const nextFyId = `${companyId}_fy_2027_28`;
  db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, '2027-2028', '2027-04-01', '2028-03-31', 'OPEN')
  `).run(nextFyId, companyId);

  const nextFyNumber = PostingEngine.getNextVoucherNumber(db, companyId, nextFyId, 'SALES');
  assert.strictEqual(nextFyNumber, 'AC-2728-001', 'New FY sequence starts at 001');

  const oldFyNumber = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(oldFyNumber, 'AC-2627-002', 'Current FY sequence continues at 002');
});

test('3.2: Different voucher types maintain independent sequences', () => {
  const { db, companyId, fyId, custId, suppId, itemId, godownId } = createTestHarness('comp_3_2', 'Alpha Corp');

  // Post SALES 001
  const salesVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(salesVch.voucherNumber, 'AC-2627-001');

  // PURCHASE should still start at 001
  const purNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'PURCHASE');
  assert.strictEqual(purNum, 'PUR-2627-001');

  const purVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-01',
    partyId: suppId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 10000, godownId }]
  });
  assert.strictEqual(purVch.voucherNumber, 'PUR-2627-001');

  // Next SALES is 002, Next PURCHASE is 002
  assert.strictEqual(PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES'), 'AC-2627-002');
  assert.strictEqual(PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'PURCHASE'), 'PUR-2627-002');
});

test('3.3: Cross-company tenant isolation prevents sequence bleed', () => {
  const compA = createTestHarness('comp_3_3_a', 'Alpha Corp');
  const compB = createTestHarness('comp_3_3_b', 'Beta Systems');

  // Company A posts 001 and 002
  PostingEngine.postVoucher(compA.db, {
    companyId: compA.companyId,
    fyId: compA.fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: compA.custId,
    status: 'POSTED',
    lines: [{ itemId: compA.itemId, quantity: 1, ratePaise: 15000, godownId: compA.godownId }]
  });
  PostingEngine.postVoucher(compA.db, {
    companyId: compA.companyId,
    fyId: compA.fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-02',
    partyId: compA.custId,
    status: 'POSTED',
    lines: [{ itemId: compA.itemId, quantity: 1, ratePaise: 15000, godownId: compA.godownId }]
  });

  // Company B starts at 001 (acronym BS-2627-001)
  const nextCompB = PostingEngine.getNextVoucherNumber(compB.db, compB.companyId, compB.fyId, 'SALES');
  assert.strictEqual(nextCompB, 'BS-2627-001');
});

// ----------------------------------------------------------------------
// Suite 4: Transaction Rollbacks & Concurrency Safety
// ----------------------------------------------------------------------
console.log('\n[Suite 4: Transaction Rollbacks & Concurrent Posting Safety]');

test('4.1: Failed or rolled-back posting does NOT consume the voucher number', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_4_1', 'Alpha Corp');

  // Attempt invalid posting that fails domain validation (e.g. invalid party state or negative stock)
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-01',
      partyId: 'non_existent_party',
      status: 'POSTED',
      lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
    }),
    /Party with ID 'non_existent_party' not found/i
  );

  // Number 001 was NOT consumed by the rollback
  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'AC-2627-001', 'Rolled-back transaction must leave candidate number free');

  // Succeeded posting claims 001 cleanly
  const successVch = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(successVch.voucherNumber, 'AC-2627-001');
});

test('4.2: Serialized atomic posting prevents duplicate voucher numbers', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_4_2', 'Alpha Corp');

  // Post 5 vouchers sequentially with auto-sequencing
  const numbers: string[] = [];
  for (let i = 0; i < 5; i++) {
    const res = PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: `2026-05-0${i + 1}`,
      partyId: custId,
      status: 'POSTED',
      lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
    });
    numbers.push(res.voucherNumber);
  }

  assert.deepStrictEqual(numbers, [
    'AC-2627-001',
    'AC-2627-002',
    'AC-2627-003',
    'AC-2627-004',
    'AC-2627-005'
  ]);

  // Ensure no duplicate numbers in DB
  const rows = db.prepare('SELECT voucher_number FROM vouchers WHERE company_id = ? AND voucher_type = ?').all(companyId, 'SALES') as any[];
  const set = new Set(rows.map(r => r.voucher_number));
  assert.strictEqual(set.size, 5, 'Every allocated voucher number must be strictly unique');
});

// ----------------------------------------------------------------------
// Suite 5: Configured Prefix & Manual Numbering Rules
// ----------------------------------------------------------------------
console.log('\n[Suite 5: Configured Prefix & Manual Numbering Rules]');

test('5.1: Custom configured prefix and start number from invoice_settings are respected', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_5_1', 'Alpha Corp');

  // Configure custom numbering in company invoice_settings
  db.prepare('UPDATE companies SET invoice_settings = ? WHERE company_id = ?').run(
    JSON.stringify({
      voucherNumbering: {
        SALES: { prefix: 'TAXINV', startNumber: 100, format: 'TAXINV-001' }
      }
    }),
    companyId
  );

  const nextNum = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextNum, 'TAXINV-2627-100');

  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'TAXINV-2627-100');

  const nextAfter = PostingEngine.getNextVoucherNumber(db, companyId, fyId, 'SALES');
  assert.strictEqual(nextAfter, 'TAXINV-2627-101');
});

test('5.2: Explicit manual voucher number collision rejection', () => {
  const { db, companyId, fyId, custId, itemId, godownId } = createTestHarness('comp_5_2', 'Alpha Corp');

  // Post manual custom invoice number
  const v1 = PostingEngine.postVoucher(db, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-05-01',
    partyId: custId,
    voucherNumber: 'MANUAL-2026-999',
    status: 'POSTED',
    lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
  });
  assert.strictEqual(v1.voucherNumber, 'MANUAL-2026-999');

  // Second post attempting exact duplicate manual number is strictly rejected
  assert.throws(
    () => PostingEngine.postVoucher(db, {
      companyId,
      fyId,
      voucherType: 'SALES',
      voucherDate: '2026-05-02',
      partyId: custId,
      voucherNumber: 'MANUAL-2026-999',
      status: 'POSTED',
      lines: [{ itemId, quantity: 1, ratePaise: 15000, godownId }]
    }),
    /Voucher number 'MANUAL-2026-999' already exists/i
  );
});

console.log('\n======================================================================');
console.log(`ALL ${passedCount} / ${passedCount} UI-025 VOUCHER NUMBERING TESTS PASSED (100% SUCCESS)`);
console.log('======================================================================\n');
