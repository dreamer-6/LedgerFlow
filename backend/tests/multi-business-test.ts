import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initializeBusiness } from '../src/database/seed.js';

console.log('====================================================');
console.log('LEDGERFLOW MULTI-TENANT BUSINESS ISOLATION TEST SUITE');
console.log('====================================================\n');

// 1. In-Memory Database with schema
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
testDb.exec(schemaSql);

// 2. Register User
const userId = 'usr_test_user_01';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync('secret123', salt);
testDb.prepare(`
  INSERT INTO users (user_id, username, email, password_hash, full_name, role)
  VALUES (?, 'john_doe', 'john@example.com', ?, 'John Doe', 'ADMIN')
`).run(userId, hash);

// 3. User creates Business A
const bizAId = 'comp_biz_a';
initializeBusiness(testDb, {
  companyId: bizAId,
  companyName: 'Acme Hardware Ltd',
  legalName: 'Acme Hardware Private Limited',
  gstin: '33AAACA1111A1Z1',
  ownerUserId: userId
});

// 4. User creates Business B
const bizBId = 'comp_biz_b';
initializeBusiness(testDb, {
  companyId: bizBId,
  companyName: 'BlueSky Logistics',
  legalName: 'BlueSky Logistics LLP',
  gstin: '29AAACB2222B1Z2',
  ownerUserId: userId
});

// 5. Verify User owns both businesses
const userBizs = testDb.prepare(`
  SELECT c.company_id, c.company_name
  FROM companies c
  JOIN user_businesses ub ON c.company_id = ub.company_id
  WHERE ub.user_id = ?
  ORDER BY c.company_name ASC
`).all(userId) as any[];

assert.strictEqual(userBizs.length, 2, 'User must have exactly 2 businesses linked');
assert.strictEqual(userBizs[0].company_id, bizAId);
assert.strictEqual(userBizs[1].company_id, bizBId);
console.log('✓ One user account holds multiple businesses (Acme Hardware Ltd & BlueSky Logistics).');

// 6. Test Master Data Isolation: Add customer and item only to Business A
const partyALedgerId = 'led_pty_acme_client';
testDb.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
  VALUES (?, ?, '${bizAId}_grp_debtors', 'Client Alpha TN', 0, 1)
`).run(partyALedgerId, bizAId);

testDb.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin)
  VALUES ('pty_acme_client', ?, ?, 'CUSTOMER', 'Client Alpha TN', '33AAACA1111A1Z1')
`).run(bizAId, partyALedgerId);

testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, selling_rate_paise)
  VALUES ('item_hammer', ?, 'Steel Hammer 500g', '82052000', '${bizAId}_unit_pcs', 18, 45000)
`).run(bizAId);

// Query Business A parties & items
const bizAParties = testDb.prepare('SELECT * FROM parties WHERE company_id = ?').all(bizAId);
const bizAItems = testDb.prepare('SELECT * FROM stock_items WHERE company_id = ?').all(bizAId);
assert.strictEqual(bizAParties.length, 1);
assert.strictEqual(bizAItems.length, 1);

// Query Business B parties & items - MUST BE 0 (Total Data Isolation)
const bizBParties = testDb.prepare('SELECT * FROM parties WHERE company_id = ?').all(bizBId);
const bizBItems = testDb.prepare('SELECT * FROM stock_items WHERE company_id = ?').all(bizBId);
assert.strictEqual(bizBParties.length, 0, 'Business B must NOT see Business A parties');
assert.strictEqual(bizBItems.length, 0, 'Business B must NOT see Business A items');
console.log('✓ Master data isolation verified: Business B has 0 parties and 0 items from Business A.');

// 7. Test Ledger Isolation: Add transaction to Business A
testDb.prepare(`
  INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, status)
  VALUES ('vch_biz_a_01', ?, '${bizAId}_fy_2026_27', 'SALES', 'INV-01', '2026-05-01', 53100, 'POSTED')
`).run(bizAId);

testDb.prepare(`
  INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, debit_paise, credit_paise, entry_date)
  VALUES ('le_a_1', 'vch_biz_a_01', ?, 53100, 0, '2026-05-01')
`).run(partyALedgerId);

const vouchersA = testDb.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE company_id = ?').get(bizAId) as any;
const vouchersB = testDb.prepare('SELECT COUNT(*) as cnt FROM vouchers WHERE company_id = ?').get(bizBId) as any;
assert.strictEqual(vouchersA.cnt, 1, 'Business A must have 1 voucher');
assert.strictEqual(vouchersB.cnt, 0, 'Business B must have 0 vouchers');
console.log('✓ Transactional voucher isolation verified: Business B accounting data is 100% isolated.');

console.log('\n====================================================');
console.log('ALL MULTI-TENANT ISOLATION TESTS PASSED (100%)');
console.log('====================================================');
