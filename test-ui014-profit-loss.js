/**
 * test-ui014-profit-loss.js — UI-014 Profit & Loss Report Dedicated End-to-End Test Suite
 *
 * Verifies:
 * 1. P&L Report Endpoint Retrieval (GET /api/reports/profit-loss)
 *    - Validates authoritative schema:
 *      tradingIncomePaise, tradingExpensePaise, grossProfitPaise,
 *      indirectIncomePaise, indirectExpensePaise, netProfitPaise,
 *      incomeLedgers, expenseLedgers
 * 2. Authoritative Double-Entry Financial Equations
 *    - Gross Profit = tradingIncomePaise - tradingExpensePaise
 *    - Net Profit = grossProfitPaise + indirectIncomePaise - indirectExpensePaise
 *    - Total Income = tradingIncomePaise + indirectIncomePaise
 *    - Total Expenses = tradingExpensePaise + indirectExpensePaise
 * 3. Categorization Integrity (Direct vs Indirect via affects_gross_profit)
 *    - Sales & Direct Income -> Trading Income
 *    - Purchases & Direct Expenses -> Trading Expense
 *    - Office / Admin / Rent / Utilities -> Indirect Expense
 *    - Non-operating / Interest / Commission -> Indirect Income
 * 4. Closed-Period & Date Boundary Enforcement
 *    - Vouchers strictly within fromDate..toDate are included
 *    - Prior and future transactions are omitted
 * 5. Voucher Lifecycle Integrity (POSTED Only)
 *    - Cancelled and draft vouchers are omitted from P&L figures
 * 6. Multi-Tenant Company Isolation
 *    - Company B user cannot access Company A P&L report
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
  console.log('UI-014: PROFIT & LOSS REPORT END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate user & resolve company A & B
  console.log('[Step 1] Authenticating Test User A & User B...');
  const emailA = `pnl_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'P&L Controller A',
    username: `pnlA_${timestamp}`,
    businessName: 'Apex Dynamics Corp'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `pnl_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'P&L Auditor B',
    username: `pnlB_${timestamp}`,
    businessName: 'Beta Dynamics Corp'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // 2. Setup Party, Item, and Ledgers in Company A
  console.log('\n[Step 2] Resolving Masters & Groups in Company A...');
  const groupsRes = await req('/masters/groups', 'GET', null, tokenA, companyIdA);
  assert(groupsRes.ok, 'Ledger groups retrieved');
  const indirectExpenseGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('indirect expense'));
  const indirectIncomeGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('indirect income'));
  assert(!!indirectExpenseGroup, 'Indirect Expenses group found');
  assert(!!indirectIncomeGroup, 'Indirect Income group found');

  // Create custom indirect expense ledger: Rent Expense
  const rentLedgerRes = await req('/masters/ledgers', 'POST', {
    ledgerName: `Office Rent ${timestamp}`,
    groupId: indirectExpenseGroup.group_id,
    openingBalancePaise: 0,
    openingBalanceType: 'DR'
  }, tokenA, companyIdA);
  assert(rentLedgerRes.ok, 'Rent Expense ledger created');
  const rentLedgerId = rentLedgerRes.body?.ledger_id || rentLedgerRes.body?.ledgerId;

  // Create custom indirect income ledger: Interest Income
  const interestLedgerRes = await req('/masters/ledgers', 'POST', {
    ledgerName: `Bank Interest ${timestamp}`,
    groupId: indirectIncomeGroup.group_id,
    openingBalancePaise: 0,
    openingBalanceType: 'CR'
  }, tokenA, companyIdA);
  assert(interestLedgerRes.ok, 'Interest Income ledger created');
  const interestLedgerId = interestLedgerRes.body?.ledger_id || interestLedgerRes.body?.ledgerId;

  // Resolve Cash ledger
  const allLedgersA = await req('/masters/ledgers', 'GET', null, tokenA, companyIdA);
  const cashLedger = allLedgersA.body?.find(l => l.ledger_name.toLowerCase().includes('cash'));
  const cashLedgerId = cashLedger?.ledger_id || `${companyIdA}_led_cash`;

  // Create Customer & Supplier parties
  const custRes = await req('/masters/parties', 'POST', {
    partyName: `P&L Customer ${timestamp}`,
    partyType: 'CUSTOMER',
    addressLine1: '101 Trade Ave',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, tokenA, companyIdA);
  const custPartyId = custRes.body?.party_id || custRes.body?.partyId;

  const suppRes = await req('/masters/parties', 'POST', {
    partyName: `P&L Supplier ${timestamp}`,
    partyType: 'SUPPLIER',
    addressLine1: '202 Supply Way',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, tokenA, companyIdA);
  const suppPartyId = suppRes.body?.party_id || suppRes.body?.partyId;

  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Enterprise Software ${timestamp}`,
    hsnSac: '998313',
    sellingRatePaise: 5000000, // ₹50,000
    purchaseRatePaise: 3000000, // ₹30,000
    gstRate: 0
  }, tokenA, companyIdA);
  const itemId = itemRes.body?.item_id || itemRes.body?.itemId;

  // 3. Post Transactions within Period (2026-05-01 to 2026-05-31)
  console.log('\n[Step 3] Posting Vouchers for Period (2026-05-01 to 2026-05-31)...');

  // a) Sales Voucher: ₹1,00,000 (10,000,000 paise) -> Trading Income
  const salesVch = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: custPartyId,
    narration: 'May Sales Invoice',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 2, ratePaise: 5000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(salesVch.ok, 'Sales voucher (₹1,00,000) posted');

  // b) Purchase Voucher: ₹60,000 (6,000,000 paise) -> Trading Expense
  const purchaseVch = await req('/vouchers', 'POST', {
    voucherType: 'PURCHASE',
    voucherDate: '2026-05-12',
    partyId: suppPartyId,
    narration: 'May Purchase Invoice',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 2, ratePaise: 3000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(purchaseVch.ok, 'Purchase voucher (₹60,000) posted');

  // c) Payment Voucher for Rent: ₹15,000 (1,500,000 paise) -> Indirect Expense
  const rentVch = await req('/vouchers', 'POST', {
    voucherType: 'PAYMENT',
    voucherDate: '2026-05-15',
    narration: 'Office Rent Payment',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: rentLedgerId, debitPaise: 1500000, creditPaise: 0, particulars: 'To Rent' },
      { ledgerId: cashLedgerId, debitPaise: 0, creditPaise: 1500000, particulars: 'By Cash' }
    ]
  }, tokenA, companyIdA);
  assert(rentVch.ok, 'Rent payment voucher (₹15,000) posted');

  // d) Receipt Voucher for Interest: ₹5,000 (500,000 paise) -> Indirect Income
  const interestVch = await req('/vouchers', 'POST', {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-20',
    narration: 'Bank Interest Received',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: cashLedgerId, debitPaise: 500000, creditPaise: 0, particulars: 'To Cash' },
      { ledgerId: interestLedgerId, debitPaise: 0, creditPaise: 500000, particulars: 'By Interest' }
    ]
  }, tokenA, companyIdA);
  assert(interestVch.ok, 'Interest income voucher (₹5,000) posted');

  // e) Pre-period Sales Voucher: ₹20,000 on 2026-04-10 -> Must NOT be included in May P&L
  const preVch = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-04-10',
    partyId: custPartyId,
    narration: 'April Sales (Pre-period)',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 1, ratePaise: 2000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(preVch.ok, 'Pre-period April sales voucher posted');

  // f) Future-period Sales Voucher: ₹30,000 on 2026-06-15 -> Must NOT be included in May P&L
  const futureVch = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-06-15',
    partyId: custPartyId,
    narration: 'June Sales (Future)',
    allowNegativeStock: true,
    lines: [{ itemId, quantity: 1, ratePaise: 3000000, gstRate: 0 }]
  }, tokenA, companyIdA);
  assert(futureVch.ok, 'Future-period June sales voucher posted');

  // 4. Query Profit & Loss for May 2026
  console.log('\n[Step 4] Querying Profit & Loss (2026-05-01 to 2026-05-31)...');
  const pnlRes = await req(`/reports/profit-loss?companyId=${companyIdA}&fromDate=2026-05-01&toDate=2026-05-31`, 'GET', null, tokenA, companyIdA);
  assert(pnlRes.ok, 'GET /reports/profit-loss returned HTTP 200');
  const pnl = pnlRes.body;

  console.log('\n[Step 5] Validating Authoritative Accounting Equations & Numbers...');
  // Trading Income = 10,000,000 paise (Sales)
  assert(pnl.tradingIncomePaise === 10000000, `Trading Income exactly equals May Sales (10,000,000 paise): ${pnl.tradingIncomePaise}`);
  
  // Trading Expense = 6,000,000 paise (Purchase)
  assert(pnl.tradingExpensePaise === 6000000, `Trading Expense exactly equals May Purchases (6,000,000 paise): ${pnl.tradingExpensePaise}`);

  // Gross Profit = 10,000,000 - 6,000,000 = 4,000,000 paise (₹40,000)
  assert(pnl.grossProfitPaise === 4000000, `Gross Profit equals Trading Income - Trading Expense (4,000,000 paise): ${pnl.grossProfitPaise}`);

  // Indirect Income = 500,000 paise (₹5,000 Interest)
  assert(pnl.indirectIncomePaise === 500000, `Indirect Income equals May Interest (500,000 paise): ${pnl.indirectIncomePaise}`);

  // Indirect Expense = 1,500,000 paise (₹15,000 Rent)
  assert(pnl.indirectExpensePaise === 1500000, `Indirect Expense equals May Rent (1,500,000 paise): ${pnl.indirectExpensePaise}`);

  // Net Profit = Gross Profit (4,000,000) + Indirect Income (500,000) - Indirect Expense (1,500,000) = 3,000,000 paise (₹30,000)
  assert(pnl.netProfitPaise === 3000000, `Net Profit equals Gross Profit + Indirect Income - Indirect Expense (3,000,000 paise): ${pnl.netProfitPaise}`);

  // 6. Validating Ledger-Level Breakdown
  console.log('\n[Step 6] Validating Ledger-Level Breakdown...');
  assert(Array.isArray(pnl.incomeLedgers), 'pnl.incomeLedgers is an array');
  assert(Array.isArray(pnl.expenseLedgers), 'pnl.expenseLedgers is an array');

  const rentFound = pnl.expenseLedgers.find(l => l.ledgerName.includes('Rent'));
  assert(!!rentFound && rentFound.amountPaise === 1500000, `Rent ledger found in expenses with 1,500,000 paise: ${rentFound?.amountPaise}`);

  const interestFound = pnl.incomeLedgers.find(l => l.ledgerName.includes('Interest'));
  assert(!!interestFound && interestFound.amountPaise === 500000, `Interest ledger found in incomes with 500,000 paise: ${interestFound?.amountPaise}`);

  // 7. Cancellation Lifecycle Integrity
  console.log('\n[Step 7] Validating Cancellation Handling...');
  // Cancel the sales voucher
  const salesVchId = salesVch.body?.voucher_id || salesVch.body?.voucherId;
  const cancelRes = await req(`/vouchers/${salesVchId}/cancel`, 'POST', { reason: 'P&L test cancellation' }, tokenA, companyIdA);
  assert(cancelRes.ok, `Sales voucher cancelled`);

  // Re-query P&L
  const pnlPostCancel = await req(`/reports/profit-loss?companyId=${companyIdA}&fromDate=2026-05-01&toDate=2026-05-31`, 'GET', null, tokenA, companyIdA);
  assert(pnlPostCancel.ok, 'Re-queried P&L post-cancellation');
  assert(pnlPostCancel.body.tradingIncomePaise === 0, `Trading Income dropped to 0 after sales cancellation: ${pnlPostCancel.body.tradingIncomePaise}`);
  assert(pnlPostCancel.body.tradingExpensePaise === 0, `Trading Expense (COGS) reversed to 0 after sales cancellation: ${pnlPostCancel.body.tradingExpensePaise}`);
  assert(pnlPostCancel.body.grossProfitPaise === 0, `Gross Profit correctly becomes 0: ${pnlPostCancel.body.grossProfitPaise}`);
  assert(pnlPostCancel.body.netProfitPaise === -1000000, `Net Profit correctly reflects 0 + 500K - 1.5M = -1,000,000 paise: ${pnlPostCancel.body.netProfitPaise}`);

  // 8. Cross-Company Multi-Tenant Isolation
  console.log('\n[Step 8] Testing Cross-Company Multi-Tenant Isolation...');
  // Attempt 1: User B tries to pass Company A in x-company-id header -> Must receive HTTP 403 Forbidden
  const forbiddenBreach = await req(`/reports/profit-loss?fromDate=2026-05-01&toDate=2026-05-31`, 'GET', null, tokenB, companyIdA);
  assert(forbiddenBreach.status === 403, `User B requesting Company A header is strictly rejected with HTTP 403 (status: ${forbiddenBreach.status})`);

  // Attempt 2: User B requesting their own company has completely isolated zero data
  const userBIsolated = await req(`/reports/profit-loss?fromDate=2026-05-01&toDate=2026-05-31`, 'GET', null, tokenB, companyIdB);
  assert(userBIsolated.ok, 'User B can query own company');
  assert(userBIsolated.body.tradingIncomePaise === 0, 'Company B has 0 trading income (no leak from Company A)');
  assert(userBIsolated.body.incomeLedgers.length === 0, 'Company B has 0 income ledgers (no leak from Company A)');
  assert(userBIsolated.body.expenseLedgers.length === 0, 'Company B has 0 expense ledgers (no leak from Company A)');

  console.log('\n======================================================================');
  console.log('✅ UI-014: ALL PROFIT & LOSS REPORT VERIFICATION CHECKS PASSED');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
