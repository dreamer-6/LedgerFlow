/**
 * LedgerFlow Permanent Masters & Business Data Integrity Test Suite
 * TASK 004 — Master Verification & Zero-Regression Gate
 *
 * Covers:
 *   1. P0-1: Safe Stock Item Deletion (DELETE /masters/items/:id)
 *   2. P0-2: Party Deletion Protection (DELETE /masters/parties/:id)
 *   3. P1-1: Ledger groupId Scoping & Validation (POST /masters/ledgers)
 *   4. P1-2: Item unitId Scoping & Validation (POST /masters/items, PUT /masters/items/:id)
 *   5. Transaction Safety: Zero partial records after rejection
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { createApiRouter } from '../src/api/routes.js';
import { initializeBusiness } from '../src/database/seed.js';
import { jwtSecret } from '../src/middleware/security.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 004 — MASTERS & BUSINESS DATA INTEGRITY TEST SUITE');
console.log('======================================================================\n');

// ── Setup In-Memory Database ────────────────────────────────────────────────
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const rawSchema = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
const schemaSql = rawSchema
  .replace(/CREATE TABLE IF NOT EXISTS ledger_groups \(\s+group_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS ledger_groups (\n    group_id TEXT PRIMARY KEY,\n    company_id TEXT')
  .replace(/CREATE TABLE IF NOT EXISTS units \(\s+unit_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS units (\n    unit_id TEXT PRIMARY KEY,\n    company_id TEXT');
testDb.exec(schemaSql);

// Safe column migrations to mirror production schema
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN reference_date DATE;'); } catch {}
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN payment_mode TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN terms_conditions TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE voucher_lines ADD COLUMN description TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE parties ADD COLUMN bank_name TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE users ADD COLUMN email TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN owner_user_id TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE stock_items ADD COLUMN serial_numbers TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE stock_items ADD COLUMN has_serial_no INTEGER DEFAULT 0;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN mailing_name TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN vault_password_hash TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN logo_base64 TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE parties ADD COLUMN banking_name TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE parties ADD COLUMN banking_account_no TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE parties ADD COLUMN banking_ifsc TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE voucher_lines ADD COLUMN serial_number TEXT;'); } catch {}
try {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS stock_item_serials (
      serial_id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
      serial_number TEXT NOT NULL,
      status TEXT CHECK(status IN ('AVAILABLE', 'SOLD')) DEFAULT 'AVAILABLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(item_id, serial_number)
    );
  `);
} catch {}
try {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS user_businesses (
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
      role TEXT CHECK(role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER')) DEFAULT 'OWNER',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, company_id)
    );
  `);
} catch {}

// ── Seed Multi-Tenant Fixtures ──────────────────────────────────────────────
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('Pass123!', salt);

// Users
testDb.prepare(`
  INSERT INTO users (user_id, username, email, password_hash, full_name, role, is_active)
  VALUES
    ('usr_admin_a', 'admin_a', 'admin_a@comp-a.com', ?, 'Admin A', 'ADMIN', 1),
    ('usr_admin_b', 'admin_b', 'admin_b@comp-b.com', ?, 'Admin B', 'ADMIN', 1)
`).run(passwordHash, passwordHash);

// Companies
const companyA = 'comp_alpha_m';
const companyB = 'comp_beta_m';

initializeBusiness(testDb, {
  companyId: companyA,
  companyName: 'Alpha Masters Corp',
  gstin: '33AAAAA1234A1Z1'
});

initializeBusiness(testDb, {
  companyId: companyB,
  companyName: 'Beta Masters Corp',
  gstin: '29BBBBB5678B1Z2'
});

// Memberships
testDb.prepare(`
  INSERT INTO user_businesses (user_id, company_id, role)
  VALUES
    ('usr_admin_a', 'comp_alpha_m', 'ADMIN'),
    ('usr_admin_b', 'comp_beta_m', 'ADMIN')
`).run();

// Global System Unit and Group (company_id IS NULL)
testDb.prepare(`
  INSERT INTO units (unit_id, company_id, unit_name, symbol, decimal_places)
  VALUES ('unit_global_box', NULL, 'Global Box', 'BOX', 0)
`).run();

testDb.prepare(`
  INSERT INTO ledger_groups (group_id, company_id, group_name, nature, affects_gross_profit)
  VALUES ('grp_global_indirect_exp', NULL, 'Global Indirect Expenses', 'EXPENSE', 0)
`).run();

// Helper: JWT Generator
function makeToken(payload: { userId: string; username: string; role?: string }, secret = jwtSecret()) {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'ADMIN',
      name: payload.username,
      email: `${payload.username}@test.com`
    },
    secret,
    { expiresIn: '1d' }
  );
}

const tokenAdminA = makeToken({ userId: 'usr_admin_a', username: 'admin_a' });
const tokenAdminB = makeToken({ userId: 'usr_admin_b', username: 'admin_b' });

// ── Mount Test Server ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api', createApiRouter(testDb));

async function runTestSuite() {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  let totalTests = 0;
  let passedTests = 0;

  async function test(name: string, fn: () => Promise<void>) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passedTests++;
    } catch (err: any) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      server.close();
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 1: P0-1 SAFE STOCK ITEM DELETION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('[Suite 1: P0-1 Safe Stock Item Deletion]');

  await test('1.1: Unused stock item is cleanly hard-deleted', async () => {
    const itemId = 'item_unused_01';
    testDb.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, selling_rate_paise, opening_qty, hsn_sac)
      VALUES (?, ?, 'Unused Widget', '${companyA}_unit_nos', 1000, 1500, 0, '84713010')
    `).run(itemId, companyA);

    const res = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);

    // Verify row is completely deleted from stock_items
    const row = testDb.prepare('SELECT item_id FROM stock_items WHERE item_id = ?').get(itemId);
    assert.strictEqual(row, undefined, 'Unused item must be hard-deleted');
  });

  await test('1.2: Item with voucher_lines is soft-deleted (is_active = 0, row preserved)', async () => {
    const itemId = 'item_invoiced_01';
    testDb.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, selling_rate_paise, opening_qty, is_active, hsn_sac)
      VALUES (?, ?, 'Invoiced Widget', '${companyA}_unit_nos', 1000, 1500, 10, 1, '84713010')
    `).run(itemId, companyA);

    // Create a voucher with voucher_lines referencing this item
    const vchId = 'vch_inv_item_01';
    testDb.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, created_by)
      VALUES (?, ?, '${companyA}_fy_2026_27', 'SALES', 'INV-M1', '2026-05-01', 1500, 'admin')
    `).run(vchId, companyA);

    testDb.prepare(`
      INSERT INTO voucher_lines (line_id, voucher_id, line_number, item_id, taxable_amount_paise, total_amount_paise)
      VALUES ('vl_01', ?, 1, ?, 1500, 1500)
    `).run(vchId, itemId);

    const res = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);

    // Verify row still exists in stock_items and has is_active = 0
    const row = testDb.prepare('SELECT item_id, is_active FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.ok(row, 'Invoiced item row must remain in database');
    assert.strictEqual(row.is_active, 0, 'Invoiced item must be marked is_active = 0');

    // Verify voucher_line is intact
    const vl = testDb.prepare('SELECT line_id FROM voucher_lines WHERE line_id = ?').get('vl_01');
    assert.ok(vl, 'Historical voucher line must remain intact');
  });

  await test('1.3: Item with stock_entries but zero voucher_lines (Opening Stock) is soft-deleted, preserving stock_entries and STOCK_JOURNAL', async () => {
    const itemId = 'item_opn_stk_01';
    const rate = 8000;
    const qty = 5;
    const valPaise = qty * rate;

    // Create item with opening stock (STOCK_JOURNAL + stock_entries, but NO voucher_lines)
    testDb.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, purchase_rate_paise, opening_qty, opening_rate_paise, is_active, hsn_sac)
      VALUES (?, ?, 'Opening Stock Item', '${companyA}_unit_nos', ?, ?, ?, 1, '84713010')
    `).run(itemId, companyA, rate, qty, rate);

    const vchId = 'vch_stk_jour_opn';
    testDb.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, narration, status, total_amount_paise, created_by)
      VALUES (?, ?, '${companyA}_fy_2026_27', 'STOCK_JOURNAL', 'STK-OPN-1', '2026-04-01', 'Opening Stock', 'POSTED', ?, 'system')
    `).run(vchId, companyA, valPaise);

    const seId = 'se_opn_01';
    testDb.prepare(`
      INSERT INTO stock_entries (stock_entry_id, voucher_id, item_id, godown_id, entry_date, movement_type, quantity, rate_paise, value_paise)
      VALUES (?, ?, ?, '${companyA}_godown_main', '2026-04-01', 'IN', ?, ?, ?)
    `).run(seId, vchId, itemId, qty, rate, valPaise);

    // Call DELETE /masters/items/:id
    const res = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);

    // Verify item was soft-deleted
    const itemRow = testDb.prepare('SELECT item_id, is_active FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.ok(itemRow, 'Stock item record must remain');
    assert.strictEqual(itemRow.is_active, 0, 'Item with stock_entries must be set to is_active = 0');

    // CRITICAL: Verify stock_entries were NEVER deleted!
    const seRow = testDb.prepare('SELECT stock_entry_id, quantity, value_paise FROM stock_entries WHERE stock_entry_id = ?').get(seId) as any;
    assert.ok(seRow, 'stock_entries must NOT be deleted');
    assert.strictEqual(seRow.quantity, 5);
    assert.strictEqual(seRow.value_paise, 40000);

    // Verify STOCK_JOURNAL voucher remains intact
    const vchRow = testDb.prepare('SELECT voucher_id, status FROM vouchers WHERE voucher_id = ?').get(vchId) as any;
    assert.ok(vchRow, 'STOCK_JOURNAL voucher must remain intact');
    assert.strictEqual(vchRow.status, 'POSTED');
  });

  await test('1.4: Repeated deletion on already-inactive item is idempotent and preserves records', async () => {
    const itemId = 'item_opn_stk_01';
    const res = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);

    const itemRow = testDb.prepare('SELECT is_active FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.strictEqual(itemRow.is_active, 0);

    const seCount = (testDb.prepare('SELECT COUNT(*) as c FROM stock_entries WHERE item_id = ?').get(itemId) as any).c;
    assert.strictEqual(seCount, 1, 'stock_entries count must remain 1');
  });

  await test('1.5: Cross-company item deletion returns 404 and does not mutate foreign item', async () => {
    // Admin A attempts to delete an item belonging to Company B
    const itemBId = 'item_comp_b_test';
    testDb.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, hsn_sac, is_active)
      VALUES (?, ?, 'Beta Exclusive Item', '${companyB}_unit_nos', '84713010', 1)
    `).run(itemBId, companyB);

    const res = await fetch(`${baseUrl}/masters/items/${itemBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 404, 'Cross-company deletion must return 404');

    // Verify item in Company B is unchanged
    const itemRow = testDb.prepare('SELECT is_active FROM stock_items WHERE item_id = ?').get(itemBId) as any;
    assert.strictEqual(itemRow.is_active, 1, 'Foreign item must remain active');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: P0-2 PARTY DELETION PROTECTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 2: P0-2 Party Deletion Protection]');

  await test('2.1: Completely unused party is successfully hard-deleted (party, address, ledger)', async () => {
    const partyId = 'pty_clean_del';
    const ledgerId = 'led_pty_clean_del';

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Clean Party', 0, 1)
    `).run(ledgerId, companyA);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Clean Party')
    `).run(partyId, companyA, ledgerId);

    testDb.prepare(`
      INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_clean_01', ?, '123 Clean St', 'Chennai', 'Tamil Nadu', '33', '600001')
    `).run(partyId);

    const res = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 200);

    // Verify all 3 records are deleted
    assert.strictEqual(testDb.prepare('SELECT 1 FROM parties WHERE party_id = ?').get(partyId), undefined);
    assert.strictEqual(testDb.prepare('SELECT 1 FROM party_addresses WHERE address_id = ?').get('addr_clean_01'), undefined);
    assert.strictEqual(testDb.prepare('SELECT 1 FROM ledgers WHERE ledger_id = ?').get(ledgerId), undefined);
  });

  await test('2.2: Party with opening balance is rejected (400), party and opening balance preserved', async () => {
    const partyId = 'pty_with_opn_bal';
    const ledgerId = 'led_pty_opn_bal';
    const openingPaise = 5000000; // ₹50,000

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Party With Opening Bal', ?, 'DR', 1)
    `).run(ledgerId, companyA, openingPaise);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Party With Opening Bal')
    `).run(partyId, companyA, ledgerId);

    testDb.prepare(`
      INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_opn_01', ?, '456 Balance St', 'Chennai', 'Tamil Nadu', '33', '600001')
    `).run(partyId);

    const res = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 400);
    const body: any = await res.json();
    assert.ok(body.error.includes('opening balance') || body.error.includes('Cannot delete party'));

    // Verify database state: party, address, ledger, and opening balance are 100% UNTOUCHED
    const partyRow = testDb.prepare('SELECT party_id FROM parties WHERE party_id = ?').get(partyId);
    const ledgerRow = testDb.prepare('SELECT opening_balance_paise FROM ledgers WHERE ledger_id = ?').get(ledgerId) as any;
    const addrRow = testDb.prepare('SELECT address_id FROM party_addresses WHERE address_id = ?').get('addr_opn_01');

    assert.ok(partyRow, 'Party row must still exist in database');
    assert.ok(addrRow, 'Party address row must still exist in database');
    assert.ok(ledgerRow, 'Ledger row must still exist in database');
    assert.strictEqual(ledgerRow.opening_balance_paise, openingPaise, 'Opening balance must remain exactly 5,000,000 paise');
  });

  await test('2.3: Party with recorded voucher is rejected (400), party and voucher preserved', async () => {
    const partyId = 'pty_with_vch';
    const ledgerId = 'led_pty_with_vch';

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Party With Voucher', 0, 1)
    `).run(ledgerId, companyA);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Party With Voucher')
    `).run(partyId, companyA, ledgerId);

    const vchId = 'vch_party_guard_01';
    testDb.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, party_id, total_amount_paise, created_by)
      VALUES (?, ?, '${companyA}_fy_2026_27', 'SALES', 'INV-PTY-1', '2026-05-01', ?, 1000, 'admin')
    `).run(vchId, companyA, partyId);

    const res = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 400);

    const partyRow = testDb.prepare('SELECT party_id FROM parties WHERE party_id = ?').get(partyId);
    assert.ok(partyRow, 'Party must not be deleted when vouchers exist');
  });

  await test('2.4: Party with bill_allocations is rejected (400), party and allocation preserved', async () => {
    const partyId = 'pty_with_alloc';
    const ledgerId = 'led_pty_with_alloc';

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Party With Allocation', 0, 1)
    `).run(ledgerId, companyA);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Party With Allocation')
    `).run(partyId, companyA, ledgerId);

    const vchId = 'vch_for_alloc_test';
    testDb.prepare(`
      INSERT INTO vouchers (voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date, total_amount_paise, created_by)
      VALUES (?, ?, '${companyA}_fy_2026_27', 'JOURNAL', 'JRN-AL-1', '2026-05-01', 5000, 'admin')
    `).run(vchId, companyA);

    const allocId = 'ba_test_01';
    testDb.prepare(`
      INSERT INTO bill_allocations (allocation_id, voucher_id, ledger_id, allocation_type, amount_paise)
      VALUES (?, ?, ?, 'ON_ACCOUNT', 5000)
    `).run(allocId, vchId, ledgerId);

    const res = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 400);

    const partyRow = testDb.prepare('SELECT party_id FROM parties WHERE party_id = ?').get(partyId);
    const allocRow = testDb.prepare('SELECT allocation_id FROM bill_allocations WHERE allocation_id = ?').get(allocId);
    assert.ok(partyRow, 'Party must not be deleted when bill allocations exist');
    assert.ok(allocRow, 'Bill allocation must remain intact');
  });

  await test('2.5: Cross-company party deletion returns 404 and does not mutate foreign party', async () => {
    const partyBId = 'pty_beta_cust_01';
    const ledgerBId = 'led_pty_beta_01';

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
      VALUES (?, ?, '${companyB}_grp_debtors', 'Beta Client One', 0, 1)
    `).run(ledgerBId, companyB);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Beta Client One')
    `).run(partyBId, companyB, ledgerBId);

    const res = await fetch(`${baseUrl}/masters/parties/${partyBId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 404, 'Cross-company party deletion must return 404');

    const partyRow = testDb.prepare('SELECT party_id FROM parties WHERE party_id = ?').get(partyBId);
    assert.ok(partyRow, 'Foreign party must remain untouched');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: P1-1 LEDGER VALIDATION (POST /masters/ledgers)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 3: P1-1 Ledger Validation]');

  await test('3.1: Valid company group succeeds (201)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_debtors`,
        ledgerName: 'Direct Debtor Sub-Account',
        openingBalancePaise: 10000,
        openingBalanceType: 'DR'
      })
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();
    assert.ok(body.ledgerId);

    const row = testDb.prepare('SELECT ledger_id, group_id, opening_balance_type FROM ledgers WHERE ledger_id = ?').get(body.ledgerId) as any;
    assert.ok(row);
    assert.strictEqual(row.group_id, `${companyA}_grp_debtors`);
    assert.strictEqual(row.opening_balance_type, 'DR');
  });

  await test('3.2: Global/system group (company_id IS NULL) succeeds (201)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: 'grp_global_indirect_exp',
        ledgerName: 'Office Stationery',
        openingBalancePaise: 0,
        openingBalanceType: 'DR'
      })
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    const row = testDb.prepare('SELECT ledger_id, group_id FROM ledgers WHERE ledger_id = ?').get(body.ledgerId) as any;
    assert.ok(row);
    assert.strictEqual(row.group_id, 'grp_global_indirect_exp');
  });

  await test('3.3: Foreign company group is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyB}_grp_debtors`, // Foreign group!
        ledgerName: 'Malicious Injected Ledger'
      })
    });
    assert.strictEqual(res.status, 400);

    const row = testDb.prepare("SELECT ledger_id FROM ledgers WHERE ledger_name = 'Malicious Injected Ledger'").get();
    assert.strictEqual(row, undefined, 'No ledger must be created with foreign group');
  });

  await test('3.4: Nonexistent group is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: 'grp_does_not_exist_xyz',
        ledgerName: 'Nonexistent Group Ledger'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await test('3.5: Empty ledger name is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_debtors`,
        ledgerName: ''
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await test('3.6: Whitespace-only ledger name is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_debtors`,
        ledgerName: '     '
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await test('3.7: Opening balance type DR is accepted', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_debtors`,
        ledgerName: 'Valid DR Ledger',
        openingBalancePaise: 500,
        openingBalanceType: 'DR'
      })
    });
    assert.strictEqual(res.status, 201);
  });

  await test('3.8: Opening balance type CR is accepted', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_creditors`,
        ledgerName: 'Valid CR Ledger',
        openingBalancePaise: 500,
        openingBalanceType: 'CR'
      })
    });
    assert.strictEqual(res.status, 201);
  });

  await test('3.9: Invalid opening balance type is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/ledgers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        groupId: `${companyA}_grp_debtors`,
        ledgerName: 'Invalid Type Ledger',
        openingBalancePaise: 500,
        openingBalanceType: 'INVALID_BAL_TYPE'
      })
    });
    assert.strictEqual(res.status, 400);

    const row = testDb.prepare("SELECT ledger_id FROM ledgers WHERE ledger_name = 'Invalid Type Ledger'").get();
    assert.strictEqual(row, undefined, 'No ledger must be created when opening balance type is invalid');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: P1-2 ITEM unitId VALIDATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 4: P1-2 Item unitId Validation]');

  await test('4.1: Company unit on item creation succeeds (201)', async () => {
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Company Unit Item',
        unitId: `${companyA}_unit_nos`,
        hsnSac: '84713010',
        purchaseRatePaise: 1000,
        sellingRatePaise: 1500
      })
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    const row = testDb.prepare('SELECT unit_id FROM stock_items WHERE item_id = ?').get(body.itemId) as any;
    assert.strictEqual(row.unit_id, `${companyA}_unit_nos`);
  });

  await test('4.2: Global unit (company_id IS NULL) on item creation succeeds (201)', async () => {
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Global Unit Item',
        unitId: 'unit_global_box',
        hsnSac: '84713010',
        purchaseRatePaise: 2000,
        sellingRatePaise: 2500
      })
    });
    assert.strictEqual(res.status, 201);
    const body: any = await res.json();

    const row = testDb.prepare('SELECT unit_id FROM stock_items WHERE item_id = ?').get(body.itemId) as any;
    assert.strictEqual(row.unit_id, 'unit_global_box');
  });

  await test('4.3: Foreign company unit on item creation is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Foreign Unit Item',
        unitId: `${companyB}_unit_nos`, // Foreign unit!
        hsnSac: '84713010',
        purchaseRatePaise: 1000,
        sellingRatePaise: 1500
      })
    });
    assert.strictEqual(res.status, 400);

    const row = testDb.prepare("SELECT item_id FROM stock_items WHERE item_name = 'Foreign Unit Item'").get();
    assert.strictEqual(row, undefined, 'Item must not be created with foreign unit');
  });

  await test('4.4: Nonexistent unit on item creation is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Nonexistent Unit Item',
        unitId: 'unit_does_not_exist_xyz',
        hsnSac: '84713010'
      })
    });
    assert.strictEqual(res.status, 400);
  });

  await test('4.5: Existing item update with valid unit succeeds (200)', async () => {
    // Create item first
    const createRes = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Updatable Unit Item',
        unitId: `${companyA}_unit_nos`,
        hsnSac: '84713010'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const { itemId } = (await createRes.json()) as any;

    // Update with global unit
    const putRes = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Updatable Unit Item',
        unitId: 'unit_global_box',
        hsnSac: '84713010'
      })
    });
    assert.strictEqual(putRes.status, 200);

    const row = testDb.prepare('SELECT unit_id FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.strictEqual(row.unit_id, 'unit_global_box');
  });

  await test('4.6: Existing item update with foreign unit is rejected (400), original unit preserved', async () => {
    const createRes = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Protected Unit Item',
        unitId: `${companyA}_unit_nos`,
        hsnSac: '84713010'
      })
    });
    const { itemId } = (await createRes.json()) as any;

    // Attempt update with Company B unit
    const putRes = await fetch(`${baseUrl}/masters/items/${itemId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Protected Unit Item',
        unitId: `${companyB}_unit_nos`,
        hsnSac: '84713010'
      })
    });
    assert.strictEqual(putRes.status, 400);

    // Verify original unit was preserved
    const row = testDb.prepare('SELECT unit_id FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.strictEqual(row.unit_id, `${companyA}_unit_nos`, 'Original unit must remain unchanged');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 5: TRANSACTION SAFETY & ZERO PARTIAL RECORDS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 5: Transaction Safety]');

  await test('5.1: Party deletion failure leaves database in valid state with zero partial deletions', async () => {
    const partyId = 'pty_tx_guard';
    const ledgerId = 'led_pty_tx_guard';

    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Tx Guard Party', 50000, 1)
    `).run(ledgerId, companyA);

    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name)
      VALUES (?, ?, ?, 'CUSTOMER', 'Tx Guard Party')
    `).run(partyId, companyA, ledgerId);

    testDb.prepare(`
      INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
      VALUES ('addr_tx_01', ?, '789 Guard Rd', 'Chennai', 'Tamil Nadu', '33', '600001')
    `).run(partyId);

    // Rejection due to opening balance
    const res = await fetch(`${baseUrl}/masters/parties/${partyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAdminA}` }
    });
    assert.strictEqual(res.status, 400);

    // Verify party, address, and ledger are completely intact
    assert.ok(testDb.prepare('SELECT party_id FROM parties WHERE party_id = ?').get(partyId));
    assert.ok(testDb.prepare('SELECT address_id FROM party_addresses WHERE address_id = ?').get('addr_tx_01'));
    assert.ok(testDb.prepare('SELECT ledger_id FROM ledgers WHERE ledger_id = ?').get(ledgerId));
  });

  await test('5.2: Item creation failure leaves zero partial records in database', async () => {
    const preCount = (testDb.prepare('SELECT COUNT(*) as c FROM stock_items').get() as any).c;

    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAdminA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemName: 'Failing Item',
        unitId: 'non_existent_unit_id_999'
      })
    });
    assert.strictEqual(res.status, 400);

    const postCount = (testDb.prepare('SELECT COUNT(*) as c FROM stock_items').get() as any).c;
    assert.strictEqual(postCount, preCount, 'stock_items table count must be unchanged');
  });

  server.close();

  console.log('\n======================================================================');
  console.log(`ALL ${passedTests} / ${totalTests} MASTERS INTEGRITY TESTS PASSED (100% SUCCESS)`);
  console.log('======================================================================');
}

runTestSuite().catch(err => {
  console.error('\nFatal error running master integrity test suite:', err);
  process.exit(1);
});
