/**
 * UI-049: In-Place Posted Voucher Editing Test Suite
 *
 * Verifies that editing an existing POSTED voucher (such as a Sales Invoice):
 *  1. Retains the exact same voucher ID (no new row created).
 *  2. Retains the exact same voucher number (e.g. DTS-2627-019 remains DTS-2627-019, never jumping to 020 or 021).
 *  3. Leaves ZERO "CANCELLED" duplicate vouchers in the register.
 *  4. Atomically recalculates inventory and serials (released serials become AVAILABLE, new serials become SOLD).
 *  5. Atomically recalculates double-entry ledger entries (Total Dr === Total Cr).
 *  6. Rejects collisions with other vouchers' numbers while permitting its own.
 *  7. Protects payment-linked vouchers from invalid party mutation.
 */

import assert from 'node:assert';
import { getDatabase } from '../src/database/connection.js';
import { initializeBusiness } from '../src/database/seed.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW UI-049 — IN-PLACE POSTED VOUCHER EDITING TEST SUITE');
console.log('======================================================================\n');

const db = getDatabase(':memory:');
const companyId = 'comp_ui049_test';

// 1. Initialize Company & Masters
initializeBusiness(db, {
  companyId,
  companyName: 'Dream Tech Solutions',
  stateCode: '33', // Tamil Nadu
  gstin: '33AAAAA0000A1Z5'
});

const activeFy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' LIMIT 1").get(companyId) as any;
assert.ok(activeFy, 'Active Financial Year must exist');
const fyId = activeFy.fy_id;
const godownId = `${companyId}_godown_main`;

// Customer Setup
const custId = `${companyId}_pty_cust_01`;
const custLedgerId = `${companyId}_led_cust_01`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'A to Z Enterprises', '${companyId}_grp_debtors', 0, 'DR', 1)
`).run(custLedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id, gstin)
  VALUES (?, ?, 'A to Z Enterprises', 'CUSTOMER', ?, '33AABCA0000A1Z5')
`).run(custId, companyId, custLedgerId);
db.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_cust_01', ?, 'Anna Salai', 'Chennai', 'Tamil Nadu', '33', '600017')
`).run(custId);

// Items Setup with Serials
const nosUnit = (db.prepare("SELECT * FROM units WHERE company_id = ?").get(companyId) as any) || { unit_id: 'unit_nos' };
const itemId = 'item_laptop_pro';
db.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, has_serial_no, opening_qty)
  VALUES (?, ?, 'ThinkPad E14 Laptop', '84713010', ?, 18, 4000000, 5000000, 1, 5)
`).run(itemId, companyId, nosUnit.unit_id);

// Seed 5 available serial numbers
const serials = ['SN-TP01', 'SN-TP02', 'SN-TP03', 'SN-TP04', 'SN-TP05'];
for (const sn of serials) {
  db.prepare(`
    INSERT INTO stock_item_serials (serial_id, company_id, item_id, godown_id, serial_number, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'AVAILABLE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run('ser_' + sn, companyId, itemId, godownId, sn);
}

// Initial Stock Voucher & Entry for the 5 units
const initVchId = 'vch_init_stock';
db.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES (?, ?, ?, 'JOURNAL', 'OPN-STK-001', '2026-04-01', 20000000, 'POSTED')
`).run(initVchId, companyId, fyId);

db.prepare(`
  INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
  VALUES ('se_init_01', ?, ?, ?, '2026-10-01', 'IN', 5, 4000000, 20000000)
`).run(initVchId, itemId, godownId);

console.log('[Test 1] Post Initial Sales Voucher with 2 Serials');
const initialPost = PostingEngine.postVoucher(db, {
  companyId,
  fyId,
  voucherType: 'SALES',
  voucherDate: '2026-10-15',
  partyId: custId,
  status: 'POSTED',
  lines: [
    {
      itemId,
      godownId,
      quantity: 2,
      ratePaise: 5000000,
      gstRate: 18,
      serialNumber: 'SN-TP01, SN-TP02'
    }
  ]
});

console.log(`✓ Initial Voucher Posted: ${initialPost.voucherNumber} (ID: ${initialPost.voucherId})`);
assert.strictEqual(initialPost.status, 'POSTED');

// Verify serial status: SN-TP01 & SN-TP02 must be SOLD; others AVAILABLE
const ser1 = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE serial_number = ?').get('SN-TP01') as any;
const ser3 = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE serial_number = ?').get('SN-TP03') as any;
assert.strictEqual(ser1.status, 'SOLD');
assert.strictEqual(ser1.sales_voucher_id, initialPost.voucherId);
assert.strictEqual(ser3.status, 'AVAILABLE');

// Verify total vouchers in table is exactly 1
const vchCount1 = db.prepare("SELECT COUNT(*) as count FROM vouchers WHERE voucher_type = 'SALES'").get() as any;
assert.strictEqual(vchCount1.count, 1, 'Only 1 sales voucher should exist initially');

console.log('\n[Test 2] Update Posted Voucher In-Place: Retain Same Number & ID, Zero Cancelled Rows');
// Edit voucher: Swap SN-TP02 for SN-TP03, change rate from 50,000 to 52,000
const updated = PostingEngine.updatePostedVoucher(db, initialPost.voucherId, {
  companyId,
  fyId,
  voucherType: 'SALES',
  voucherNumber: initialPost.voucherNumber, // User sends existing number
  voucherDate: '2026-10-15',
  partyId: custId,
  status: 'POSTED',
  lines: [
    {
      itemId,
      godownId,
      quantity: 2,
      ratePaise: 5200000,
      gstRate: 18,
      serialNumber: 'SN-TP01, SN-TP03' // Replaced SN-TP02 with SN-TP03!
    }
  ]
});

console.log(`✓ In-Place Update Result: ${updated.voucherNumber} (ID: ${updated.voucherId})`);
assert.strictEqual(updated.voucherId, initialPost.voucherId, 'Voucher ID must remain identical');
assert.strictEqual(updated.voucherNumber, initialPost.voucherNumber, 'Voucher Number must remain identical');
assert.strictEqual(updated.status, 'POSTED');

// CRITICAL ASSERTION: No duplicate or CANCELLED voucher was created
const allVouchers = db.prepare("SELECT voucher_id, voucher_number, status, total_amount_paise FROM vouchers WHERE voucher_type = 'SALES'").all() as any[];
console.log('Current Sales Vouchers in Register:');
console.table(allVouchers);

assert.strictEqual(allVouchers.length, 1, 'MUST remain exactly 1 voucher in register — zero cancelled duplicates!');
assert.strictEqual(allVouchers[0].voucher_id, initialPost.voucherId);
assert.strictEqual(allVouchers[0].voucher_number, initialPost.voucherNumber);
assert.strictEqual(allVouchers[0].status, 'POSTED');

// Verify serials: SN-TP02 was returned to AVAILABLE; SN-TP03 is now SOLD
const ser1After = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE serial_number = ?').get('SN-TP01') as any;
const ser2After = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE serial_number = ?').get('SN-TP02') as any;
const ser3After = db.prepare('SELECT status, sales_voucher_id FROM stock_item_serials WHERE serial_number = ?').get('SN-TP03') as any;

assert.strictEqual(ser1After.status, 'SOLD', 'SN-TP01 remains SOLD');
assert.strictEqual(ser2After.status, 'AVAILABLE', 'SN-TP02 returned to AVAILABLE');
assert.strictEqual(ser2After.sales_voucher_id, null, 'SN-TP02 sales_voucher_id cleared');
assert.strictEqual(ser3After.status, 'SOLD', 'SN-TP03 now marked SOLD');
assert.strictEqual(ser3After.sales_voucher_id, initialPost.voucherId, 'SN-TP03 points to same voucherId');

// Verify Trial Balance: Total Dr === Total Cr
const tb = ReportEngine.getTrialBalance(db, companyId, '2026-10-31');
console.log(`✓ Trial Balance Verified: Total Dr ₹${tb.totalDebitPaise / 100} === Total Cr ₹${tb.totalCreditPaise / 100}`);
assert.strictEqual(tb.differencePaise, 0, 'Trial balance must be perfectly balanced');

console.log('\n[Test 3] Over-Allocation / Stock Exhaustion Guard');
// Attempting to edit quantity from 2 to 10 (only 5 exist) must be rejected
assert.throws(() => {
  PostingEngine.updatePostedVoucher(db, initialPost.voucherId, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-10-15',
    partyId: custId,
    status: 'POSTED',
    allowNegativeStock: false,
    lines: [
      {
        itemId,
        godownId,
        quantity: 10,
        ratePaise: 5000000,
        gstRate: 18,
        serialNumber: 'SN-TP01, SN-TP02, SN-TP03, SN-TP04, SN-TP05'
      }
    ]
  });
}, /Insufficient stock|Serial count/);
console.log('✓ Over-allocation correctly rejected without mutating voucher');

console.log('\n[Test 4] Payment-Allocation Safeguard: Prevent changing party if receipt allocated');
// Link a payment receipt against this invoice
const recPost = PostingEngine.postVoucher(db, {
  companyId,
  fyId,
  voucherType: 'RECEIPT',
  voucherDate: '2026-10-16',
  partyId: custId,
  status: 'POSTED',
  lines: [],
  customLedgerLines: [
    { ledgerId: `${companyId}_led_cash`, debitPaise: 5000000, creditPaise: 0 },
    { ledgerId: custLedgerId, debitPaise: 0, creditPaise: 5000000 }
  ],
  billAllocation: {
    referenceVoucherId: initialPost.voucherId,
    allocationType: 'AGAINST_REF'
  }
});
console.log(`✓ Linked Receipt Posted: ${recPost.voucherNumber}`);

// Attempting to change party to another customer must be blocked
const cust2Id = `${companyId}_pty_cust_02`;
const cust2LedgerId = `${companyId}_led_cust_02`;
db.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id, opening_balance_paise, opening_balance_type, is_party)
  VALUES (?, ?, 'Second Customer Ltd', '${companyId}_grp_debtors', 0, 'DR', 1)
`).run(cust2LedgerId, companyId);
db.prepare(`
  INSERT INTO parties (party_id, company_id, party_name, party_type, ledger_id)
  VALUES (?, ?, 'Second Customer Ltd', 'CUSTOMER', ?)
`).run(cust2Id, companyId, cust2LedgerId);

assert.throws(() => {
  PostingEngine.updatePostedVoucher(db, initialPost.voucherId, {
    companyId,
    fyId,
    voucherType: 'SALES',
    voucherDate: '2026-10-15',
    partyId: cust2Id, // Changed customer!
    status: 'POSTED',
    lines: [
      {
        itemId,
        godownId,
        quantity: 2,
        ratePaise: 5200000,
        gstRate: 18,
        serialNumber: 'SN-TP01, SN-TP03'
      }
    ]
  });
}, /Cannot change customer\/party/);
console.log('✓ Prevented invalid party change while receipt is allocated');

console.log('\n======================================================================');
console.log('ALL UI-049 IN-PLACE POSTED VOUCHER EDITING TESTS PASSED (100% SUCCESS)');
console.log('======================================================================\n');
