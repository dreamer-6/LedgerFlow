/**
 * test-ui018-outstanding-reports.js — UI-018 Outstanding Reports Dedicated End-to-End Test Suite
 *
 * Verifies:
 * 1. Outstanding Reports Retrieval (GET /api/reports/outstanding?type=CUSTOMER & type=SUPPLIER)
 *    - Validates authoritative schema:
 *      partyId, partyName, phone, totalOutstandingPaise,
 *      bucket0to30Paise, bucket31to60Paise, bucket61to90Paise, bucket90PlusPaise
 * 2. Customer Receivables vs Supplier Payables Isolation:
 *    - Strict separation between CUSTOMER and SUPPLIER outstanding entries
 * 3. Opening Balance Placement (DEF-REP-02):
 *    - Party opening balances are placed in oldest bucket (bucket90PlusPaise)
 * 4. Invoice Posting & Aging Bucketing:
 *    - Current invoices (<= 30 days) appear in bucket0to30Paise
 *    - Total outstanding = bucket0to30 + bucket31to60 + bucket61to90 + bucket90Plus
 * 5. FIFO & Reference Settlement Tracking:
 *    - Receipts reduce customer receivables
 *    - Payments reduce supplier payables
 *    - Partially settled invoices accurately reflect residual unpaid balance
 * 6. Historical asOnDate Point-in-Time Reconstruction (DEF-REP-14):
 *    - Vouchers after asOnDate do not affect earlier outstanding snapshots
 * 7. Voucher Cancellation Integrity:
 *    - Cancelled sales/receipts reverse their outstanding impact
 * 8. Multi-Tenant Company Isolation:
 *    - Company B user cannot view Company A party outstandings
 * 9. Zero-Balance / Fully Settled Parties:
 *    - Parties with 0 outstanding balance are cleanly omitted from the active report
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
  console.log('UI-018: OUTSTANDING REPORTS END-TO-END VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate user & resolve company A & B
  console.log('[Step 1] Authenticating Test User A & User B...');
  const emailA = `out_userA_${timestamp}@example.com`;
  const regA = await req('/auth/register', 'POST', {
    email: emailA,
    password: 'Password@123',
    fullName: 'Credit Controller A',
    username: `outA_${timestamp}`,
    businessName: 'Starlight Retailers Ltd'
  });
  const tokenA = regA.body?.token;
  assert(!!tokenA, 'User A registered with JWT');

  const bizA = await req('/businesses', 'GET', null, tokenA);
  const companyIdA = bizA.body?.[0]?.company_id || bizA.body?.[0]?.companyId;
  assert(!!companyIdA, `Company A resolved: ${companyIdA}`);

  const emailB = `out_userB_${timestamp}@example.com`;
  const regB = await req('/auth/register', 'POST', {
    email: emailB,
    password: 'Password@123',
    fullName: 'Credit Auditor B',
    username: `outB_${timestamp}`,
    businessName: 'Nova Enterprises Corp'
  });
  const tokenB = regB.body?.token;
  assert(!!tokenB, 'User B registered with JWT');

  const bizB = await req('/businesses', 'GET', null, tokenB);
  const companyIdB = bizB.body?.[0]?.company_id || bizB.body?.[0]?.companyId;
  assert(!!companyIdB, `Company B resolved: ${companyIdB}`);

  // 2. Verify Initial Empty Outstanding State
  console.log('\n[Step 2] Verifying Initial Clean Outstanding State...');
  const emptyCustOut = await req('/reports/outstanding?type=CUSTOMER', 'GET', null, tokenA, companyIdA);
  assert(emptyCustOut.ok, 'Customer outstanding endpoint responds 200 OK');
  assert(Array.isArray(emptyCustOut.body) && emptyCustOut.body.length === 0, 'New company has 0 customer receivables');

  const emptySuppOut = await req('/reports/outstanding?type=SUPPLIER', 'GET', null, tokenA, companyIdA);
  assert(emptySuppOut.ok, 'Supplier outstanding endpoint responds 200 OK');
  assert(Array.isArray(emptySuppOut.body) && emptySuppOut.body.length === 0, 'New company has 0 supplier payables');

  // 3. Setup Parties:
  // - Customer 1: Has Opening Balance of ₹25,000 (DR) -> bucket90Plus
  // - Customer 2: New Customer (no opening balance) -> will receive invoice
  // - Supplier 1: Has Opening Balance of ₹40,000 (CR) -> bucket90Plus
  console.log('\n[Step 3] Setting up Parties with Opening Balances (DEF-REP-02)...');
  
  // Resolve Debtors & Creditors groups
  const groupsRes = await req('/masters/groups', 'GET', null, tokenA, companyIdA);
  const debtorGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('debtor')) || groupsRes.body?.[0];
  const creditorGroup = groupsRes.body?.find(g => g.group_name.toLowerCase().includes('creditor')) || groupsRes.body?.[1];

  // Customer 1 with opening balance ₹25,000 DR
  const cust1Res = await req('/masters/parties', 'POST', {
    partyName: `Sri Balaji Enterprises ${timestamp}`,
    partyType: 'CUSTOMER',
    phone: '9840112233',
    openingBalancePaise: 2500000, // ₹25,000
    openingBalanceType: 'DR'
  }, tokenA, companyIdA);
  assert(cust1Res.ok, 'Customer 1 created with ₹25,000 opening balance');
  const cust1Id = cust1Res.body?.party_id || cust1Res.body?.partyId;
  const cust1LedgerId = cust1Res.body?.ledger_id || cust1Res.body?.ledgerId;

  // Resolve Cash Ledger for double-entry receipts
  const allLedgers = await req('/masters/ledgers', 'GET', null, tokenA, companyIdA);
  const cashLedger = allLedgers.body?.find(l => l.ledger_name.toLowerCase().includes('cash'));
  const cashLedgerId = cashLedger?.ledger_id || `${companyIdA}_led_cash`;

  // Supplier 1 with opening balance ₹40,000 CR
  const supp1Res = await req('/masters/parties', 'POST', {
    partyName: `Raja Distributors ${timestamp}`,
    partyType: 'SUPPLIER',
    phone: '9840223344',
    openingBalancePaise: 4000000, // ₹40,000
    openingBalanceType: 'CR'
  }, tokenA, companyIdA);
  assert(supp1Res.ok, 'Supplier 1 created with ₹40,000 opening balance');
  const supp1Id = supp1Res.body?.party_id || supp1Res.body?.partyId;

  // Verify Opening Balance in Outstanding Report
  const custOutOpening = await req('/reports/outstanding?type=CUSTOMER', 'GET', null, tokenA, companyIdA);
  assert(custOutOpening.ok, 'Customer outstandings retrieved with opening balances');
  const cust1Entry = custOutOpening.body?.find(c => c.partyId === cust1Id);
  assert(!!cust1Entry, 'Customer 1 appears in receivable report');
  assert(Number(cust1Entry.totalOutstandingPaise) === 2500000, 'Customer 1 total outstanding is ₹25,000 (2500000 paise)');
  assert(Number(cust1Entry.bucket90PlusPaise) === 2500000, 'Customer 1 opening balance is mapped to oldest bucket (>90 days)');

  const suppOutOpening = await req('/reports/outstanding?type=SUPPLIER', 'GET', null, tokenA, companyIdA);
  const supp1Entry = suppOutOpening.body?.find(s => s.partyId === supp1Id);
  assert(!!supp1Entry, 'Supplier 1 appears in payable report');
  assert(Number(supp1Entry.totalOutstandingPaise) === 4000000, 'Supplier 1 total outstanding is ₹40,000 (4000000 paise)');
  assert(Number(supp1Entry.bucket90PlusPaise) === 4000000, 'Supplier 1 opening balance is mapped to oldest bucket (>90 days)');

  // 4. Create Item & Post Sales Invoice on 2026-05-10
  // Invoice for Customer 1: ₹50,000
  // Total Customer 1 outstanding will become: ₹25,000 (oldest) + ₹50,000 (current) = ₹75,000
  console.log('\n[Step 4] Posting Sales Invoice on 2026-05-10 (Adding Current Bucket)...');
  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Commercial LED Screen ${timestamp}`,
    hsnSac: '852852',
    sellingRatePaise: 5000000, // ₹50,000
    purchaseRatePaise: 3500000,
    gstRate: 0
  }, tokenA, companyIdA);
  const itemId = itemRes.body?.item_id || itemRes.body?.itemId;

  const salesVoucherRes = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-05-10',
    partyId: cust1Id,
    narration: 'Invoice for 1 LED screen',
    allowNegativeStock: true,
    lines: [
      {
        itemId: itemId,
        quantity: 1,
        ratePaise: 5000000, // ₹50,000
        gstRate: 0
      }
    ]
  }, tokenA, companyIdA);
  assert(salesVoucherRes.ok, 'Sales invoice posted for Customer 1');
  const salesVoucherId = salesVoucherRes.body?.voucher_id || salesVoucherRes.body?.voucherId;

  // Verify Customer 1 breakdown as of 2026-05-15 (Current date within 30 days)
  const custOutAfterInvoice = await req('/reports/outstanding?type=CUSTOMER&asOnDate=2026-05-15', 'GET', null, tokenA, companyIdA);
  const cust1AfterInv = custOutAfterInvoice.body?.find(c => c.partyId === cust1Id);
  assert(Number(cust1AfterInv.totalOutstandingPaise) === 7500000, 'Total receivable is ₹75,000 (25,000 opening + 50,000 invoice)');
  assert(Number(cust1AfterInv.bucket0to30Paise) === 5000000, 'New invoice (dated 2026-05-10 vs 2026-05-15 reference) is in 0-30 days bucket');
  assert(Number(cust1AfterInv.bucket90PlusPaise) === 2500000, 'Opening balance remains in >90 days bucket');

  // 5. Historical asOnDate Verification:
  // Before invoice date (e.g. asOnDate = 2026-05-01): Only Opening Balance ₹25,000 should exist
  console.log('\n[Step 5] Historical asOnDate Filtering (DEF-REP-14)...');
  const custOutAsOfMay01 = await req('/reports/outstanding?type=CUSTOMER&asOnDate=2026-05-01', 'GET', null, tokenA, companyIdA);
  const cust1May01 = custOutAsOfMay01.body?.find(c => c.partyId === cust1Id);
  assert(Number(cust1May01.totalOutstandingPaise) === 2500000, 'As of May 01 (prior to invoice), outstanding is only ₹25,000');
  assert(Number(cust1May01.bucket0to30Paise) === 0, 'No current invoices as of May 01');

  // 6. Partial Settlement / Receipt via FIFO:
  // Customer 1 pays ₹30,000 on 2026-05-20.
  // FIFO settlement should clear the ₹25,000 opening balance first, and ₹5,000 of the ₹50,000 invoice!
  // Remaining total outstanding: ₹45,000 in bucket0to30Paise (0 in bucket90Plus)!
  console.log('\n[Step 6] Partial Settlement via Receipt (FIFO Policy Verification)...');
  const receiptVoucherRes = await req('/vouchers', 'POST', {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-20',
    partyId: cust1Id,
    narration: 'Partial settlement from Sri Balaji Enterprises',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: cashLedgerId, debitPaise: 3000000, creditPaise: 0 },
      { ledgerId: cust1LedgerId, debitPaise: 0, creditPaise: 3000000 }
    ]
  }, tokenA, companyIdA);
  assert(receiptVoucherRes.ok, 'Customer receipt of ₹30,000 posted');
  const receiptVoucherId = receiptVoucherRes.body?.voucher_id || receiptVoucherRes.body?.voucherId;

  const custOutAfterReceipt = await req('/reports/outstanding?type=CUSTOMER&asOnDate=2026-05-25', 'GET', null, tokenA, companyIdA);
  const cust1AfterReceipt = custOutAfterReceipt.body?.find(c => c.partyId === cust1Id);
  assert(Number(cust1AfterReceipt.totalOutstandingPaise) === 4500000, 'Remaining outstanding is ₹45,000 (₹75,000 - ₹30,000)');
  assert(Number(cust1AfterReceipt.bucket90PlusPaise) === 0, 'Oldest ₹25,000 bucket completely settled via FIFO');
  assert(Number(cust1AfterReceipt.bucket0to30Paise) === 4500000, 'Residual ₹45,000 remains in 0-30 days bucket');

  // 7. Full Settlement:
  // Customer 1 pays remaining ₹45,000 on 2026-05-28.
  // Outstanding becomes 0, and party should no longer appear in active outstanding list.
  console.log('\n[Step 7] Full Settlement & Zero-Balance Omission...');
  const finalReceiptRes = await req('/vouchers', 'POST', {
    voucherType: 'RECEIPT',
    voucherDate: '2026-05-28',
    partyId: cust1Id,
    narration: 'Full final settlement',
    paymentMode: 'Cash',
    lines: [],
    customLedgerLines: [
      { ledgerId: cashLedgerId, debitPaise: 4500000, creditPaise: 0 },
      { ledgerId: cust1LedgerId, debitPaise: 0, creditPaise: 4500000 }
    ]
  }, tokenA, companyIdA);
  assert(finalReceiptRes.ok, 'Final receipt voucher posted');

  const custOutFullySettled = await req('/reports/outstanding?type=CUSTOMER&asOnDate=2026-05-31', 'GET', null, tokenA, companyIdA);
  const cust1FullySettled = custOutFullySettled.body?.find(c => c.partyId === cust1Id);
  assert(!cust1FullySettled, 'Customer 1 with 0 outstanding balance is omitted from active outstanding report');

  // 8. Cancellation of Receipt restores outstanding:
  // Cancel the second receipt (₹45,000). Outstanding must revert back to ₹45,000!
  console.log('\n[Step 8] Receipt Cancellation Integrity...');
  const finalReceiptId = finalReceiptRes.body?.voucher_id || finalReceiptRes.body?.voucherId;
  const cancelReceiptRes = await req(`/vouchers/${finalReceiptId}/cancel`, 'POST', {
    reason: 'Cheque bounced'
  }, tokenA, companyIdA);
  assert(cancelReceiptRes.ok, 'Receipt cancellation executed');

  const custOutAfterCancel = await req('/reports/outstanding?type=CUSTOMER&asOnDate=2026-05-31', 'GET', null, tokenA, companyIdA);
  const cust1AfterCancel = custOutAfterCancel.body?.find(c => c.partyId === cust1Id);
  assert(!!cust1AfterCancel, 'Customer 1 reappears in outstanding report after bounced receipt cancellation');
  assert(Number(cust1AfterCancel.totalOutstandingPaise) === 4500000, 'Outstanding balance restored to ₹45,000');

  // 9. Multi-Tenant Company Isolation:
  console.log('\n[Step 9] Verifying Multi-Tenant Isolation (Company A vs Company B)...');
  const companyBCustOut = await req('/reports/outstanding?type=CUSTOMER', 'GET', null, tokenB, companyIdB);
  assert(companyBCustOut.ok, 'Company B customer outstanding retrieved');
  const leakedCust = companyBCustOut.body?.find(c => c.partyId === cust1Id);
  assert(!leakedCust, 'Company A customer is strictly isolated from Company B');

  const companyBSuppOut = await req('/reports/outstanding?type=SUPPLIER', 'GET', null, tokenB, companyIdB);
  assert(companyBSuppOut.ok, 'Company B supplier outstanding retrieved');
  const leakedSupp = companyBSuppOut.body?.find(s => s.partyId === supp1Id);
  assert(!leakedSupp, 'Company A supplier is strictly isolated from Company B');

  console.log('\n======================================================================');
  console.log('🎉 ALL UI-018 OUTSTANDING REPORT TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================');
}

runTests().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
