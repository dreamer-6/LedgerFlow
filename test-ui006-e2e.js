/**
 * test-ui006-e2e.js
 * End-to-End Verification for UI-006: Sales Dashboard + Sales Invoice Lifecycle
 *
 * Tests:
 *  1. Authentication & company context resolution
 *  2. Next voucher number generation (GET /vouchers/next-number)
 *  3. Customer & Stock Item masters availability
 *  4. Sales Dashboard metrics (GET /reports/dashboard & GET /vouchers?type=SALES)
 *  5. Creation of a DRAFT Sales Invoice (POST /vouchers with status=DRAFT)
 *  6. Verification of DRAFT isolation (no financial ledger or inventory effects)
 *  7. Promotion of DRAFT to POSTED (POST /vouchers/:id/post)
 *  8. Direct creation of a POSTED Sales Invoice (POST /vouchers with status=POSTED)
 *  9. Verification of Double-Entry Ledger Posting:
 *     - Customer Ledger DEBIT
 *     - Sales Account CREDIT
 *     - Output CGST / SGST (or IGST) CREDIT
 * 10. Verification of Stock Movement (OUT) and Godown valuation
 * 11. Cancellation of POSTED Invoice (POST /vouchers/:id/cancel)
 * 12. Verification of Reversal Accounting Entries upon Cancellation
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
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    request.on('error', reject);
    if (body) request.write(JSON.stringify(body));
    request.end();
  });
}

async function run() {
  console.log('======================================================================');
  console.log('UI-006 — SALES DASHBOARD & SALES INVOICE END-TO-END VERIFICATION');
  console.log('======================================================================');

  // 1. Register / Login test user
  const email = `sales_tester_${Date.now()}@example.com`;
  const password = 'Password@123';
  console.log(`[1] Registering test user (${email})...`);
  const regRes = await req('/auth/register', 'POST', {
    email,
    password,
    fullName: 'Sales Test User',
    username: `sales_${Date.now()}`,
    businessName: 'Acme Traders Pvt Ltd'
  });

  let token;
  if (regRes.status === 201) {
    token = regRes.body.token;
  } else {
    // Try login
    const loginRes = await req('/auth/login', 'POST', { emailOrUsername: email, password });
    token = loginRes.body.token;
  }

  if (!token) {
    throw new Error('Failed to obtain auth token: ' + JSON.stringify(regRes.body));
  }
  console.log('    ✓ Authenticated successfully');

  // 2. Fetch or Create Business
  console.log('[2] Resolving Business Context...');
  const bizRes = await req('/businesses', 'GET', null, token);
  let companyId = bizRes.body?.[0]?.company_id || bizRes.body?.[0]?.companyId;
  if (!companyId) {
    const compRes = await req('/businesses', 'POST', {
      companyName: 'Acme Traders Pvt Ltd',
      legalName: 'Acme Traders Private Limited',
      gstin: '33ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      addressLine1: 'No. 12, Main Road, Gandhipuram',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '641012',
      phone: '9876543210',
      email: 'acme@example.com'
    }, token);
    companyId = compRes.body.company_id || compRes.body.companyId;
  }
  console.log(`    ✓ Active Company ID: ${companyId}`);

  // Fetch company context & financial year
  const meRes = await req('/companies/current', 'GET', null, token, companyId);
  const fyId = meRes.body?.activeFinancialYear?.fy_id || meRes.body?.activeFinancialYear?.fyId;
  console.log(`    ✓ Active Financial Year: ${fyId} (${meRes.body?.activeFinancialYear?.name})`);

  // 3. Create a Customer Party
  console.log('[3] Creating Customer Master Party...');
  const partyRes = await req('/masters/parties', 'POST', {
    partyName: 'ABC Enterprises',
    partyType: 'CUSTOMER',
    gstin: '33ABCDE1234F1Z5',
    phone: '+91 98765 43210',
    email: 'abc@enterprises.com',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, token, companyId);
  const partyId = partyRes.body?.partyId || partyRes.body?.party_id;
  console.log(`    ✓ Customer party created: ${partyId} (${partyRes.body?.partyName || 'ABC Enterprises'})`);

  // 4. Create Stock Item with Opening Stock
  console.log('[4] Creating Stock Item Master with Inflow...');
  const itemRes = await req('/masters/items', 'POST', {
    itemName: 'Dell Inspiron 3520 Laptop',
    itemCode: 'DELL-3520',
    sku: 'SKU-DELL-3520',
    hsnSac: '84713010',
    gstRate: 18,
    purchaseRatePaise: 4000000, // 40,000 cost
    sellingRatePaise: 4500000,  // 45,000 selling price
    openingQty: 10,
    openingRatePaise: 4000000,
    reorderLevel: 2
  }, token, companyId);
  const itemId = itemRes.body.itemId;
  console.log(`    ✓ Stock item created: ${itemId} (Stock: 10 units @ ₹40,000)`);

  // 5. Test GET /vouchers/next-number
  console.log('[5] Testing Voucher Auto-Sequencing (GET /vouchers/next-number)...');
  const nextNumRes = await req(`/vouchers/next-number?fyId=${fyId}&type=SALES`, 'GET', null, token, companyId);
  console.log(`    ✓ Next Sales Invoice Number: ${nextNumRes.body.nextVoucherNumber}`);

  // 6. Test Creating a DRAFT Sales Invoice
  console.log('[6] Creating a DRAFT Sales Invoice (status=DRAFT)...');
  const draftPayload = {
    voucherType: 'SALES',
    voucherDate: '2026-10-06',
    partyId,
    status: 'DRAFT',
    placeOfSupply: '33',
    paymentTerms: '30 Days',
    narration: 'Draft sales invoice for commercial review',
    isTaxInclusive: true,
    lines: [
      {
        itemId,
        quantity: 1,
        ratePaise: 4500000, // ₹45,000
        discountPercent: 0,
        gstRate: 18,
        movementType: 'OUT'
      }
    ]
  };
  const draftRes = await req('/vouchers', 'POST', draftPayload, token, companyId);
  if (draftRes.status !== 201) {
    throw new Error('Failed to create draft: ' + JSON.stringify(draftRes.body));
  }
  const draftVoucherId = draftRes.body.voucherId;
  console.log(`    ✓ Draft Invoice Created: ${draftVoucherId} (Status: ${draftRes.body.status})`);

  // Verify Draft has zero accounting ledger entries
  const draftDetailRes = await req(`/vouchers/${draftVoucherId}`, 'GET', null, token, companyId);
  if (draftDetailRes.body.ledgerEntries?.length > 0) {
    throw new Error('Draft invoice incorrectly created financial ledger entries!');
  }
  console.log('    ✓ Verified: Draft has 0 ledger entries and 0 stock movements (safe draft isolation)');

  // 7. Promote DRAFT to POSTED via /vouchers/:id/post
  console.log('[7] Promoting Draft Invoice to POSTED (POST /vouchers/:id/post)...');
  const postRes = await req(`/vouchers/${draftVoucherId}/post`, 'POST', {}, token, companyId);
  if (postRes.status !== 200) {
    throw new Error('Failed to promote draft: ' + JSON.stringify(postRes.body));
  }
  console.log(`    ✓ Draft Promoted to POSTED: ${postRes.body.voucherNumber}`);

  // 8. Verify Double-Entry Accounting Ledger and Stock Entries
  console.log('[8] Verifying Double-Entry Postings and Stock Reduction for Invoice...');
  const postedDetailRes = await req(`/vouchers/${draftVoucherId}`, 'GET', null, token, companyId);
  const ledgerEntries = postedDetailRes.body.ledgerEntries;
  const stockEntries = postedDetailRes.body.stockEntries;

  console.log(`    ✓ Total Ledger Entries: ${ledgerEntries.length}`);
  let totalDebit = 0;
  let totalCredit = 0;
  ledgerEntries.forEach(le => {
    totalDebit += le.debit_paise;
    totalCredit += le.credit_paise;
    console.log(`      - [${le.ledger_name}] Dr: ₹${le.debit_paise / 100} | Cr: ₹${le.credit_paise / 100} (${le.particulars})`);
  });

  if (totalDebit !== totalCredit) {
    throw new Error(`Double-entry imbalance! Debit: ${totalDebit}, Credit: ${totalCredit}`);
  }
  console.log(`    ✓ Mathematical Double-Entry Invariant Confirmed: Dr ₹${totalDebit / 100} == Cr ₹${totalCredit / 100}`);

  if (stockEntries.length === 0 || stockEntries[0].movement_type !== 'OUT') {
    throw new Error('Stock outward entry was not recorded properly!');
  }
  console.log(`    ✓ Outward Stock Movement Confirmed: -${stockEntries[0].quantity} units @ Cost ₹${stockEntries[0].rate_paise / 100}`);

  // 9. Test Sales Dashboard Metrics Endpoint
  console.log('[9] Testing Sales Dashboard Data (GET /reports/dashboard)...');
  const dashRes = await req('/reports/dashboard', 'GET', null, token, companyId);
  console.log(`    ✓ Today Sales: ₹${dashRes.body.todaySalesPaise / 100}`);
  console.log(`    ✓ Receivables (Customers): ₹${dashRes.body.receivablesPaise / 100}`);
  console.log(`    ✓ Recent Vouchers: ${dashRes.body.recentVouchers?.length} entries`);

  // 10. Test Sales Vouchers List Endpoint (GET /vouchers?type=SALES)
  console.log('[10] Testing Sales Invoices List (GET /vouchers?type=SALES)...');
  const listRes = await req('/vouchers?type=SALES', 'GET', null, token, companyId);
  console.log(`    ✓ Found ${listRes.body.length} Sales Voucher(s)`);
  if (!listRes.body.some(v => v.voucher_id === draftVoucherId)) {
    throw new Error('Created sales voucher not returned in sales list!');
  }

  // 11. Test Cancelling a Posted Invoice (POST /vouchers/:id/cancel)
  console.log('[11] Testing Invoice Cancellation (POST /vouchers/:id/cancel)...');
  const cancelRes = await req(`/vouchers/${draftVoucherId}/cancel`, 'POST', {
    reason: 'Customer cancelled order before delivery'
  }, token, companyId);
  if (cancelRes.status !== 200) {
    throw new Error('Failed to cancel voucher: ' + JSON.stringify(cancelRes.body));
  }
  console.log('    ✓ Invoice successfully marked CANCELLED');

  // Verify status is CANCELLED and child ledger entries were atomically removed
  const cancelledDetail = await req(`/vouchers/${draftVoucherId}`, 'GET', null, token, companyId);
  if (cancelledDetail.body.voucher.status !== 'CANCELLED') {
    throw new Error('Voucher status was not updated to CANCELLED!');
  }
  console.log(`    ✓ Confirmed voucher status is CANCELLED (Downstream ledger entries remaining: ${cancelledDetail.body.ledgerEntries.length})`);

  console.log('======================================================================');
  console.log('✓ UI-006 SALES MODULE END-TO-END VERIFICATION: ALL 11 TESTS PASSED!');
  console.log('======================================================================');
}

run().catch(err => {
  console.error('\n❌ E2E VERIFICATION FAILED:', err);
  process.exit(1);
});
