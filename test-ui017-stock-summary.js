/**
 * test-ui017-stock-summary.js — UI-017 Stock Summary Dedicated End-to-End Test Suite
 *
 * Verifies:
 * 1. Stock Summary API Endpoint Retrieval (GET /api/reports/stock-summary)
 *    - Validates authoritative schema:
 *      itemId, itemName, sku, hsn, unit, quantity / closing_qty,
 *      avgRatePaise, totalValuePaise
 * 2. Authoritative Inventory & Valuation Engine:
 *    - Inwards (Purchases) increase stock quantity and adjust weighted average rate
 *    - Outwards (Sales) decrease stock quantity
 *    - Total stock value = closing_qty * avgRatePaise
 * 3. Historical As-Of Date Reconstruction (asOfDate parameter):
 *    - Transactions up to asOfDate are included
 *    - Transactions after asOfDate are omitted
 * 4. Voucher Status & Cancellation Integrity:
 *    - Only POSTED vouchers affect stock
 *    - Cancelled vouchers do not distort closing quantity or stock valuation
 * 5. Multi-Tenant Company Isolation:
 *    - Company B user cannot access Company A inventory or valuation figures
 * 6. Empty Company & Zero Stock Resilience:
 *    - Clean company without stock items returns empty array without throwing error
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null, companyId = null) {
  const url = new URL(BASE_URL + endpoint);
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (companyId) headers['x-company-id'] = companyId;

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers
    };

    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          body: parsed
        });
      });
    });

    request.on('error', (err) => {
      reject(err);
    });

    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('======================================================================');
  console.log('UI-017: STOCK SUMMARY REPORT END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate user & resolve company A & B
  console.log('[Step 1] Authenticating Test User A & User B...');
  const emailA = `stock_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'Inventory Manager A',
    username: `stockA_${timestamp}`,
    businessName: 'AeroTech Electronics Ltd'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `stock_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'Logistics Supervisor B',
    username: `stockB_${timestamp}`,
    businessName: 'Borealis Logistics Corp'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // 2. Verify Initial Empty State in Company A
  console.log('\n[Step 2] Verifying Empty Stock Summary State...');
  const emptyStockRes = await req('/reports/stock-summary', 'GET', null, tokenA, companyIdA);
  assert(emptyStockRes.ok, 'Stock summary endpoint responds 200 OK');
  assert(Array.isArray(emptyStockRes.body) && emptyStockRes.body.length === 0, 'New company starts with 0 stock items');

  // 3. Create Units, Godowns, and Stock Item in Company A
  console.log('\n[Step 3] Setting up Inventory Masters in Company A...');
  const unitsRes = await req('/masters/units', 'GET', null, tokenA, companyIdA);
  assert(unitsRes.ok, 'Units retrieved');
  const pcsUnit = unitsRes.body?.find(u => u.symbol?.toLowerCase() === 'pcs' || u.unit_name?.toLowerCase().includes('piece')) || unitsRes.body?.[0];
  const unitId = pcsUnit?.unit_id || null;

  // Create Item 1: High-Speed Router
  const createItemRes = await req('/masters/items', 'POST', {
    itemName: `Enterprise Gigabit Router ${timestamp}`,
    itemCode: `RTR-${timestamp}`,
    sku: `SKU-RTR-${timestamp}`,
    hsnSac: '851762',
    unitId: unitId,
    gstRate: 18,
    reorderLevel: 5,
    purchaseRatePaise: 400000, // ₹4,000.00
    sellingRatePaise: 550000    // ₹5,500.00
  }, tokenA, companyIdA);
  assert(createItemRes.ok, 'Stock item RTR created successfully');
  const itemId = createItemRes.body?.item_id || createItemRes.body?.itemId;
  assert(!!itemId, `Created Item ID resolved: ${itemId}`);

  // Create Supplier & Customer for Inward/Outward transactions
  const supplierRes = await req('/masters/parties', 'POST', {
    partyName: `Network Wholesale Suppliers ${timestamp}`,
    partyType: 'SUPPLIER',
    phone: '9876543210',
    gstin: '33AAAAA0000A1Z5'
  }, tokenA, companyIdA);
  assert(supplierRes.ok, 'Supplier party created');
  const supplierId = supplierRes.body?.party_id || supplierRes.body?.partyId;
  const supplierLedgerId = supplierRes.body?.ledger_id || supplierRes.body?.ledgerId;

  const customerRes = await req('/masters/parties', 'POST', {
    partyName: `Datacenter Clients Ltd ${timestamp}`,
    partyType: 'CUSTOMER',
    phone: '9123456789',
    gstin: '33BBBBB1111B1Z6'
  }, tokenA, companyIdA);
  assert(customerRes.ok, 'Customer party created');
  const customerId = customerRes.body?.party_id || customerRes.body?.partyId;
  const customerLedgerId = customerRes.body?.ledger_id || customerRes.body?.ledgerId;

  // 4. Inward Movement (Purchase Voucher): Buy 10 units @ ₹4,000 = ₹40,000
  console.log('\n[Step 4] Inward Stock Movement (Purchase 10 units)...');
  const purchaseVoucherRes = await req('/vouchers', 'POST', {
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-10',
    partyId: supplierId,
    narration: 'Purchase of 10 Enterprise Routers',
    lines: [
      {
        itemId: itemId,
        quantity: 10,
        ratePaise: 400000, // ₹4,000
        gstRate: 18
      }
    ]
  }, tokenA, companyIdA);
  assert(purchaseVoucherRes.ok, 'Purchase voucher posted successfully');
  const purchaseVoucherId = purchaseVoucherRes.body?.voucher_id || purchaseVoucherRes.body?.voucherId;

  // Verify stock summary after first purchase
  const summaryAfterPurchase1 = await req('/reports/stock-summary', 'GET', null, tokenA, companyIdA);
  assert(summaryAfterPurchase1.ok, 'Stock summary fetched after purchase 1');
  const itemSummary1 = summaryAfterPurchase1.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(!!itemSummary1, 'Item found in stock summary report');
  assert(Number(itemSummary1.quantity || itemSummary1.closing_qty) === 10, 'Closing quantity is exactly 10 units');
  assert(Number(itemSummary1.avgRatePaise) === 400000, 'Average rate is ₹4,000.00 (400000 paise)');
  assert(Number(itemSummary1.totalValuePaise) === 4000000, 'Total stock value is ₹40,000.00 (4000000 paise)');

  // 5. Additional Inward Movement at different rate: Buy 10 units @ ₹5,000 = ₹50,000
  // Total Qty: 20 units, Total Value: ₹40,000 + ₹50,000 = ₹90,000, Weighted Avg Rate: ₹4,500
  console.log('\n[Step 5] Second Inward at Different Rate (Weighted Average Test)...');
  const purchaseVoucher2 = await req('/vouchers', 'POST', {
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-15',
    partyId: supplierId,
    narration: 'Purchase of 10 additional routers at higher rate',
    lines: [
      {
        itemId: itemId,
        quantity: 10,
        ratePaise: 500000, // ₹5,000
        gstRate: 18
      }
    ]
  }, tokenA, companyIdA);
  assert(purchaseVoucher2.ok, 'Second purchase voucher posted');

  const summaryAfterPurchase2 = await req('/reports/stock-summary', 'GET', null, tokenA, companyIdA);
  const itemSummary2 = summaryAfterPurchase2.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(Number(itemSummary2.quantity || itemSummary2.closing_qty) === 20, 'Closing quantity is 20 units');
  assert(Number(itemSummary2.avgRatePaise) === 450000, 'Weighted average rate is ₹4,500.00 (450000 paise)');
  assert(Number(itemSummary2.totalValuePaise) === 9000000, 'Total stock value is ₹90,000.00 (9000000 paise)');

  // 6. Outward Movement (Sales Voucher): Sell 6 units
  // Remaining Qty: 14 units, Weighted Avg Rate: ₹4,500, Valuation: 14 * ₹4,500 = ₹63,000
  console.log('\n[Step 6] Outward Movement (Sales of 6 units)...');
  const salesVoucher = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-20',
    partyId: customerId,
    narration: 'Sale of 6 enterprise routers',
    allowNegativeStock: true,
    lines: [
      {
        itemId: itemId,
        quantity: 6,
        ratePaise: 650000, // Selling rate ₹6,500
        gstRate: 18
      }
    ]
  }, tokenA, companyIdA);
  assert(salesVoucher.ok, 'Sales voucher posted');

  const summaryAfterSale = await req('/reports/stock-summary', 'GET', null, tokenA, companyIdA);
  const itemSummary3 = summaryAfterSale.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(Number(itemSummary3.quantity || itemSummary3.closing_qty) === 14, 'Closing quantity after sale is 14 units');
  assert(Number(itemSummary3.avgRatePaise) === 450000, 'Average purchase rate remains ₹4,500.00');
  assert(Number(itemSummary3.totalValuePaise) === 6300000, 'Closing value is ₹63,000.00 (14 * ₹4,500)');

  // 7. Historical As-Of Date Filtering
  console.log('\n[Step 7] Historical As-Of Date Filtering...');
  // asOfDate = 2026-05-12 (Between purchase 1 and purchase 2): Should show 10 units @ ₹4,000 = ₹40,000
  const summaryAsOfMay12 = await req('/reports/stock-summary?asOfDate=2026-05-12', 'GET', null, tokenA, companyIdA);
  assert(summaryAsOfMay12.ok, 'Stock summary as of 2026-05-12 fetched');
  const itemSummaryMay12 = summaryAsOfMay12.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(Number(itemSummaryMay12.quantity || itemSummaryMay12.closing_qty) === 10, 'Historical stock as of 2026-05-12 is 10 units');
  assert(Number(itemSummaryMay12.totalValuePaise) === 4000000, 'Historical stock value as of 2026-05-12 is ₹40,000.00');

  // asOfDate = 2026-05-16 (Between purchase 2 and sale): Should show 20 units @ ₹4,500 = ₹90,000
  const summaryAsOfMay16 = await req('/reports/stock-summary?asOfDate=2026-05-16', 'GET', null, tokenA, companyIdA);
  const itemSummaryMay16 = summaryAsOfMay16.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(Number(itemSummaryMay16.quantity || itemSummaryMay16.closing_qty) === 20, 'Historical stock as of 2026-05-16 is 20 units');
  assert(Number(itemSummaryMay16.totalValuePaise) === 9000000, 'Historical stock value as of 2026-05-16 is ₹90,000.00');

  // 8. Voucher Cancellation Handling
  console.log('\n[Step 8] Voucher Cancellation Integrity...');
  const salesVoucherId = salesVoucher.body?.voucher_id || salesVoucher.body?.voucherId;
  const cancelSalesRes = await req(`/vouchers/${salesVoucherId}/cancel`, 'POST', {
    reason: 'Customer cancelled network order'
  }, tokenA, companyIdA);
  assert(cancelSalesRes.ok, 'Sales voucher cancelled successfully');

  // After sales cancellation, stock must revert back to 20 units
  const summaryAfterCancel = await req('/reports/stock-summary', 'GET', null, tokenA, companyIdA);
  const itemSummaryCancelled = summaryAfterCancel.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(Number(itemSummaryCancelled.quantity || itemSummaryCancelled.closing_qty) === 20, 'Stock rebounded to 20 units after sales cancellation');
  assert(Number(itemSummaryCancelled.totalValuePaise) === 9000000, 'Valuation restored to ₹90,000.00');

  // 9. Multi-Tenant Company Isolation
  console.log('\n[Step 9] Verifying Multi-Tenant Isolation (Company A vs Company B)...');
  const summaryCompanyB = await req('/reports/stock-summary', 'GET', null, tokenB, companyIdB);
  assert(summaryCompanyB.ok, 'Company B stock summary retrieved');
  const leakedItem = summaryCompanyB.body?.find(i => (i.itemId || i.item_id) === itemId);
  assert(!leakedItem, 'Company A stock item is strictly isolated and NOT visible to Company B');

  console.log('\n======================================================================');
  console.log('🎉 ALL UI-017 STOCK SUMMARY TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
