/**
 * LedgerFlow UI-023: Stock Balance API, Multi-Godown, Service Detection & Tenant Isolation Test Suite
 */

import assert from 'node:assert';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApiRouter } from '../src/api/routes.js';
import { initializeBusiness } from '../src/database/seed.js';
import { jwtSecret } from '../src/middleware/security.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { InventoryEngine } from '../src/domain/inventory/valuation.js';

console.log('======================================================================');
console.log('LEDGERFLOW UI-023 — STOCK BALANCE, GODOWNS & MULTI-TENANT TEST SUITE');
console.log('======================================================================\n');

// ── Setup Test Database ──────────────────────────────────────────────────────
const testDb = new DatabaseSync(':memory:');
testDb.exec('PRAGMA foreign_keys = ON;');
const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
testDb.exec(schemaSql);

// Migrations
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN reference_date DATE;'); } catch {}
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN payment_mode TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE vouchers ADD COLUMN terms_conditions TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE voucher_lines ADD COLUMN description TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE parties ADD COLUMN bank_name TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE users ADD COLUMN email TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE companies ADD COLUMN owner_user_id TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE stock_items ADD COLUMN serial_numbers TEXT;'); } catch {}
try { testDb.exec('ALTER TABLE stock_items ADD COLUMN has_serial_no INTEGER DEFAULT 0;'); } catch {}

const salt = bcrypt.genSaltSync(10);
const passwordHash = bcrypt.hashSync('Pass123!', salt);

// Users
testDb.prepare(`
  INSERT INTO users (user_id, username, email, password_hash, full_name, role, is_active)
  VALUES
    ('usr_user_a', 'user_a', 'user_a@company-a.com', ?, 'User A', 'ADMIN', 1),
    ('usr_user_b', 'user_b', 'user_b@company-b.com', ?, 'User B', 'ADMIN', 1)
`).run(passwordHash, passwordHash);

// Companies
const companyA = 'comp_alpha_023';
const companyB = 'comp_beta_023';

initializeBusiness(testDb, {
  companyId: companyA,
  companyName: 'Alpha Tech Corp',
  gstin: '33AAAAA1111A1Z1'
});

initializeBusiness(testDb, {
  companyId: companyB,
  companyName: 'Beta Logistics Corp',
  gstin: '29BBBBB2222B1Z2'
});

testDb.prepare(`
  INSERT INTO user_businesses (user_id, company_id, role)
  VALUES
    ('usr_user_a', 'comp_alpha_023', 'OWNER'),
    ('usr_user_b', 'comp_beta_023', 'OWNER')
`).run();

// Company A Financial Year
const fyA = testDb.prepare('SELECT fy_id FROM financial_years WHERE company_id = ? LIMIT 1').get(companyA) as any;
const fyIdA = fyA.fy_id;

// Godowns in Company A
testDb.prepare(`
  INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
  VALUES
    ('godown_a_main', 'comp_alpha_023', 'Main Godown A', 1),
    ('godown_a_sec', 'comp_alpha_023', 'Secondary Warehouse A', 0)
`).run();

// Godowns in Company B
testDb.prepare(`
  INSERT INTO godowns (godown_id, company_id, godown_name, is_default)
  VALUES
    ('godown_b_main', 'comp_beta_023', 'Main Godown B', 1)
`).run();

// Supplier & Customer in Company A
const suppLedgerA = `${companyA}_led_supp_a`;
testDb.prepare(`
  INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise)
  VALUES (?, ?, '${companyA}_grp_creditors', 'Alpha Supplier', 0)
`).run(suppLedgerA, companyA);
testDb.prepare(`
  INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type)
  VALUES ('party_supp_a', ?, ?, 'Alpha Supplier', 'SUPPLIER')
`).run(companyA, suppLedgerA);

// Items in Company A:
// 1. In-stock Tracked Item
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, item_code, sku, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_a_tracked', ?, 'Laptop Pro 15', 'LP-15', 'SKU-LP15', '84713010', '${companyA}_unit_nos', 18, 5000000, 6500000, 0)
`).run(companyA);

// 2. Zero-stock Tracked Item
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, item_code, sku, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_a_zero', ?, 'Wireless Mouse M1', 'WM-01', 'SKU-WM01', '84716060', '${companyA}_unit_nos', 18, 80000, 120000, 0)
`).run(companyA);

// 3. Service Item (HSN 998313)
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, item_code, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_a_service_hsn', ?, 'IT Consulting', 'SRV-01', '998313', '${companyA}_unit_nos', 18, 0, 1500000, 0)
`).run(companyA);

// 4. Service Item by Name (Contains 'service')
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, item_code, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_a_service_name', ?, 'Hardware Maintenance Service', 'SRV-02', '8471', '${companyA}_unit_nos', 18, 0, 500000, 0)
`).run(companyA);

// Items in Company B (for multi-tenant isolation testing)
testDb.prepare(`
  INSERT INTO stock_items (item_id, company_id, item_name, item_code, sku, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise, opening_qty)
  VALUES ('item_b_tracked', ?, 'Beta Drone X', 'DR-01', 'SKU-DR01', '8806', '${companyB}_unit_nos', 18, 3000000, 4500000, 5)
`).run(companyB);

// Post Purchase Vouchers in Company A to establish stock
// Purchase 10 units of Laptop Pro 15 into Main Godown A
PostingEngine.postVoucher(testDb, {
  companyId: companyA,
  fyId: fyIdA,
  voucherType: 'PURCHASE',
  voucherDate: '2026-05-01',
  partyId: 'party_supp_a',
  lines: [
    { itemId: 'item_a_tracked', godownId: 'godown_a_main', quantity: 10, ratePaise: 5000000, gstRate: 18 }
  ]
});

// Purchase 5 units of Laptop Pro 15 into Secondary Warehouse A
PostingEngine.postVoucher(testDb, {
  companyId: companyA,
  fyId: fyIdA,
  voucherType: 'PURCHASE',
  voucherDate: '2026-05-02',
  partyId: 'party_supp_a',
  lines: [
    { itemId: 'item_a_tracked', godownId: 'godown_a_sec', quantity: 5, ratePaise: 5200000, gstRate: 18 }
  ]
});

// Tokens
function makeToken(userId: string, username: string) {
  return jwt.sign(
    { userId, username, role: 'ADMIN', name: username, email: `${username}@test.com` },
    jwtSecret(),
    { expiresIn: '7d' }
  );
}
const tokenA = makeToken('usr_user_a', 'user_a');
const tokenB = makeToken('usr_user_b', 'user_b');

// Mount Express
const app = express();
app.use(express.json());
app.use('/api', createApiRouter(testDb));

async function runAllTests() {
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

  try {
    // ------------------------------------------------------------------------
    // SUITE 1: Stock Balance Retrieval & Accurate Availability
    // ------------------------------------------------------------------------
    console.log('[Suite 1: Stock Balance Retrieval & Accurate Availability]');

    await test('1.1: Returns accurate available stock across all godowns (10 + 5 = 15)', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_a_tracked/stock-balance`, {
        headers: {
          'Authorization': `Bearer ${tokenA}`,
          'x-company-id': companyA
        }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json() as any;
      assert.strictEqual(data.itemId, 'item_a_tracked');
      assert.strictEqual(data.itemName, 'Laptop Pro 15');
      assert.strictEqual(data.isInventoryTracked, true);
      assert.strictEqual(data.isService, false);
      assert.strictEqual(data.totalAvailableStock, 15);
      assert.strictEqual(data.availableStock, 15);
      assert.strictEqual(data.unitSymbol, 'Nos');
      assert(Array.isArray(data.godownBalances));
      assert(data.godownBalances.length >= 2, 'Should have at least 2 godowns');
      const mainGodown = data.godownBalances.find((g: any) => g.godownId === 'godown_a_main');
      const secGodown = data.godownBalances.find((g: any) => g.godownId === 'godown_a_sec');
      assert(mainGodown, 'Main Godown A found in balances');
      assert.strictEqual(mainGodown.availableStock, 10);
      assert(secGodown, 'Secondary Warehouse A found in balances');
      assert.strictEqual(secGodown.availableStock, 5);
    });

    await test('1.2: Filter by specific godown returns godown-specific availableStock', async () => {
      // Query Main Godown (expected 10)
      const resMain = await fetch(`${baseUrl}/masters/items/item_a_tracked/stock-balance?godownId=godown_a_main`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(resMain.status, 200);
      const dataMain = await resMain.json() as any;
      assert.strictEqual(dataMain.availableStock, 10);
      assert.strictEqual(dataMain.totalAvailableStock, 15);
      assert.strictEqual(dataMain.godownId, 'godown_a_main');

      // Query Secondary Godown (expected 5)
      const resSec = await fetch(`${baseUrl}/masters/items/item_a_tracked/stock-balance?godownId=godown_a_sec`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(resSec.status, 200);
      const dataSec = await resSec.json() as any;
      assert.strictEqual(dataSec.availableStock, 5);
      assert.strictEqual(dataSec.totalAvailableStock, 15);
      assert.strictEqual(dataSec.godownId, 'godown_a_sec');
    });

    await test('1.3: Item with zero stock returns availableStock = 0 without fabricating values', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_a_zero/stock-balance`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json() as any;
      assert.strictEqual(data.itemId, 'item_a_zero');
      assert.strictEqual(data.isInventoryTracked, true);
      assert.strictEqual(data.isService, false);
      assert.strictEqual(data.totalAvailableStock, 0);
      assert.strictEqual(data.availableStock, 0);
    });

    await test('1.4: Service item with HSN 99xxxx returns isService: true and availableStock: null', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_a_service_hsn/stock-balance`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json() as any;
      assert.strictEqual(data.itemId, 'item_a_service_hsn');
      assert.strictEqual(data.isInventoryTracked, false);
      assert.strictEqual(data.isService, true);
      assert.strictEqual(data.availableStock, null);
      assert.strictEqual(data.totalAvailableStock, null);
    });

    await test('1.5: Service item by name returns isService: true and availableStock: null', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_a_service_name/stock-balance`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json() as any;
      assert.strictEqual(data.itemId, 'item_a_service_name');
      assert.strictEqual(data.isInventoryTracked, false);
      assert.strictEqual(data.isService, true);
      assert.strictEqual(data.availableStock, null);
    });

    // ------------------------------------------------------------------------
    // SUITE 2: Multi-Tenant Isolation & Error Handling
    // ------------------------------------------------------------------------
    console.log('\n[Suite 2: Multi-Tenant Isolation & Error Handling]');

    await test('2.1: Non-existent item ID returns 404', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_non_existent/stock-balance`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.2: User A accessing Company B stock item returns 404 (tenant isolation)', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_b_tracked/stock-balance`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 404);
    });

    await test('2.3: User A specifying Company B godownId returns 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/masters/items/item_a_tracked/stock-balance?godownId=godown_b_main`, {
        headers: { 'Authorization': `Bearer ${tokenA}`, 'x-company-id': companyA }
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json() as any;
      assert(body.error.includes('Unauthorized access to foreign company godown'));
    });

    // ------------------------------------------------------------------------
    // SUITE 3: Stock Availability Validation Engine Invariants
    // ------------------------------------------------------------------------
    console.log('\n[Suite 3: Stock Availability Validation Engine Invariants]');

    await test('3.1: InventoryEngine.validateStockAvailability permits sale within available stock', () => {
      const check = InventoryEngine.validateStockAvailability(testDb, 'item_a_tracked', 'godown_a_main', 8, false);
      assert.strictEqual(check.isValid, true);
      assert.strictEqual(check.currentQty, 10);
    });

    await test('3.2: InventoryEngine.validateStockAvailability rejects sale exceeding stock when negative not allowed', () => {
      const check = InventoryEngine.validateStockAvailability(testDb, 'item_a_tracked', 'godown_a_main', 12, false);
      assert.strictEqual(check.isValid, false);
      assert.strictEqual(check.currentQty, 10);
      assert(check.message?.includes('Insufficient stock'));
    });

    // ------------------------------------------------------------------------
    // SUITE 4: Preview Safety & Accounting Immutability
    // ------------------------------------------------------------------------
    console.log('\n[Suite 4: Preview Safety & Accounting Immutability]');

    await test('4.1: Checking stock balance does NOT write to vouchers, stock_entries or ledgers', () => {
      const vouchersCountBefore = (testDb.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
      const stockEntriesBefore = (testDb.prepare('SELECT COUNT(*) as c FROM stock_entries').get() as any).c;

      // Call InventoryEngine stock balance check
      const summary = InventoryEngine.getItemStockSummary(testDb, 'item_a_tracked');
      assert.strictEqual(summary.totalQuantity, 15);

      const vouchersCountAfter = (testDb.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
      const stockEntriesAfter = (testDb.prepare('SELECT COUNT(*) as c FROM stock_entries').get() as any).c;

      assert.strictEqual(vouchersCountBefore, vouchersCountAfter, 'Zero vouchers created by preview/stock inspection');
      assert.strictEqual(stockEntriesBefore, stockEntriesAfter, 'Zero stock entries created by preview/stock inspection');
    });

    console.log('\n======================================================================');
    console.log(`ALL ${passedTests} / ${totalTests} UI-023 REGRESSION TESTS PASSED (100% SUCCESS)`);
    console.log('======================================================================\n');
  } finally {
    server.close();
  }
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
