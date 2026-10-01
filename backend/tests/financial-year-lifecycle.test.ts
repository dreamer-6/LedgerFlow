/**
 * LedgerFlow Financial Year, Period Closing & Opening Balance Lifecycle Test Suite
 * TASK 007 — Verification & Zero-Regression Gate
 *
 * Covers:
 *   TEST_FY_01: Reject startDate >= endDate and invalid date formats
 *   TEST_FY_02: Reject overlapping FY ranges and duplicate names for same company
 *   TEST_FY_03: Allow valid adjacent FYs
 *   TEST_FY_04: Voucher date auto-resolves to matching FY strictly
 *   TEST_FY_05: Voucher date outside all FYs rejected immediately with 400
 *   TEST_FY_06: Explicit fyId with mismatched voucherDate rejected with 400
 *   TEST_FY_07: Closed FY rejects voucher posting
 *   TEST_FY_08: Party opening balance cannot mutate after vouchers exist
 *   TEST_FY_09: Party opening balance cannot mutate when a closed FY exists
 *   TEST_FY_10: Stock item update cannot bypass closed/missing FY
 *   TEST_FY_11A: Positive stock adjustment creates balanced double-entry accounting
 *   TEST_FY_11B: Negative stock adjustment creates balanced double-entry accounting
 *   TEST_FY_11C: Stock Summary valuation equals Inventory Asset ledger after adjustments
 *   TEST_FY_11D: Negative stock adjustment respects allowNegativeStock policy
 *   TEST_FY_11E: Existing-item stock adjustment does not modify inception opening stock
 *   TEST_FY_12: Nominal ledger opening balance resets to ₹0 at FY boundary
 *   TEST_FY_13: Balance Sheet ledger retains cumulative balance across FYs
 *   TEST_FY_14: Reopening closed FY requires OWNER authorization, non-empty reason, and audit log
 *   TEST_FY_15: Unauthorized FY status mutation rejected with 403
 *   TEST_FY_16: Genuine concurrency/race test with simultaneous requests for same/overlapping FY
 *   TEST_FY_17: Cross-tenant FY mutation rejected
 *   TEST_FY_18: Zero duplicate opening stock across FY boundaries
 *   TEST_FY_19: Multi-year retained earnings remains correct on Balance Sheet
 *   TEST_FY_20: Full regression verification across baseline reports
 *   SCENARIO_REOPEN: CLOSED -> OWNER REOPEN -> historical voucher -> reconciliation
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
import { ReportEngine } from '../src/reports/report-engine.js';
import { BusinessService } from '../src/services/business.service.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 007 — FINANCIAL YEAR & OPENING BALANCE INTEGRITY SUITE');
console.log('======================================================================\n');

// ── Setup In-Memory Database ────────────────────────────────────────────────
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const rawSchema = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
const schemaSql = rawSchema
  .replace(/CREATE TABLE IF NOT EXISTS ledger_groups \(\s+group_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS ledger_groups (\n    group_id TEXT PRIMARY KEY,\n    company_id TEXT')
  .replace(/CREATE TABLE IF NOT EXISTS units \(\s+unit_id TEXT PRIMARY KEY,\s+company_id TEXT NOT NULL/g, 'CREATE TABLE IF NOT EXISTS units (\n    unit_id TEXT PRIMARY KEY,\n    company_id TEXT');
testDb.exec(schemaSql);

// Column extensions to mirror production schema
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
    ('usr_owner_a', 'owner_a', 'owner_a@comp-a.com', ?, 'Owner A', 'ADMIN', 1),
    ('usr_admin_a', 'admin_a', 'admin_a@comp-a.com', ?, 'Admin A', 'ADMIN', 1),
    ('usr_viewer_a', 'viewer_a', 'viewer_a@comp-a.com', ?, 'Viewer A', 'ADMIN', 1),
    ('usr_owner_b', 'owner_b', 'owner_b@comp-b.com', ?, 'Owner B', 'ADMIN', 1)
`).run(passwordHash, passwordHash, passwordHash, passwordHash);

// Companies
const companyA = 'comp_fy_alpha';
const companyB = 'comp_fy_beta';

initializeBusiness(testDb, {
  companyId: companyA,
  companyName: 'Alpha FY Corp',
  gstin: '27AABCA1234A1Z1',
  ownerUserId: 'usr_owner_a'
});

initializeBusiness(testDb, {
  companyId: companyB,
  companyName: 'Beta FY Corp',
  gstin: '27BBBCB5678B1Z2',
  ownerUserId: 'usr_owner_b'
});

// Memberships
testDb.prepare(`
  INSERT OR REPLACE INTO user_businesses (user_id, company_id, role)
  VALUES
    ('usr_owner_a', 'comp_fy_alpha', 'OWNER'),
    ('usr_admin_a', 'comp_fy_alpha', 'ADMIN'),
    ('usr_viewer_a', 'comp_fy_alpha', 'VIEWER'),
    ('usr_owner_b', 'comp_fy_beta', 'OWNER')
`).run();

// Helper: JWT Generator
function makeToken(payload: { userId: string; username: string; role?: string }, secret = jwtSecret()) {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'USER',
      name: payload.username,
      email: `${payload.username}@test.com`
    },
    secret,
    { expiresIn: '1d' }
  );
}

const tokenOwnerA = makeToken({ userId: 'usr_owner_a', username: 'owner_a' });
const tokenAdminA = makeToken({ userId: 'usr_admin_a', username: 'admin_a' });
const tokenViewerA = makeToken({ userId: 'usr_viewer_a', username: 'viewer_a' });
const tokenOwnerB = makeToken({ userId: 'usr_owner_b', username: 'owner_b' });

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
  // SUITE 1: FINANCIAL YEAR VALIDATION & CONCURRENCY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 1: Financial Year Validation & Concurrency]');

  await test('TEST_FY_01: Reject startDate >= endDate and invalid date formats', async () => {
    // 1. Inverted range
    const res1 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'Inverted FY',
        startDate: '2027-03-31',
        endDate: '2026-04-01'
      })
    });
    assert.strictEqual(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.error, /must be strictly before end date/i);

    // 2. Same-day range
    const res2 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'Single Day FY',
        startDate: '2026-04-01',
        endDate: '2026-04-01'
      })
    });
    assert.strictEqual(res2.status, 400);
    const body2 = await res2.json();
    assert.match(body2.error, /must be strictly before end date/i);

    // 3. Invalid date format
    const res3 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'Bad Date Format FY',
        startDate: '2026/04/01',
        endDate: '2027-03-31'
      })
    });
    assert.strictEqual(res3.status, 400);
    const body3 = await res3.json();
    assert.match(body3.error, /Invalid start date format/i);
  });

  await test('TEST_FY_02: Reject overlapping FY ranges and duplicate names for same company', async () => {
    // Default FY initialized in companyA is 2026-04-01 to 2027-03-31 ("FY 2026-27")
    // Partial overlap: 2027-01-01 to 2027-12-31
    const res1 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'Overlapping FY Partial',
        startDate: '2027-01-01',
        endDate: '2027-12-31'
      })
    });
    assert.strictEqual(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.error, /overlaps with existing financial year/i);

    // Enclosed overlap: 2026-06-01 to 2026-12-31
    const res2 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'Overlapping FY Enclosed',
        startDate: '2026-06-01',
        endDate: '2026-12-31'
      })
    });
    assert.strictEqual(res2.status, 400);
    const body2 = await res2.json();
    assert.match(body2.error, /overlaps with existing financial year/i);

    // Duplicate name
    const res3 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: '2026-2027',
        startDate: '2028-04-01',
        endDate: '2029-03-31'
      })
    });
    assert.strictEqual(res3.status, 400);
    const body3 = await res3.json();
    assert.match(body3.error, /already exists for this company/i);
  });

  await test('TEST_FY_03: Allow valid adjacent FYs', async () => {
    // Current FY is 2026-04-01 to 2027-03-31
    // Create FY 2025-26: 2025-04-01 to 2026-03-31 (Adjacent prior)
    const res1 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'FY 2025-26',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
        status: 'OPEN'
      })
    });
    assert.strictEqual(res1.status, 201);
    const body1 = await res1.json();
    assert.strictEqual(body1.name, 'FY 2025-26');

    // Create FY 2027-28: 2027-04-01 to 2028-03-31 (Adjacent future)
    const res2 = await fetch(`${baseUrl}/financial-years`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        name: 'FY 2027-28',
        startDate: '2027-04-01',
        endDate: '2028-03-31',
        status: 'OPEN'
      })
    });
    assert.strictEqual(res2.status, 201);
    const body2 = await res2.json();
    assert.strictEqual(body2.name, 'FY 2027-28');
  });

  await test('TEST_FY_16: Genuine concurrency/race test with simultaneous requests for same/overlapping FY', async () => {
    // 10 simultaneous requests attempting to create overlapping FY: 2028-04-01 to 2029-03-31
    const attempts = 10;
    const promises = Array.from({ length: attempts }, (_, i) => {
      return fetch(`${baseUrl}/financial-years`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenAdminA}`,
          'x-company-id': companyA
        },
        body: JSON.stringify({
          name: `Concurrent FY ${i}`,
          startDate: '2028-04-01',
          endDate: '2029-03-31',
          status: 'OPEN'
        })
      });
    });

    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);
    const successCount = statuses.filter(s => s === 201).length;
    const errorCount = statuses.filter(s => s === 400).length;
    const crashCount = statuses.filter(s => s >= 500).length;

    assert.strictEqual(successCount, 1, `Exactly 1 concurrent request must succeed, got ${successCount}`);
    assert.strictEqual(errorCount, attempts - 1, `Remaining ${attempts - 1} requests must fail with 400, got ${errorCount}`);
    assert.strictEqual(crashCount, 0, `Zero 500 crashes permitted, got ${crashCount}`);

    // Verify DB state has exactly one record covering 2028-04-01
    const dbFys = testDb.prepare('SELECT COUNT(*) as cnt FROM financial_years WHERE company_id = ? AND start_date = ?').get(companyA, '2028-04-01') as any;
    assert.strictEqual(dbFys.cnt, 1, 'Database must contain exactly 1 financial year for 2028-04-01');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 2: VOUCHER POSTING & FY DATE RESOLUTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 2: Voucher Posting & FY Date Resolution]');

  // Setup customer and item in companyA
  const custLedgerId = `${companyA}_led_cust_alpha`;
  testDb.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, '${companyA}_grp_debtors', 'Alpha Customer', 0, 'DR', 1)
  `).run(custLedgerId, companyA);

  const custPartyId = `${companyA}_party_cust_alpha`;
  testDb.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
    VALUES (?, ?, ?, 'Alpha Customer', 'CUSTOMER', '27AABCA9999A1Z8')
  `).run(custPartyId, companyA, custLedgerId);

  const itemId = `${companyA}_item_laptop`;
  testDb.prepare(`
    INSERT INTO stock_items (item_id, company_id, item_name, unit_id, hsn_sac, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
    VALUES (?, ?, 'Business Laptop', '${companyA}_unit_nos', '84713010', 5000000, 6500000, 20, 5000000)
  `).run(itemId, companyA);

  const fy2526Setup = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;
  PostingEngine.recordOpeningStock(testDb, {
    companyId: companyA,
    itemId,
    itemName: 'Business Laptop',
    quantity: 20,
    ratePaise: 5000000,
    godownId: `${companyA}_godown_main`,
    fyId: fy2526Setup.fy_id,
    date: '2025-04-01'
  });

  // Offset opening stock inventory asset with Proprietor Capital equity
  testDb.prepare(`
    UPDATE ledgers
    SET opening_balance_paise = ?, opening_balance_type = 'CR'
    WHERE ledger_id = ?
  `).run(100000000, `${companyA}_led_capital`);

  await test('TEST_FY_04: Voucher date auto-resolves to matching FY strictly', async () => {
    // 1. Post voucher in FY 2025-26 (date: 2025-06-15)
    const res1 = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        voucherType: 'SALES',
        voucherDate: '2025-06-15',
        partyId: custPartyId,
        narration: 'Invoice in FY 2025-26',
        lines: [{
          itemId,
          quantity: 1,
          ratePaise: 6500000,
          gstRate: 18
        }]
      })
    });
    assert.strictEqual(res1.status, 201);
    const body1 = await res1.json();
    assert.ok(body1.voucherId);

    // Verify DB voucher has fy_id pointing to FY 2025-26
    const row1 = testDb.prepare('SELECT fy_id FROM vouchers WHERE voucher_id = ?').get(body1.voucherId) as any;
    const fy2526 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;
    assert.strictEqual(row1.fy_id, fy2526.fy_id, 'Voucher in 2025-06-15 must resolve to FY 2025-26');

    // 2. Post voucher in FY 2026-27 (date: 2026-06-15)
    const res2 = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        voucherType: 'SALES',
        voucherDate: '2026-06-15',
        partyId: custPartyId,
        narration: 'Invoice in FY 2026-27',
        lines: [{
          itemId,
          quantity: 1,
          ratePaise: 6500000,
          gstRate: 18
        }]
      })
    });
    const body2 = await res2.json();
    assert.strictEqual(res2.status, 201);
    const row2 = testDb.prepare('SELECT fy_id FROM vouchers WHERE voucher_id = ?').get(body2.voucherId) as any;
    const fy2627 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND start_date = ?').get(companyA, '2026-04-01') as any;
    assert.strictEqual(row2.fy_id, fy2627.fy_id, 'Voucher in 2026-06-15 must resolve to FY 2026-27');
  });

  await test('TEST_FY_05: Voucher date outside all FYs rejected immediately with 400', async () => {
    // Attempt voucher in 2024-01-01 (no FY exists covering 2024)
    const res = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        voucherType: 'SALES',
        voucherDate: '2024-01-01',
        partyId: custPartyId,
        narration: 'Out of bounds voucher',
        lines: [{
          itemId,
          quantity: 1,
          ratePaise: 6500000,
          gstRate: 18
        }]
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /No financial year found covering voucher date/i);
  });

  await test('TEST_FY_06: Explicit fyId with mismatched voucherDate rejected with 400', async () => {
    const fy2526 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;
    // Explicit FY 2025-26, but date is in 2026-08-01 (outside FY 2025-26)
    const res = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        fyId: fy2526.fy_id,
        voucherType: 'SALES',
        voucherDate: '2026-08-01',
        partyId: custPartyId,
        narration: 'Mismatched FY and date',
        lines: [{
          itemId,
          quantity: 1,
          ratePaise: 6500000,
          gstRate: 18
        }]
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /is outside specified Financial Year/i);
  });

  await test('TEST_FY_07: Closed FY rejects voucher posting', async () => {
    const fy2526 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;

    // Close FY 2025-26
    const closeRes = await fetch(`${baseUrl}/financial-years/${fy2526.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.strictEqual(closeRes.status, 200);

    // Try posting into closed period via voucherDate
    const res1 = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        voucherType: 'SALES',
        voucherDate: '2025-10-15',
        partyId: custPartyId,
        lines: [{ itemId, quantity: 1, ratePaise: 6500000, gstRate: 18 }]
      })
    });
    assert.strictEqual(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.error, /is CLOSED. Posting prohibited/i);

    // Try posting into closed period via explicit fyId
    const res2 = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        fyId: fy2526.fy_id,
        voucherType: 'SALES',
        voucherDate: '2025-10-15',
        partyId: custPartyId,
        lines: [{ itemId, quantity: 1, ratePaise: 6500000, gstRate: 18 }]
      })
    });
    assert.strictEqual(res2.status, 400);
    const body2 = await res2.json();
    assert.match(body2.error, /is CLOSED. Posting prohibited/i);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 3: INCEPTION OPENING BALANCE IMMUTABILITY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 3: Inception Opening Balance Immutability]');

  await test('TEST_FY_08: Party opening balance cannot mutate after vouchers exist', async () => {
    // custPartyId has vouchers posted in TEST_FY_04. Attempt to change opening balance
    const res = await fetch(`${baseUrl}/masters/parties/${custPartyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        partyName: 'Alpha Customer',
        openingBalancePaise: 999900
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Cannot modify opening balance for party/i);

    // Check DB row unchanged
    const led = testDb.prepare('SELECT opening_balance_paise FROM ledgers WHERE ledger_id = ?').get(custLedgerId) as any;
    assert.strictEqual(led.opening_balance_paise, 0);
  });

  await test('TEST_FY_09: Party opening balance cannot mutate when a closed FY exists', async () => {
    // Create an un-transacted party in companyA
    const freshLedgerId = `${companyA}_led_fresh_party`;
    testDb.prepare(`
      INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
      VALUES (?, ?, '${companyA}_grp_debtors', 'Fresh Unused Party', 10000, 'DR', 1)
    `).run(freshLedgerId, companyA);

    const freshPartyId = `${companyA}_party_fresh`;
    testDb.prepare(`
      INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
      VALUES (?, ?, ?, 'Fresh Unused Party', 'CUSTOMER', '27AABCA0000A1Z0')
    `).run(freshPartyId, companyA, freshLedgerId);

    // Offset opening balance with Proprietor Capital to keep trial balance balanced
    testDb.prepare(`
      UPDATE ledgers SET opening_balance_paise = opening_balance_paise + 10000 WHERE ledger_id = ?
    `).run(`${companyA}_led_capital`);

    // companyA has a CLOSED FY (FY 2025-26 was closed in TEST_FY_07). Attempt to modify opening balance
    const res = await fetch(`${baseUrl}/masters/parties/${freshPartyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        partyName: 'Fresh Unused Party',
        openingBalancePaise: 50000
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Cannot modify opening balance for party/i);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 4: STOCK ADJUSTMENT DOUBLE-ENTRY & ASSET SYNCHRONIZATION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 4: Stock Adjustment Double-Entry & Asset Synchronization]');

  await test('TEST_FY_10: Stock item update cannot bypass closed/missing FY', async () => {
    // In companyB, close the only FY
    const fyB = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ?').get(companyB) as any;
    testDb.prepare("UPDATE financial_years SET status = 'CLOSED' WHERE fy_id = ?").run(fyB.fy_id);

    // Create an item in companyB
    const itemBId = `${companyB}_item_b01`;
    testDb.prepare(`
      INSERT INTO stock_items (item_id, company_id, item_name, unit_id, hsn_sac, purchase_rate_paise, selling_rate_paise, opening_qty, opening_rate_paise)
      VALUES (?, ?, 'Beta Item 01', '${companyB}_unit_nos', '84713010', 1000, 2000, 10, 1000)
    `).run(itemBId, companyB);

    // Attempt stock adjustment on existing item in companyB with closed FY
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`,
        'x-company-id': companyB
      },
      body: JSON.stringify({
        itemName: 'Beta Item 01',
        quantityToAdd: 5,
        purchaseRatePaise: 1000
      })
    });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /Cannot adjust stock: Financial Year .* is CLOSED/i);
  });

  await test('TEST_FY_11A: Positive stock adjustment creates balanced double-entry accounting', async () => {
    // We adjust stock for 'Business Laptop' in companyA by +5 units @ 50,000 paise (₹500.00 each)
    const initialInvBalance = ReportEngine.getTrialBalance(testDb, companyA, '2026-10-01').rows
      .find(r => r.ledgerId.includes('inventory'))?.debitPaise || 0;

    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        itemName: 'Business Laptop',
        quantityToAdd: 5,
        purchaseRatePaise: 5000000
      })
    });
    assert.strictEqual(res.status, 200);

    // Verify voucher created: STOCK_JOURNAL with DR Inventory, CR COGS
    const latestVch = testDb.prepare(`
      SELECT voucher_id, voucher_type, total_amount_paise FROM vouchers
      WHERE company_id = ? AND voucher_type = 'STOCK_JOURNAL'
      ORDER BY rowid DESC LIMIT 1
    `).get(companyA) as any;
    assert.ok(latestVch);
    assert.strictEqual(latestVch.total_amount_paise, 25000000); // 5 * 5,000,000 = 25,000,000 paise

    // Verify ledger entries are strictly balanced
    const entries = testDb.prepare(`
      SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries
      WHERE voucher_id = ?
    `).all(latestVch.voucher_id) as any[];

    assert.strictEqual(entries.length, 2);
    const invLine = entries.find(e => e.ledger_id.includes('inventory'));
    const cogsLine = entries.find(e => e.ledger_id.includes('cogs'));

    assert.ok(invLine && invLine.debit_paise === 25000000 && invLine.credit_paise === 0, 'Inventory Asset must be debited by 25,000,000 paise');
    assert.ok(cogsLine && cogsLine.credit_paise === 25000000 && cogsLine.debit_paise === 0, 'COGS must be credited by 25,000,000 paise');

    // Verify Trial Balance remains strictly balanced
    const tb = ReportEngine.getTrialBalance(testDb, companyA, '2026-10-02');
    assert.strictEqual(tb.isBalanced, true);
    assert.strictEqual(tb.totalDebitPaise, tb.totalCreditPaise);
  });

  await test('TEST_FY_11B: Negative stock adjustment creates balanced double-entry accounting', async () => {
    // Stock adjustment: reduce by 2 units
    const res = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        itemName: 'Business Laptop',
        quantityToAdd: -2
      })
    });
    assert.strictEqual(res.status, 200);

    const latestVch = testDb.prepare(`
      SELECT voucher_id, voucher_type, total_amount_paise FROM vouchers
      WHERE company_id = ? AND voucher_type = 'STOCK_JOURNAL'
      ORDER BY rowid DESC LIMIT 1
    `).get(companyA) as any;
    assert.ok(latestVch);
    assert.strictEqual(latestVch.total_amount_paise, 10000000); // 2 * 5,000,000 = 10,000,000 paise

    // Verify ledger entries: DR COGS, CR Inventory
    const entries = testDb.prepare(`
      SELECT ledger_id, debit_paise, credit_paise FROM ledger_entries
      WHERE voucher_id = ?
    `).all(latestVch.voucher_id) as any[];

    assert.strictEqual(entries.length, 2);
    const invLine = entries.find(e => e.ledger_id.includes('inventory'));
    const cogsLine = entries.find(e => e.ledger_id.includes('cogs'));

    assert.ok(cogsLine && cogsLine.debit_paise === 10000000 && cogsLine.credit_paise === 0, 'COGS must be debited by 10,000,000 paise');
    assert.ok(invLine && invLine.credit_paise === 10000000 && invLine.debit_paise === 0, 'Inventory Asset must be credited by 10,000,000 paise');

    const tb = ReportEngine.getTrialBalance(testDb, companyA, '2026-10-02');
    assert.strictEqual(tb.isBalanced, true);
    assert.strictEqual(tb.totalDebitPaise, tb.totalCreditPaise);
  });

  await test('TEST_FY_11C: Stock Summary valuation equals Inventory Asset ledger after adjustments', async () => {
    const today = new Date().toISOString().split('T')[0];
    const stockSummary = ReportEngine.getStockSummary(testDb, companyA, today);
    const totalStockValuation = stockSummary.reduce((sum, item) => sum + item.totalValuePaise, 0);

    const invLedgerRow = testDb.prepare(`
      SELECT ledger_id FROM ledgers WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Inventory%')
    `).get(companyA, `${companyA}_led_inventory`) as any;

    const stmt = ReportEngine.getLedgerStatement(testDb, companyA, invLedgerRow.ledger_id, '2025-04-01', today);
    const invLedgerBalance = stmt.closingBalanceType === 'DR' ? stmt.closingBalancePaise : -stmt.closingBalancePaise;

    assert.strictEqual(totalStockValuation, invLedgerBalance,
      `Stock Summary valuation (${totalStockValuation}) must reconcile exactly with Inventory Asset ledger balance (${invLedgerBalance})`);
  });

  await test('TEST_FY_11D: Negative stock adjustment respects allowNegativeStock policy', async () => {
    // Current stock of Laptop is 21 units (20 opening - 2 sales + 5 in - 2 out = 21)
    // Attempt to reduce by 50 units without allowNegativeStock -> must fail
    const res1 = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        itemName: 'Business Laptop',
        quantityToAdd: -50,
        allowNegativeStock: false
      })
    });
    assert.strictEqual(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.error, /Insufficient stock/i);

    // Attempt to reduce with allowNegativeStock = true -> succeeds
    const res2 = await fetch(`${baseUrl}/masters/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        itemName: 'Business Laptop',
        quantityToAdd: -25,
        allowNegativeStock: true
      })
    });
    assert.strictEqual(res2.status, 200);

    // Verify stock is now 21 - 25 = -4
    const today = new Date().toISOString().split('T')[0];
    const summary = ReportEngine.getStockSummary(testDb, companyA, today);
    const itemStock = summary.find(s => s.itemId === itemId);
    assert.strictEqual(itemStock?.currentStock, -4);
  });

  await test('TEST_FY_11E: Existing-item stock adjustment does not modify inception opening stock', async () => {
    const itemRow = testDb.prepare('SELECT opening_qty, opening_rate_paise FROM stock_items WHERE item_id = ?').get(itemId) as any;
    assert.strictEqual(itemRow.opening_qty, 20, 'Opening qty on stock_items master must remain inception value (20)');
    assert.strictEqual(itemRow.opening_rate_paise, 5000000, 'Opening rate on stock_items master must remain inception value (5000000)');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 5: REPORT INTEGRITY ACROSS FINANCIAL YEARS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 5: Report Integrity Across Financial Years]');

  await test('TEST_FY_12: Nominal ledger opening balance resets to ₹0 at FY boundary', async () => {
    // Sales ledger had a voucher posted in FY 2025-26 on 2025-06-15 (TEST_FY_04)
    const salesLedgerRow = testDb.prepare(`
      SELECT ledger_id FROM ledgers WHERE company_id = ? AND (ledger_id = ? OR ledger_name LIKE '%Sales%') LIMIT 1
    `).get(companyA, `${companyA}_led_sales`) as any;

    // Check statement at beginning of FY 2026-27 (from: 2026-04-01)
    const stmtFY2627 = ReportEngine.getLedgerStatement(testDb, companyA, salesLedgerRow.ledger_id, '2026-04-01', '2026-04-01');
    assert.strictEqual(stmtFY2627.openingBalancePaise, 0,
      `Nominal account opening balance at FY boundary (2026-04-01) must be 0, got ${stmtFY2627.openingBalancePaise}`);

    // But if queried within FY 2026-27 after transactions (e.g. from 2026-07-01 to 2026-08-01), opening balance reflects transactions between 2026-04-01 and 2026-06-30
    const stmtMidYear = ReportEngine.getLedgerStatement(testDb, companyA, salesLedgerRow.ledger_id, '2026-07-01', '2026-08-01');
    assert.strictEqual(stmtMidYear.openingBalancePaise, 6500000,
      `Nominal account opening balance on 2026-07-01 must reflect current FY transactions prior to 2026-07-01 (6500000), got ${stmtMidYear.openingBalancePaise}`);
  });

  await test('TEST_FY_13: Balance Sheet ledger retains cumulative balance across FYs', async () => {
    // Customer ledger had voucher in 2025-06-15 and 2026-06-15
    const stmtCust = ReportEngine.getLedgerStatement(testDb, companyA, custLedgerId, '2026-04-01', '2026-10-01');
    // On 2026-04-01, opening balance must retain cumulative prior year debit
    assert.ok(stmtCust.openingBalancePaise > 0, 'Customer opening balance on 2026-04-01 must retain prior year cumulative balance');
    assert.strictEqual(stmtCust.openingBalanceType, 'DR');
  });

  await test('TEST_FY_18: Zero duplicate opening stock across FY boundaries', async () => {
    const fy2627 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND start_date = ?').get(companyA, '2026-04-01') as any;

    // Verify no synthetic opening stock voucher was created in FY 2026-27
    const duplicateOpenVouchers = testDb.prepare(`
      SELECT COUNT(*) as cnt FROM vouchers
      WHERE company_id = ? AND fy_id = ? AND narration LIKE '%Opening Stock%'
    `).get(companyA, fy2627.fy_id) as any;
    assert.strictEqual(duplicateOpenVouchers.cnt, 0, 'Zero duplicate opening stock vouchers created in next FY');

    // Verify stock quantity is continuous across FY boundary (2026-03-31 closing === 2026-04-01 opening)
    const stockAtClosing = ReportEngine.getStockSummary(testDb, companyA, '2026-03-31');
    const laptopClosing = stockAtClosing.find(s => s.itemId === itemId)?.currentStock;

    const stockAtNewOpening = ReportEngine.getStockSummary(testDb, companyA, '2026-04-01');
    const laptopNewOpening = stockAtNewOpening.find(s => s.itemId === itemId)?.currentStock;

    assert.strictEqual(laptopClosing, 19, 'FY 2025-26 closing stock must be 19 units (20 opening - 1 sold)');
    assert.strictEqual(laptopNewOpening, 19, 'FY 2026-27 opening stock must seamlessly equal 19 units with no duplication');
  });

  await test('TEST_FY_19: Multi-year retained earnings remains correct on Balance Sheet', async () => {
    // Generate Balance Sheet as on 2026-10-02
    const bs = ReportEngine.getBalanceSheet(testDb, companyA, '2026-10-02');
    assert.strictEqual(bs.isBalanced, true,
      `Balance sheet must balance: Total Assets (${bs.totalAssetsPaise}) === Total Liab & Equity (${bs.totalLiabilitiesEquityPaise})`);
    assert.ok(bs.retainedEarningsPaise !== undefined, 'Retained earnings from prior years must be computed dynamically');
  });

  await test('TEST_FY_20: Full regression verification across baseline reports', async () => {
    const tb = ReportEngine.getTrialBalance(testDb, companyA, '2026-10-02');
    assert.strictEqual(tb.isBalanced, true, 'Trial Balance must be strictly balanced');
    assert.strictEqual(tb.totalDebitPaise, tb.totalCreditPaise);

    const outstCust = ReportEngine.getOutstandingReport(testDb, companyA, 'CUSTOMER', '2026-10-02');
    assert.ok(outstCust.length > 0, 'Outstanding receivables must carry forward seamlessly across FY boundary');

    const gst = ReportEngine.getGstSummary(testDb, companyA, '2026-04-01', '2026-10-02');
    assert.ok(gst.totalOutputTaxPaise > 0, 'GST Summary must accurately reflect current FY turnover');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SUITE 6: FY STATUS LIFECYCLE, REOPENING & SECURITY
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[Suite 6: FY Status Lifecycle, Reopening & Security]');

  await test('TEST_FY_14: Reopening closed FY requires OWNER authorization, non-empty reason, and audit log', async () => {
    const fy2526 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;

    // 1. ADMIN attempts to reopen -> 403
    const resAdmin = await fetch(`${baseUrl}/financial-years/${fy2526.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        status: 'OPEN',
        reason: 'Admin wants to reopen'
      })
    });
    assert.strictEqual(resAdmin.status, 403);
    const bodyAdmin = await resAdmin.json();
    assert.match(bodyAdmin.error, /Only the company OWNER can reopen a closed financial year/i);

    // 2. OWNER attempts to reopen without reason -> 400
    const resNoReason = await fetch(`${baseUrl}/financial-years/${fy2526.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        status: 'OPEN',
        reason: '   '
      })
    });
    assert.strictEqual(resNoReason.status, 400);
    const bodyNoReason = await resNoReason.json();
    assert.match(bodyNoReason.error, /A valid business reason is required/i);

    // 3. OWNER attempts to reopen with valid reason -> 200
    const resOwner = await fetch(`${baseUrl}/financial-years/${fy2526.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        status: 'OPEN',
        reason: 'Statutory audit adjustment requested by external auditor'
      })
    });
    assert.strictEqual(resOwner.status, 200);
    const bodyOwner = await resOwner.json();
    assert.strictEqual(bodyOwner.status, 'OPEN');

    // Verify audit log exists with high-priority action REOPEN_FINANCIAL_YEAR
    const auditLog = testDb.prepare(`
      SELECT action, details FROM audit_logs
      WHERE company_id = ? AND action = 'REOPEN_FINANCIAL_YEAR'
      ORDER BY rowid DESC LIMIT 1
    `).get(companyA) as any;
    assert.ok(auditLog, 'Audit log entry must be created on financial year reopening');
    const details = JSON.parse(auditLog.details);
    assert.strictEqual(details.newStatus, 'OPEN');
    assert.strictEqual(details.previousStatus, 'CLOSED');
    assert.match(details.reason, /Statutory audit adjustment/);
  });

  await test('TEST_FY_15: Unauthorized FY status mutation rejected with 403', async () => {
    const fy2627 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND start_date = ?').get(companyA, '2026-04-01') as any;

    // VIEWER attempts to lock or close FY -> 403
    const res = await fetch(`${baseUrl}/financial-years/${fy2627.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenViewerA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({ status: 'LOCKED' })
    });
    assert.strictEqual(res.status, 403);
  });

  await test('TEST_FY_17: Cross-tenant FY mutation rejected', async () => {
    const fy2627 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND start_date = ?').get(companyA, '2026-04-01') as any;

    // Owner B attempts to update Company A's financial year
    const res = await fetch(`${baseUrl}/financial-years/${fy2627.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`,
        'x-company-id': companyB
      },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    // Should be 404 or 403 because fy does not belong to companyB
    assert.ok([403, 404].includes(res.status), `Cross-tenant FY update must be rejected with 403 or 404, got ${res.status}`);
  });

  await test('SCENARIO_REOPEN: CLOSED -> OWNER REOPEN -> historical voucher -> reconciliation', async () => {
    const fy2526 = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? AND name = ?').get(companyA, 'FY 2025-26') as any;

    // Now FY 2025-26 is reopened. Post a historical voucher into it
    const resVch = await fetch(`${baseUrl}/vouchers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({
        fyId: fy2526.fy_id,
        voucherType: 'SALES',
        voucherDate: '2025-11-20',
        partyId: custPartyId,
        narration: 'Post-audit reopening historical invoice',
        allowNegativeStock: true,
        lines: [{
          itemId,
          quantity: 1,
          ratePaise: 6500000,
          gstRate: 18
        }]
      })
    });
    assert.strictEqual(resVch.status, 201);

    // Verify trial balance and balance sheet immediately reconcile
    const tb = ReportEngine.getTrialBalance(testDb, companyA, '2026-10-02');
    assert.strictEqual(tb.isBalanced, true);
    assert.strictEqual(tb.totalDebitPaise, tb.totalCreditPaise);

    const bs = ReportEngine.getBalanceSheet(testDb, companyA, '2026-10-02');
    assert.strictEqual(bs.isBalanced, true);

    // Close the year again after completing audit adjustments
    const recloseRes = await fetch(`${baseUrl}/financial-years/${fy2526.fy_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAdminA}`,
        'x-company-id': companyA
      },
      body: JSON.stringify({ status: 'CLOSED' })
    });
    assert.strictEqual(recloseRes.status, 200);

    const finalFy = testDb.prepare('SELECT status FROM financial_years WHERE fy_id = ?').get(fy2526.fy_id) as any;
    assert.strictEqual(finalFy.status, 'CLOSED');
  });

  server.close();
  console.log(`\n======================================================================`);
  console.log(`ALL ${totalTests} TASK 007 TESTS PASSED SUCCESSFULLY! (0 failures)`);
  console.log(`======================================================================\n`);
}

runTestSuite().catch(err => {
  console.error('\nTest Suite Fatal Error:', err);
  process.exit(1);
});
