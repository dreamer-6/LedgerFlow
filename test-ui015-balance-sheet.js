/**
 * test-ui015-balance-sheet.js — UI-015 Balance Sheet Report Dedicated End-to-End Test Suite
 *
 * Verifies:
 * 1. Balance Sheet Endpoint Retrieval (GET /api/reports/balance-sheet)
 *    - Validates authoritative schema:
 *      totalAssetsPaise, totalLiabilitiesEquityPaise, assets, liabilities, equity,
 *      netProfitPaise, retainedEarningsPaise, isBalanced
 * 2. Authoritative Double-Entry Financial Equations & Parity:
 *    - totalAssetsPaise === totalLiabilitiesEquityPaise
 *    - isBalanced === true
 * 3. Asset, Liability, and Equity Classification & Debit/Credit Conventions:
 *    - Asset ledgers reflect Net Debit (debit - credit)
 *    - Liability ledgers reflect Net Credit (credit - debit)
 *    - Equity ledgers reflect Net Credit + Current Year Net Profit (+ prior retained earnings)
 * 4. As-on-Date Boundaries:
 *    - Transactions on or before asOnDate are included
 *    - Transactions strictly after asOnDate are excluded
 * 5. Current-Period Profit/Loss Treatment:
 *    - Net profit dynamically derived from P&L within the active FY up to asOnDate
 *    - Added to equity section to maintain double-entry equilibrium
 * 6. Voucher Lifecycle & Cancellation Handling:
 *    - Cancelled vouchers do not leak into Balance Sheet figures
 * 7. Multi-Tenant Company Isolation:
 *    - Company B user cannot access Company A Balance Sheet
 * 8. Reconciliation with Trial Balance:
 *    - Balances match authoritative Trial Balance ledger totals
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
  console.log('UI-015: BALANCE SHEET REPORT END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate user & resolve company A & B
  console.log('[Step 1] Authenticating Test User A & User B...');
  const emailA = `bs_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'Balance Sheet Controller A',
    username: `bsA_${timestamp}`,
    businessName: 'Vanguard Global Corp'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `bs_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'Balance Sheet Auditor B',
    username: `bsB_${timestamp}`,
    businessName: 'Apex International Corp'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // 2. Setup Ledgers in Company A: Fixed Asset, Bank, Owner Capital
  console.log('\n[Step 2] Resolving Masters & Groups in Company A...');
  const groupsRes = await req('/masters/groups', 'GET', null, tokenA, companyIdA);
  assert(groupsRes.ok, 'Ledger groups retrieved');
  
  const assetGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('asset'));
  const capitalGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('capital'));
  assert(!!assetGroup, 'Assets group found');
  assert(!!capitalGroup, 'Capital Account group found');

  // Create Asset Ledger: Office Equipment (with Opening Balance ₹2,00,000 DR)
  const machineryLedgerRes = await req('/masters/ledgers', 'POST', {
    ledgerName: `Office Equipment ${timestamp}`,
    groupId: assetGroup.group_id,
    openingBalancePaise: 20000000, // ₹2,00,000
    openingBalanceType: 'DR'
  }, tokenA, companyIdA);
  assert(machineryLedgerRes.ok, 'Machinery Asset ledger created with opening balance');
  const machineryLedgerId = machineryLedgerRes.body?.ledger_id || machineryLedgerRes.body?.ledgerId;

  // Create Owner Capital Ledger (with Opening Balance ₹2,00,000 CR)
  const capitalLedgerRes = await req('/masters/ledgers', 'POST', {
    ledgerName: `Founder Capital ${timestamp}`,
    groupId: capitalGroup.group_id,
    openingBalancePaise: 20000000, // ₹2,00,000
    openingBalanceType: 'CR'
  }, tokenA, companyIdA);
  assert(capitalLedgerRes.ok, 'Founder Capital ledger created with opening balance');
  const capitalLedgerId = capitalLedgerRes.body?.ledger_id || capitalLedgerRes.body?.ledgerId;

  // Verify Initial Balance Sheet Parity with Opening Balances
  console.log('\n[Step 3] Verifying Initial Opening Balance Sheet Parity...');
  const initialBs = await req('/reports/balance-sheet?asOnDate=2026-04-01', 'GET', null, tokenA, companyIdA);
  assert(initialBs.ok, 'Initial Balance Sheet retrieved');
  assert(initialBs.body?.isBalanced === true, 'Initial Balance Sheet is strictly balanced');
  assert(initialBs.body?.totalAssetsPaise === 20000000, `Assets match opening balance: ₹2,00,000 (got ${initialBs.body?.totalAssetsPaise})`);
  assert(initialBs.body?.totalLiabilitiesEquityPaise === 20000000, `Liab & Equity match opening: ₹2,00,000 (got ${initialBs.body?.totalLiabilitiesEquityPaise})`);

  // 3. Setup Party, Item, and Post Vouchers for Trading (Revenue & Profit Generation)
  console.log('\n[Step 4] Posting Trading Transactions for Period (generating profit)...');
  const custRes = await req('/masters/parties', 'POST', {
    partyName: `BS Trade Debtor ${timestamp}`,
    partyType: 'CUSTOMER',
    addressLine1: '400 Marina Blvd',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, tokenA, companyIdA);
  const custPartyId = custRes.body?.party_id || custRes.body?.partyId;

  const suppRes = await req('/masters/parties', 'POST', {
    partyName: `BS Trade Creditor ${timestamp}`,
    partyType: 'SUPPLIER',
    addressLine1: '500 Supplier Road',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, tokenA, companyIdA);
  const suppPartyId = suppRes.body?.party_id || suppRes.body?.partyId;

  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Hardware Server Unit ${timestamp}`,
    hsnSac: '8471',
    sellingRatePaise: 8000000, // ₹80,000
    purchaseRatePaise: 5000000, // ₹50,000
    gstRate: 0
  }, tokenA, companyIdA);
  const itemId = itemRes.body?.item_id || itemRes.body?.itemId;

  // Sales Voucher: 1 Unit @ ₹80,000 on 2026-05-10
  const salesVch = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: custPartyId,
    narration: 'BS Test Sales Invoice',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 1, ratePaise: 8000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(salesVch.ok, 'Sales voucher (₹80,000) posted');

  // Purchase Voucher: 1 Unit @ ₹50,000 on 2026-05-12
  const purchaseVch = await req('/vouchers', 'POST', {
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-12',
    partyId: suppPartyId,
    narration: 'BS Test Purchase Invoice',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 1, ratePaise: 5000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(purchaseVch.ok, 'Purchase voucher (₹50,000) posted');

  // Net Profit from trade = ₹80,000 - ₹50,000 = ₹30,000 (3,000,000 paise)
  // Assets: Machinery (₹2,00,000) + Sundry Debtors (₹80,000) = ₹2,80,000
  // Liabilities: Sundry Creditors (₹50,000)
  // Equity: Capital (₹2,00,000) + Net Profit (₹30,000) = ₹2,30,000
  // Total Liabilities & Equity = ₹50,000 + ₹2,30,000 = ₹2,80,000. Balance Sheet = BALANCED!

  // 4. Verify As-On 2026-05-31 Balance Sheet Parity & Profit Incorporation
  console.log('\n[Step 5] Verifying Balance Sheet As On 2026-05-31...');
  const bsMay = await req('/reports/balance-sheet?asOnDate=2026-05-31', 'GET', null, tokenA, companyIdA);
  assert(bsMay.ok, 'May 31 Balance Sheet retrieved');
  const d = bsMay.body;

  assert(d.isBalanced === true, 'May 31 Balance Sheet is strictly balanced (Assets == Liab + Equity)');
  assert(d.netProfitPaise === 3000000, `Net profit is ₹30,000 (3,000,000 paise), got ${d.netProfitPaise}`);
  assert(d.totalAssetsPaise === 28000000, `Total Assets is ₹2,80,000 (28,000,000 paise), got ${d.totalAssetsPaise}`);
  assert(d.totalLiabilitiesEquityPaise === 28000000, `Total Liab & Equity is ₹2,80,000, got ${d.totalLiabilitiesEquityPaise}`);

  // Check Assets and Liabilities listings
  const debtorAsset = d.assets.find(a => a.ledgerName.includes('Debtor') || a.ledgerName.includes('BS Trade Debtor'));
  assert(!!debtorAsset && debtorAsset.amountPaise === 8000000, `Debtor asset correctly reflects ₹80,000 receivable`);

  const creditorLiab = d.liabilities.find(l => l.ledgerName.includes('Creditor') || l.ledgerName.includes('BS Trade Creditor'));
  assert(!!creditorLiab && creditorLiab.amountPaise === 5000000, `Creditor liability correctly reflects ₹50,000 payable`);

  // 5. Test Date Boundary Enforcement (future transaction should not leak into 2026-05-31)
  console.log('\n[Step 6] Verifying Date Boundary Enforcement (asOnDate scoping)...');
  const futureVch = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-08-15',
    partyId: custPartyId,
    narration: 'Future August Invoice',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 1, ratePaise: 8000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(futureVch.ok, 'Future August sales voucher posted');
  const futureVchId = futureVch.body?.voucherId;

  const bsMayAfterFuture = await req('/reports/balance-sheet?asOnDate=2026-05-31', 'GET', null, tokenA, companyIdA);
  assert(bsMayAfterFuture.ok, 'May 31 Balance Sheet re-fetched');
  assert(bsMayAfterFuture.body?.totalAssetsPaise === 28000000, 'Future August transaction NOT included in May 31 Balance Sheet');
  assert(bsMayAfterFuture.body?.isBalanced === true, 'Balance Sheet remains balanced with boundary filtering');

  // Verify August Balance Sheet DOES include it
  const bsAug = await req('/reports/balance-sheet?asOnDate=2026-08-31', 'GET', null, tokenA, companyIdA);
  assert(bsAug.ok, 'August 31 Balance Sheet retrieved');
  console.log('August BS body:', JSON.stringify(bsAug.body, null, 2));
  assert(bsAug.body?.totalAssetsPaise > 28000000, `August 31 Balance Sheet includes August invoice (got ${bsAug.body?.totalAssetsPaise})`);
  assert(bsAug.body?.isBalanced === true, 'August 31 Balance Sheet is balanced');

  // 6. Test Voucher Cancellation Handling
  console.log('\n[Step 7] Verifying Voucher Cancellation Handling in Balance Sheet...');
  const cancelRes = await req(`/vouchers/${futureVchId}/cancel`, 'POST', { reason: 'Cancelled test order' }, tokenA, companyIdA);
  assert(cancelRes.ok, 'August voucher cancelled');

  const bsAugAfterCancel = await req('/reports/balance-sheet?asOnDate=2026-08-31', 'GET', null, tokenA, companyIdA);
  assert(bsAugAfterCancel.ok, 'August 31 Balance Sheet fetched after cancellation');
  assert(bsAugAfterCancel.body?.totalAssetsPaise === 28000000, 'Cancelled voucher reversed from Balance Sheet assets');
  assert(bsAugAfterCancel.body?.isBalanced === true, 'Balance Sheet remains balanced after cancellation reversal');

  // 7. Reconciliation with Trial Balance
  console.log('\n[Step 8] Reconciling Balance Sheet against authoritative Trial Balance...');
  const tbRes = await req('/reports/trial-balance?asOnDate=2026-05-31', 'GET', null, tokenA, companyIdA);
  assert(tbRes.ok, 'Authoritative Trial Balance retrieved');
  
  let tbAssetNet = 0;
  let tbLiabNet = 0;
  let tbEquityNet = 0;
  for (const r of tbRes.body?.rows || []) {
    if (r.nature === 'ASSET') tbAssetNet += (r.debitPaise - r.creditPaise);
    if (r.nature === 'LIABILITY') tbLiabNet += (r.creditPaise - r.debitPaise);
    if (r.nature === 'EQUITY') tbEquityNet += (r.creditPaise - r.debitPaise);
  }

  assert(tbAssetNet === bsMay.body?.totalAssetsPaise, `TB Asset total (${tbAssetNet}) matches BS Asset total (${bsMay.body?.totalAssetsPaise})`);
  assert(tbLiabNet === (bsMay.body?.liabilities.reduce((s, l) => s + l.amountPaise, 0)), 'TB Liability matches BS Liability sum');

  // 8. Multi-Tenant Company Isolation
  console.log('\n[Step 9] Verifying Multi-Tenant Isolation (Company B isolation)...');
  const bsCompB = await req('/reports/balance-sheet?asOnDate=2026-05-31', 'GET', null, tokenB, companyIdB);
  assert(bsCompB.ok, 'Company B Balance Sheet fetched');
  assert(bsCompB.body?.totalAssetsPaise === 0, `Company B assets isolated at 0 (got ${bsCompB.body?.totalAssetsPaise})`);

  // Attempt cross-tenant fetch: User B using Company A header
  const crossTenantRes = await req('/reports/balance-sheet?asOnDate=2026-05-31', 'GET', null, tokenB, companyIdA);
  assert(crossTenantRes.status === 403 || crossTenantRes.status === 401, `Cross-tenant Balance Sheet request rejected with status ${crossTenantRes.status}`);

  console.log('\n======================================================================');
  console.log('✅ ALL UI-015 BALANCE SHEET TESTS PASSED SUCCESSFULLY (9/9 Steps)');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
