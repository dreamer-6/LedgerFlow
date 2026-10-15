/**
 * LedgerFlow Production Security Hardening Test Suite — SEC-010
 *
 * Automated verification for:
 *   1. Login Rate Limiting (thresholds, 429 status, retry headers, success reset)
 *   2. Production JWT Configuration (missing, empty, weak, strong secrets)
 *   3. Sensitive Data Sanitization (vault_password_hash scrubbing)
 *   4. Authentication, RBAC, and Tenant Isolation invariants
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import { createApiRouter } from '../src/api/routes.js';
import { initializeBusiness } from '../src/database/seed.js';
import { jwtSecret, _resetJwtSecretForTesting } from '../src/middleware/security.js';
import { resetRateLimits } from '../src/middleware/rateLimiter.js';

console.log('======================================================================');
console.log('LEDGERFLOW SEC-010 — PRODUCTION SECURITY HARDENING TEST SUITE');
console.log('======================================================================\n');

// ── In-Memory Database Setup ──────────────────────────────────────────────
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
try { testDb.exec('ALTER TABLE companies ADD COLUMN mailing_name TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN vault_password_hash TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN logo_base64 TEXT;'); } catch {}
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

// Seed User & Company
const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('CorrectPass123!', salt);
const vaultHash = bcrypt.hashSync('VaultPassSecret999!', salt);

testDb.prepare(`
  INSERT INTO users (user_id, username, email, password_hash, full_name, role, is_active)
  VALUES ('usr_sec_01', 'sec_user', 'sec@ledgerflow.local', ?, 'Security Test User', 'ADMIN', 1)
`).run(passwordHash);

const companyId = 'comp_sec_test';
initializeBusiness(testDb, {
  companyId,
  companyName: 'Secure Enterprise Ltd',
  legalName: 'Secure Enterprise Private Limited',
  gstin: '33AABCS1234F1Z1',
  ownerUserId: 'usr_sec_01'
});

// Update company with vault password hash
testDb.prepare('UPDATE companies SET vault_password_hash = ? WHERE company_id = ?').run(vaultHash, companyId);

// ── Mount Test App ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api', createApiRouter(testDb));

async function runSec010Tests() {
  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  let totalTests = 0;
  let passedTests = 0;

  function test(name: string, fn: () => Promise<void> | void) {
    totalTests++;
    return Promise.resolve()
      .then(fn)
      .then(() => {
        passedTests++;
        console.log(`  ✓ ${name}`);
      })
      .catch((err) => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        throw err;
      });
  }

  try {
    // =========================================================================
    // SECTION 1: JWT Secret Configuration in Production vs Development
    // =========================================================================
    console.log('[Suite 1: JWT Secret Production Validation]');

    await test('1.1: Fails safely when JWT_SECRET is missing in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();

        assert.throws(
          () => jwtSecret(),
          /FATAL: JWT_SECRET environment variable is required in production/
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    await test('1.2: Fails safely when JWT_SECRET is empty string in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = '   ';
        _resetJwtSecretForTesting();

        assert.throws(
          () => jwtSecret(),
          /FATAL: JWT_SECRET environment variable is required in production/
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    await test('1.3: Fails safely when JWT_SECRET is shorter than 32 characters in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'short_insecure_secret_key'; // 25 chars
        _resetJwtSecretForTesting();

        assert.throws(
          () => jwtSecret(),
          /must be at least 32 characters long/
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    await test('1.4: Fails safely when JWT_SECRET is a known weak placeholder in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = '12345678901234567890123456789012'; // 32 chars but trivial pattern
        _resetJwtSecretForTesting();

        assert.throws(
          () => jwtSecret(),
          /cannot be a known weak or placeholder default/
        );
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    await test('1.5: Accepts valid 32+ character high-entropy secret in production', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      const validProdSecret = 'c7a8b9e0f1d2c3b4a596877869504132435465768798091a2b3c4d5e6f7a8b9c';
      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = validProdSecret;
        _resetJwtSecretForTesting();

        const resolved = jwtSecret();
        assert.strictEqual(resolved, validProdSecret);
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    await test('1.6: In development without JWT_SECRET, generates secure random 64-hex secret', () => {
      const origEnv = process.env.NODE_ENV;
      const origSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = 'development';
        delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();

        const devSec = jwtSecret();
        assert(devSec.startsWith('dev_'), 'Dev secret should have dev_ prefix');
        assert(devSec.length >= 68, 'Dev secret should contain 64 hex random chars');
      } finally {
        process.env.NODE_ENV = origEnv;
        if (origSecret !== undefined) process.env.JWT_SECRET = origSecret;
        else delete process.env.JWT_SECRET;
        _resetJwtSecretForTesting();
      }
    });

    // =========================================================================
    // SECTION 2: Login Rate Limiting & Brute-Force Protection
    // =========================================================================
    console.log('\n[Suite 2: Login Rate Limiting & Throttling]');

    await test('2.1: Single invalid login attempt returns 401 with rate-limit headers', async () => {
      resetRateLimits();

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'WrongPassword1' })
      });

      assert.strictEqual(res.status, 401);
      assert(res.headers.has('x-ratelimit-limit'), 'Must have X-RateLimit-Limit');
      assert(res.headers.has('x-ratelimit-remaining'), 'Must have X-RateLimit-Remaining');
    });

    await test('2.2: Exceeding 5 failed login attempts triggers HTTP 429 Too Many Requests', async () => {
      resetRateLimits();

      // Send 4 more failed attempts (5 total)
      for (let i = 0; i < 4; i++) {
        await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'sec@ledgerflow.local', password: `WrongPassword_${i}` })
        });
      }

      // 5th failed attempt triggers failure threshold
      const fifthRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'WrongPassword_5' })
      });
      assert.strictEqual(fifthRes.status, 401);

      // 6th attempt is blocked with 429
      const blockedRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'WrongPassword_6' })
      });

      assert.strictEqual(blockedRes.status, 429, 'Excessive attempts must be blocked with 429');
      assert(blockedRes.headers.has('retry-after'), 'Must include Retry-After header');
      assert.strictEqual(blockedRes.headers.get('x-ratelimit-remaining'), '0');

      const body = await blockedRes.json();
      assert(body.error.includes('Too many failed login attempts'), 'Error should explain lockout');
    });

    await test('2.3: Successful login resets failed attempt counter for legitimate user', async () => {
      resetRateLimits();

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'TypoPassword' })
        });
      }

      // Now enter correct password
      const goodRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'CorrectPass123!' })
      });

      assert.strictEqual(goodRes.status, 200, 'Correct password should succeed');
      const goodData = await goodRes.json();
      assert(goodData.token, 'Should receive token');

      // Now user makes 1 more failed attempt — they should NOT be blocked because counter was cleared
      const afterRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'AnotherTypo' })
      });

      assert.strictEqual(afterRes.status, 401, 'Should return 401, not 429 lockout');
    });

    // =========================================================================
    // SECTION 3: Information Disclosure & Sensitive Data Sanitization
    // =========================================================================
    console.log('\n[Suite 3: Information Disclosure & Vault Password Sanitization]');

    await test('3.1: Login response does not expose vault_password_hash in company data', async () => {
      resetRateLimits();

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'CorrectPass123!' })
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      for (const biz of data.businesses) {
        assert.strictEqual(biz.vault_password_hash, undefined, 'vault_password_hash must not be present in business list');
      }
    });

    await test('3.2: GET /companies/current scrubs vault_password_hash from response', async () => {
      // First get token
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'CorrectPass123!' })
      });
      const { token } = await loginRes.json();

      const compRes = await fetch(`${baseUrl}/companies/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': companyId
        }
      });

      assert.strictEqual(compRes.status, 200);
      const compData = await compRes.json();
      assert(compData.company, 'Company data should be returned');
      assert.strictEqual(
        compData.company.vault_password_hash,
        undefined,
        'vault_password_hash must be completely stripped from company info'
      );
    });

    await test('3.3: GET /businesses scrubs vault_password_hash from response', async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'CorrectPass123!' })
      });
      const { token } = await loginRes.json();

      const bizRes = await fetch(`${baseUrl}/businesses`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      assert.strictEqual(bizRes.status, 200);
      const bizList = await bizRes.json();
      assert(bizList.length > 0);
      for (const b of bizList) {
        assert.strictEqual(b.vault_password_hash, undefined, 'vault_password_hash must be stripped');
      }
    });

    // =========================================================================
    // SECTION 4: Protected Route Authorization & Tenant Boundary Enforcement
    // =========================================================================
    console.log('\n[Suite 4: Protected Routes & Multi-Tenant Authorization]');

    await test('4.1: Protected route rejects missing token with 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`);
      assert.strictEqual(res.status, 401);
    });

    await test('4.2: Protected route rejects malformed token with 401', async () => {
      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: { Authorization: 'Bearer this_is_a_completely_garbage_token' }
      });
      assert.strictEqual(res.status, 401);
    });

    await test('4.3: Cross-tenant access attempt to unassigned company returns 403 Forbidden', async () => {
      const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sec@ledgerflow.local', password: 'CorrectPass123!' })
      });
      const { token } = await loginRes.json();

      const res = await fetch(`${baseUrl}/companies/current`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-company-id': 'comp_non_existent_or_other_tenant'
        }
      });
      assert.strictEqual(res.status, 403);
    });

    console.log('\n======================================================================');
    console.log(`ALL ${passedTests} / ${totalTests} SEC-010 HARDENING TESTS PASSED (100% GREEN)`);
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runSec010Tests().catch((err) => {
  console.error('[TEST SUITE FAILED]', err);
  process.exit(1);
});
