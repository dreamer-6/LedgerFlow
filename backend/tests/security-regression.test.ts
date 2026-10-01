/**
 * LedgerFlow Permanent Security & Multi-Tenant Isolation Regression Test Suite
 * TASK 001 — Master Verification
 *
 * Covers:
 *   1. Authentication (missing, malformed, expired, forged, deactivated, deleted user tokens)
 *   2. Tenant Isolation (cross-tenant reads, writes, deletes, ID traversal, company context switching)
 *   3. Accounting Domain Boundary (posting engine cross-company checks: party, item, godown, FY, ledger)
 *   4. Role-Based Access Control (VIEWER, ACCOUNTANT, ADMIN, OWNER enforcement)
 *   5. Voucher Immutability (DELETE 405, edit amendment linkage with original preserved as CANCELLED)
 *   6. SSO Hardening (501 Not Implemented, no token issued)
 *   7. Utilities (Backup & Reset-data protection, scoping, password confirmation)
 *   8. Bootstrap Hardening (no default admin/admin123)
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApiRouter } from '../src/api/routes.js';
import { initializeBusiness, seedInitialData } from '../src/database/seed.js';
import { jwtSecret } from '../src/middleware/security.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';

console.log('======================================================================');
console.log('LEDGERFLOW TASK 001 — SECURITY & MULTI-TENANT REGRESSION TEST SUITE');
console.log('======================================================================\n');

// ── Setup In-Memory Database ────────────────────────────────────────────────
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
testDb.exec(schemaSql);

// Safe migrations
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
    ('usr_owner_a', 'owner_a', 'owner_a@company-a.com', ?, 'Owner A', 'ADMIN', 1),
    ('usr_admin_a', 'admin_a', 'admin_a@company-a.com', ?, 'Admin A', 'ADMIN', 1),
    ('usr_acct_a', 'acct_a', 'acct_a@company-a.com', ?, 'Accountant A', 'ACCOUNTANT', 1),
    ('usr_view_a', 'view_a', 'view_a@company-a.com', ?, 'Viewer A', 'AUDITOR', 1),
    ('usr_owner_b', 'owner_b', 'owner_b@company-b.com', ?, 'Owner B', 'ADMIN', 1),
    ('usr_deactivated', 'deactivated_user', 'deact@company-a.com', ?, 'Deactivated User', 'AUDITOR', 0)
`).run(passwordHash, passwordHash, passwordHash, passwordHash, passwordHash, passwordHash);

// Companies
const companyA = 'comp_alpha';
const companyB = 'comp_beta';

initializeBusiness(testDb, {
  companyId: companyA,
  companyName: 'Alpha Corporation',
  gstin: '33AAAAA1111A1Z1'
});

initializeBusiness(testDb, {
  companyId: companyB,
  companyName: 'Beta Enterprises',
  gstin: '29BBBBB2222B1Z2'
});

// Memberships
testDb.prepare(`
  INSERT INTO user_businesses (user_id, company_id, role)
  VALUES
    ('usr_owner_a', 'comp_alpha', 'OWNER'),
    ('usr_admin_a', 'comp_alpha', 'ADMIN'),
    ('usr_acct_a', 'comp_alpha', 'ACCOUNTANT'),
    ('usr_view_a', 'comp_alpha', 'VIEWER'),
    ('usr_owner_b', 'comp_beta', 'OWNER'),
    ('usr_deactivated', 'comp_alpha', 'VIEWER')
`).run();

// Fixtures in Company A
testDb.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
  VALUES ('led_cust_a', 'comp_alpha', 'comp_alpha_grp_debtors', 'Customer Alpha', 0)
`).run();
testDb.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
  VALUES ('party_cust_a', 'comp_alpha', 'led_cust_a', 'Customer Alpha', 'CUSTOMER', '33AAACA1111A1Z1')
`).run();
testDb.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_cust_a', 'party_cust_a', '100 Alpha Road', 'Chennai', 'Tamil Nadu', '33', '600001')
`).run();
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_alpha_01', 'comp_alpha', 'Alpha Hardware 100', '8471', 'comp_alpha_unit_nos', 18, 100000, 150000, 20)
`).run();
testDb.prepare(`
  INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
  VALUES ('godown_alpha_main', 'comp_alpha', 'Alpha Warehouse', 1)
`).run();

// Fixtures in Company B
testDb.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
  VALUES ('led_cust_b', 'comp_beta', 'comp_beta_grp_debtors', 'Customer Beta', 0)
`).run();
testDb.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, gstin)
  VALUES ('party_cust_b', 'comp_beta', 'led_cust_b', 'Customer Beta', 'CUSTOMER', '29BBBCA2222B1Z2')
`).run();
testDb.prepare(`
  INSERT INTO party_addresses (address_id, party_id, address_line1, city, state, state_code, pincode)
  VALUES ('addr_cust_b', 'party_cust_b', '200 Beta Lane', 'Bengaluru', 'Karnataka', '29', '560001')
`).run();
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_beta_01', 'comp_beta', 'Beta Widget 500', '8471', 'comp_beta_unit_nos', 18, 200000, 250000, 15)
`).run();
testDb.prepare(`
  INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
  VALUES ('godown_beta_main', 'comp_beta', 'Beta Warehouse', 1)
`).run();

// Helper: Token Generator
function makeToken(payload: { userId: string; username: string; role?: string; email?: string }, secret = jwtSecret(), expiresIn = '7d') {
  return jwt.sign(
    {
      userId: payload.userId,
      username: payload.username,
      role: payload.role || 'USER',
      name: payload.username,
      email: payload.email || `${payload.username}@test.com`
    },
    secret,
    { expiresIn: expiresIn as any }
  );
}

const tokenOwnerA = makeToken({ userId: 'usr_owner_a', username: 'owner_a' });
const tokenAdminA = makeToken({ userId: 'usr_admin_a', username: 'admin_a' });
const tokenAcctA = makeToken({ userId: 'usr_acct_a', username: 'acct_a' });
const tokenViewA = makeToken({ userId: 'usr_view_a', username: 'view_a' });
const tokenOwnerB = makeToken({ userId: 'usr_owner_b', username: 'owner_b' });
const tokenDeactivated = makeToken({ userId: 'usr_deactivated', username: 'deactivated_user' });
const tokenNonExistent = makeToken({ userId: 'usr_ghost_999', username: 'ghost_user' });
const tokenForgedSecret = makeToken({ userId: 'usr_owner_a', username: 'owner_a' }, 'wrong_secret_key_123');
const tokenExpired = makeToken({ userId: 'usr_owner_a', username: 'owner_a' }, jwtSecret(), '-1s');

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
      throw err;
    }
  }

  try {
    // ========================================================================
    // SUITE 1: AUTHENTICATION
    // ========================================================================
    console.log('[Suite 1: Authentication & Token Verification]');

    await test('1.1: Missing token returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /Unauthorized/);
    });

    await test('1.2: Malformed Bearer header returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: 'NotABearerToken' }
      });
      assert.strictEqual(res.status, 401);
    });

    await test('1.3: Expired token returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: `Bearer ${tokenExpired}` }
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /expired/i);
    });

    await test('1.4: Token signed with wrong secret returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: `Bearer ${tokenForgedSecret}` }
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /Invalid token/i);
    });

    await test('1.5: Deactivated user token (is_active = 0) returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: `Bearer ${tokenDeactivated}` }
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /deactivated/i);
    });

    await test('1.6: Non-existent / deleted user token returns 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: `Bearer ${tokenNonExistent}` }
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /not found/i);
    });

    // ========================================================================
    // SUITE 2: TENANT ISOLATION & RESOURCE OWNERSHIP
    // ========================================================================
    console.log('\n[Suite 2: Multi-Tenant Isolation & Resource Ownership]');

    await test('2.1: User A requesting Company B context returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'x-company-id': 'comp_beta'
        }
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Forbidden/i);
    });

    await test('2.2: User A accessing Company B via ?companyId query returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/companies/current?companyId=comp_beta`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('2.3: User A auto-resolves Company A when single membership', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.company.company_id, 'comp_alpha');
    });

    await test('2.4: User A attempting to view Company B party by ID returns 404', async () => {
      const res = await fetch(`${baseUrl}/masters/parties/party_cust_b`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      // Route is company-scoped, so requesting a non-existent or foreign ID returns 404
      assert.strictEqual(res.status, 404);
    });

    await test('2.5: User A attempting to edit Company B party returns 404', async () => {
      const res = await fetch(`${baseUrl}/masters/parties/party_cust_b`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ partyName: 'Tampered Party' })
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.6: User A attempting to delete Company B party returns 404', async () => {
      const res = await fetch(`${baseUrl}/masters/parties/party_cust_b`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.7: User A attempting to edit Company B stock item returns 404', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_beta_01`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemName: 'Tampered Item' })
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.8: User A attempting to view Company B ledger report returns 404', async () => {
      const res = await fetch(`${baseUrl}/reports/ledger/led_cust_b`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      assert.strictEqual(res.status, 404);
    });

    // Post a voucher in Company B first for cross-company tests
    const vchB = PostingEngine.postVoucher(testDb, {
      companyId: companyB,
      fyId: 'comp_beta_fy_2026_27',
      voucherType: 'SALES',
      voucherDate: '2026-05-10',
      partyId: 'party_cust_b',
      createdBy: 'usr_owner_b',
      lines: [
        {
          itemId: 'item_beta_01',
          godownId: 'godown_beta_main',
          quantity: 1,
          ratePaise: 250000,
          gstRate: 18
        }
      ]
    });

    await test('2.9: User A attempting to view Company B voucher by ID returns 404', async () => {
      const res = await fetch(`${baseUrl}/vouchers/${vchB.voucherId}`, {
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.10: User A attempting to cancel Company B voucher returns 404', async () => {
      const res = await fetch(`${baseUrl}/vouchers/${vchB.voucherId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 404);
    });

    // ========================================================================
    // SUITE 3: POSTING ENGINE CROSS-COMPANY BOUNDARY VALIDATION
    // ========================================================================
    console.log('\n[Suite 3: Posting Engine Accounting Domain Boundary]');

    await test('3.1: Company A voucher referencing Company B partyId fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_b', // Company B Party!
          lines: [
            {
              itemId: 'item_alpha_01',
              godownId: 'godown_alpha_main',
              quantity: 1,
              ratePaise: 150000,
              gstRate: 18
            }
          ]
        });
      }, /Security violation: Party.*does not belong to company/);
    });

    await test('3.2: Company A voucher referencing Company B stock item fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [
            {
              itemId: 'item_beta_01', // Company B Stock Item!
              godownId: 'godown_alpha_main',
              quantity: 1,
              ratePaise: 150000,
              gstRate: 18
            }
          ]
        });
      }, /Security violation: Stock item.*does not belong to company/);
    });

    await test('3.3: Company A voucher referencing Company B financial year fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_beta_fy_2026_27', // Company B FY!
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [
            {
              itemId: 'item_alpha_01',
              godownId: 'godown_alpha_main',
              quantity: 1,
              ratePaise: 150000,
              gstRate: 18
            }
          ]
        });
      }, /Financial Year.*not found for this company/);
    });

    await test('3.4: Company A voucher referencing Company B godown fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [
            {
              itemId: 'item_alpha_01',
              godownId: 'godown_beta_main', // Company B Godown!
              quantity: 1,
              ratePaise: 150000,
              gstRate: 18
            }
          ]
        });
      }, /Security violation: Godown.*does not belong to company/);
    });

    await test('3.5: Company A voucher referencing Company B custom ledger fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'JOURNAL',
          voucherDate: '2026-05-10',
          lines: [],
          customLedgerLines: [
            { ledgerId: 'led_cust_a', debitPaise: 10000, creditPaise: 0 },
            { ledgerId: 'led_cust_b', debitPaise: 0, creditPaise: 10000 } // Company B Ledger!
          ]
        });
      }, /Security violation: Ledger.*does not belong to company/);
    });

    await test('3.6: Company A voucher line referencing Company B line.ledgerId fails strictly', async () => {
      assert.throws(() => {
        PostingEngine.postVoucher(testDb, {
          companyId: companyA,
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [
            {
              itemId: 'item_alpha_01',
              ledgerId: 'led_cust_b', // Company B line ledger!
              godownId: 'godown_alpha_main',
              quantity: 1,
              ratePaise: 150000,
              gstRate: 18
            }
          ]
        });
      }, /Security violation: Ledger.*does not belong to company/);
    });

    // ========================================================================
    // SUITE 4: ROLE-BASED ACCESS CONTROL (RBAC)
    // ========================================================================
    console.log('\n[Suite 4: Role-Based Access Control (RBAC)]');

    await test('4.1: VIEWER cannot post vouchers (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/vouchers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenViewA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [{ itemId: 'item_alpha_01', quantity: 1, ratePaise: 150000 }]
        })
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.match(json.error, /Forbidden/i);
    });

    await test('4.2: VIEWER cannot create master party (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/masters/parties`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenViewA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ partyName: 'Unauthorized Party', partyType: 'CUSTOMER' })
      });
      assert.strictEqual(res.status, 403);
    });

    await test('4.3: VIEWER cannot view audit logs (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/utilities/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenViewA}` }
      });
      assert.strictEqual(res.status, 403);
    });

    let postedVchIdA = '';
    await test('4.4: ACCOUNTANT can post vouchers (201 Created)', async () => {
      const res = await fetch(`${baseUrl}/vouchers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAcctA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voucherType: 'SALES',
          voucherDate: '2026-05-10',
          partyId: 'party_cust_a',
          lines: [{ itemId: 'item_alpha_01', quantity: 1, ratePaise: 150000, godownId: 'godown_alpha_main' }]
        })
      });
      assert.strictEqual(res.status, 201);
      const json = await res.json();
      postedVchIdA = json.voucherId;
      assert.ok(postedVchIdA);
    });

    await test('4.5: ACCOUNTANT cannot cancel vouchers (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/vouchers/${postedVchIdA}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAcctA}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('4.6: ACCOUNTANT cannot access backup (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/utilities/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAcctA}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('4.7: ADMIN can view audit logs (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/utilities/audit-logs`, {
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 200);
      const logs = await res.json();
      assert.ok(Array.isArray(logs));
      // All logs must belong to comp_alpha
      for (const log of logs) {
        assert.strictEqual(log.company_id, companyA);
      }
    });

    await test('4.8: ADMIN cannot access backup (requires OWNER) (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/utilities/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 403);
    });

    await test('4.9: OWNER can access backup (200 OK)', async () => {
      const res = await fetch(`${baseUrl}/utilities/backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOwnerA}` }
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    // ========================================================================
    // SUITE 5: VOUCHER IMMUTABILITY & AUDITABILITY
    // ========================================================================
    console.log('\n[Suite 5: Voucher Immutability & Audit Trail]');

    await test('5.1: Direct DELETE on posted voucher returns 405 Method Not Allowed', async () => {
      const res = await fetch(`${baseUrl}/vouchers/${postedVchIdA}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokenAdminA}` }
      });
      assert.strictEqual(res.status, 405);
      const json = await res.json();
      assert.match(json.error, /Direct voucher deletion is not permitted/i);

      // Verify voucher still exists
      const check = testDb.prepare('SELECT status FROM vouchers WHERE voucher_id = ?').get(postedVchIdA) as any;
      assert.ok(check);
      assert.strictEqual(check.status, 'POSTED');
    });

    await test('5.2: PUT edit on posted voucher preserves original as CANCELLED and links replacement', async () => {
      const res = await fetch(`${baseUrl}/vouchers/${postedVchIdA}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenAdminA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fyId: 'comp_alpha_fy_2026_27',
          voucherType: 'SALES',
          voucherDate: '2026-05-11',
          partyId: 'party_cust_a',
          lines: [{ itemId: 'item_alpha_01', quantity: 2, ratePaise: 150000, godownId: 'godown_alpha_main' }]
        })
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.amendedVoucherId, postedVchIdA);
      const newVchId = json.voucherId;
      assert.notStrictEqual(newVchId, postedVchIdA);

      // Verify original voucher is preserved in CANCELLED status
      const original = testDb.prepare('SELECT status, cancelled_by FROM vouchers WHERE voucher_id = ?').get(postedVchIdA) as any;
      assert.strictEqual(original.status, 'CANCELLED');
      assert.strictEqual(original.cancelled_by, 'usr_admin_a');

      // Verify replacement voucher has reference link
      const replacement = testDb.prepare('SELECT reference_number, created_by FROM vouchers WHERE voucher_id = ?').get(newVchId) as any;
      assert.match(replacement.reference_number, /AMEND-/);
      assert.strictEqual(replacement.created_by, 'usr_admin_a');
    });

    // ========================================================================
    // SUITE 6: SSO HARDENING
    // ========================================================================
    console.log('\n[Suite 6: SSO Hardening]');

    await test('6.1: POST /auth/sso returns 501 Not Implemented immediately', async () => {
      const res = await fetch(`${baseUrl}/auth/sso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'attacker@evil.com', name: 'Fake Admin' })
      });
      assert.strictEqual(res.status, 501);
      const json = await res.json();
      assert.match(json.error, /not implemented/i);

      // Verify no user was created
      const user = testDb.prepare('SELECT user_id FROM users WHERE email = ?').get('attacker@evil.com');
      assert.strictEqual(user, undefined);
    });

    // ========================================================================
    // SUITE 7: RESET-DATA PROTECTION
    // ========================================================================
    console.log('\n[Suite 7: Data Reset Protection]');

    await test('7.1: Reset-data when ALLOW_DATA_RESET is unset returns 404 Not Found', async () => {
      delete process.env.ALLOW_DATA_RESET;
      const res = await fetch(`${baseUrl}/utilities/reset-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: 'Pass123!' })
      });
      assert.strictEqual(res.status, 404);
    });

    await test('7.2: Reset-data when ALLOW_DATA_RESET=true but non-owner returns 403 Forbidden', async () => {
      process.env.ALLOW_DATA_RESET = 'true';
      const res = await fetch(`${baseUrl}/utilities/reset-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenAdminA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: 'Pass123!' })
      });
      assert.strictEqual(res.status, 403);
    });

    await test('7.3: Reset-data with wrong password returns 401 Unauthorized', async () => {
      process.env.ALLOW_DATA_RESET = 'true';
      const res = await fetch(`${baseUrl}/utilities/reset-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: 'WrongPassword!' })
      });
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.match(json.error, /Incorrect password/i);
    });

    await test('7.4: Reset-data with valid Owner password wipes ONLY Company A, Company B intact', async () => {
      process.env.ALLOW_DATA_RESET = 'true';
      const res = await fetch(`${baseUrl}/utilities/reset-data`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenOwnerA}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: 'Pass123!' })
      });
      assert.strictEqual(res.status, 200);

      // Verify Company A vouchers wiped
      const vchCountA = (testDb.prepare('SELECT COUNT(*) as c FROM vouchers WHERE company_id = ?').get(companyA) as any).c;
      assert.strictEqual(vchCountA, 0);

      // Verify Company B vouchers INTACT
      const vchCountB = (testDb.prepare('SELECT COUNT(*) as c FROM vouchers WHERE company_id = ?').get(companyB) as any).c;
      assert.ok(vchCountB > 0, 'Company B vouchers must remain completely intact');

      delete process.env.ALLOW_DATA_RESET;
    });

    // ========================================================================
    // SUITE 8: ADMIN BOOTSTRAP HARDENING
    // ========================================================================
    console.log('\n[Suite 8: Admin Bootstrap Security]');

    await test('8.1: Normal boot does not seed default admin user', async () => {
      const freshDb = new DatabaseSync(':memory:');
      freshDb.exec(schemaSql);
      delete process.env.SEED_ADMIN;
      delete process.env.SEED_ADMIN_PASSWORD;

      const seededId = seedInitialData(freshDb);
      assert.strictEqual(seededId, null);
      const admin = freshDb.prepare("SELECT * FROM users WHERE username = 'admin'").get();
      assert.strictEqual(admin, undefined);
    });

    await test('8.2: SEED_ADMIN=true without password refuses to create admin', async () => {
      const freshDb = new DatabaseSync(':memory:');
      freshDb.exec(schemaSql);
      process.env.SEED_ADMIN = 'true';
      delete process.env.SEED_ADMIN_PASSWORD;

      const seededId = seedInitialData(freshDb);
      assert.strictEqual(seededId, null);
      const admin = freshDb.prepare("SELECT * FROM users WHERE username = 'admin'").get();
      assert.strictEqual(admin, undefined);

      delete process.env.SEED_ADMIN;
    });

    await test('8.3: SEED_ADMIN=true with password and empty DB successfully seeds admin once', async () => {
      const freshDb = new DatabaseSync(':memory:');
      freshDb.exec(schemaSql);
      process.env.SEED_ADMIN = 'true';
      process.env.SEED_ADMIN_PASSWORD = 'SecureBootstrapPassword123!';

      const seededId = seedInitialData(freshDb);
      assert.ok(seededId);
      const admin = freshDb.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      assert.ok(admin);
      assert.strictEqual(bcrypt.compareSync('SecureBootstrapPassword123!', admin.password_hash), true);

      // Second run must NOT overwrite or recreate
      process.env.SEED_ADMIN_PASSWORD = 'AnotherPassword!';
      const secondRunId = seedInitialData(freshDb);
      assert.strictEqual(secondRunId, null);
      const checkAdmin = freshDb.prepare("SELECT * FROM users WHERE username = 'admin'").get() as any;
      // Original password must NOT be changed
      assert.strictEqual(bcrypt.compareSync('SecureBootstrapPassword123!', checkAdmin.password_hash), true);

      delete process.env.SEED_ADMIN;
      delete process.env.SEED_ADMIN_PASSWORD;
    });

    console.log('\n======================================================================');
    console.log(`ALL ${passedTests} / ${totalTests} SECURITY REGRESSION TESTS PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runTestSuite().catch(err => {
  console.error('\nSECURITY TEST SUITE FAILED:');
  console.error(err);
  process.exit(1);
});
