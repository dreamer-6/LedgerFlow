/**
 * test-ui021-voucher-lifecycle.js — UI-021 Voucher Lifecycle, Soft-Hide/Unhide, Permanent Purge & Invoice Wordmark Verification Suite
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000/api';

async function req(endpoint, method = 'GET', body = null, token = null, companyId = null) {
  const url = new URL(BASE_URL + endpoint);
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', 'Connection': 'close' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (companyId) headers['x-company-id'] = companyId;

    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

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

    if (bodyStr) {
      request.write(bodyStr);
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
  console.log('UI-021: VOUCHER LIFECYCLE, HIDE/UNHIDE & PERMANENT PURGE VERIFICATION');
  console.log('======================================================================\n');

  const timestamp = Date.now();

  // 1. Authenticate Owner
  console.log('[Step 1] Registering Test Company & Owner...');
  const email = `ui021_owner_${timestamp}@example.com`;
  const reg = await req('/auth/register', 'POST', {
    email,
    password: 'Password@123',
    fullName: 'UI021 Test Owner',
    username: `ui021_${timestamp}`,
    businessName: `UI021 Enterprises ${timestamp}`
  });
  const token = reg.body?.token;
  assert(!!token, 'Owner registered with valid JWT');
  
  const bizRes = await req('/businesses', 'GET', null, token);
  const companyId = bizRes.body?.[0]?.company_id || bizRes.body?.[0]?.companyId;
  assert(!!companyId, `Company resolved: ${companyId}`);

  // 2. Test LedgerFlow Wordmark Preference Persistence
  console.log('\n[Step 2] Testing showLedgerflowWordmark Preference Persistence...');
  const initialInvoiceSettings = {
    default_template: 'Standard',
    showLedgerflowWordmark: true,
    show_hsn: true
  };
  const updateSettings = await req('/companies/current', 'PUT', {
    invoice_settings: initialInvoiceSettings
  }, token, companyId);
  assert(updateSettings.ok, 'PUT /companies/current persisted invoice_settings');

  const getCompany = await req('/companies/current', 'GET', null, token, companyId);
  assert(getCompany.ok, 'GET /companies/current succeeded');
  const comp = getCompany.body?.company || getCompany.body;
  let parsedSettings = typeof comp.invoice_settings === 'string' ? JSON.parse(comp.invoice_settings) : comp.invoice_settings;
  assert(parsedSettings.showLedgerflowWordmark === true, 'showLedgerflowWordmark persisted as true');

  // Toggle to false
  const updateSettingsFalse = await req('/companies/current', 'PUT', {
    invoice_settings: {
      ...parsedSettings,
      showLedgerflowWordmark: false
    }
  }, token, companyId);
  assert(updateSettingsFalse.ok, 'PUT /companies/current updated showLedgerflowWordmark to false');
  const getCompany2 = await req('/companies/current', 'GET', null, token, companyId);
  const comp2 = getCompany2.body?.company || getCompany2.body;
  let parsedSettings2 = typeof comp2.invoice_settings === 'string' ? JSON.parse(comp2.invoice_settings) : comp2.invoice_settings;
  assert(parsedSettings2.showLedgerflowWordmark === false, 'showLedgerflowWordmark persisted as false');

  // 3. Post a GST Sales Voucher
  console.log('\n[Step 3] Creating Masters and Posting Sales Voucher...');
  const unitsRes = await req('/masters/units', 'GET', null, token, companyId);
  assert(unitsRes.ok, 'Fetched Measurement Units');
  const units = unitsRes.body || [];
  const nosUnit = units.find(u => u.symbol === 'Nos') || units[0];
  const unitId = nosUnit.unit_id || nosUnit.unitId || nosUnit.id;

  const itemRes = await req('/masters/items', 'POST', {
    itemName: `Enterprise Server ${timestamp}`,
    itemCode: `SRV-${timestamp}`,
    hsnSac: '847150',
    unitId: unitId,
    gstRate: 18,
    sellingRatePaise: 5000000,
    purchaseRatePaise: 3000000
  }, token, companyId);
  assert(itemRes.ok, 'Created Stock Item');
  const itemId = itemRes.body?.item_id || itemRes.body?.itemId || itemRes.body?.id;

  const partyRes = await req('/masters/parties', 'POST', {
    partyName: `UI021 Client Ltd ${timestamp}`,
    partyType: 'CUSTOMER',
    gstin: '33AAAAA0000A1Z5',
    state: 'Tamil Nadu',
    stateCode: '33'
  }, token, companyId);
  assert(partyRes.ok, 'Created Customer Party');
  const partyId = partyRes.body?.party_id || partyRes.body?.partyId || partyRes.body?.id;

  const voucherRes = await req('/vouchers', 'POST', {
    voucherType: 'SALES',
    voucherDate: '2026-10-13',
    partyId: partyId,
    narration: 'UI-021 Lifecycle Test Voucher',
    allowNegativeStock: true,
    lines: [
      {
        itemId: itemId,
        description: 'Enterprise Server Node',
        quantity: 1,
        ratePaise: 5000000,
        gstRate: 18
      }
    ]
  }, token, companyId);
  assert(voucherRes.ok, `Posted Sales Voucher: status ${voucherRes.status}`);
  const voucherId = voucherRes.body?.voucher_id || voucherRes.body?.voucherId || voucherRes.body?.voucher?.voucher_id;
  assert(!!voucherId, `Voucher ID resolved: ${voucherId}`);

  // 4. Test Invariant: Direct DELETE on POSTED Voucher MUST Return 405
  console.log('\n[Step 4] Testing Suite 5 Invariant: Direct DELETE on POSTED Voucher Returns 405...');
  const deletePosted = await req(`/vouchers/${voucherId}`, 'DELETE', {}, token, companyId);
  assert(deletePosted.status === 405, `Direct DELETE on POSTED voucher returned HTTP 405 Method Not Allowed (got: ${deletePosted.status})`);

  // 5. Test Soft-Hide and Unhide
  console.log('\n[Step 5] Testing Soft-Hide and Unhide Endpoints...');
  const hideRes = await req(`/vouchers/${voucherId}/hide`, 'POST', {}, token, companyId);
  assert(hideRes.ok, `POST /vouchers/${voucherId}/hide succeeded`);

  // Verify default list excludes hidden voucher
  const listNormal = await req('/vouchers', 'GET', null, token, companyId);
  const vouchersNormal = listNormal.body?.data || listNormal.body || [];
  const foundInNormal = vouchersNormal.some(v => (v.voucher_id || v.id) === voucherId);
  assert(!foundInNormal, 'Hidden voucher is excluded from default GET /vouchers');

  // Verify list with includeHidden=true includes it
  const listHidden = await req('/vouchers?includeHidden=true', 'GET', null, token, companyId);
  const vouchersHidden = listHidden.body?.data || listHidden.body || [];
  const foundInHidden = vouchersHidden.find(v => (v.voucher_id || v.id) === voucherId);
  assert(!!foundInHidden, 'Hidden voucher is returned when includeHidden=true');
  assert(Number(foundInHidden.is_hidden) === 1, 'is_hidden flag is 1');

  // Unhide the voucher
  const unhideRes = await req(`/vouchers/${voucherId}/unhide`, 'POST', {}, token, companyId);
  assert(unhideRes.ok, `POST /vouchers/${voucherId}/unhide succeeded`);

  const listNormalAfterUnhide = await req('/vouchers', 'GET', null, token, companyId);
  const vouchersAfterUnhide = listNormalAfterUnhide.body?.data || listNormalAfterUnhide.body || [];
  const foundNormalAgain = vouchersAfterUnhide.some(v => (v.voucher_id || v.id) === voucherId);
  assert(foundNormalAgain, 'Unhidden voucher reappears in default GET /vouchers');

  // 6. Test Voucher Cancellation
  console.log('\n[Step 6] Testing Voucher Cancellation...');
  const cancelRes = await req(`/vouchers/${voucherId}/cancel`, 'POST', {
    cancellation_reason: 'Testing cancellation lifecycle flow'
  }, token, companyId);
  assert(cancelRes.ok, `POST /vouchers/${voucherId}/cancel succeeded`);

  // Verify list with showCancelled=false excludes cancelled voucher
  const listExcludingCancelled = await req('/vouchers?showCancelled=false', 'GET', null, token, companyId);
  const vouchersDefault = listExcludingCancelled.body?.data || listExcludingCancelled.body || [];
  const foundCancelledInDefault = vouchersDefault.some(v => (v.voucher_id || v.id) === voucherId);
  assert(!foundCancelledInDefault, 'Cancelled voucher is excluded when showCancelled=false');

  // Verify showCancelled=true includes it
  const listWithCancelled = await req('/vouchers?showCancelled=true', 'GET', null, token, companyId);
  const vouchersWithCancelled = listWithCancelled.body?.data || listWithCancelled.body || [];
  const cancelledVoucher = vouchersWithCancelled.find(v => (v.voucher_id || v.id) === voucherId);
  assert(!!cancelledVoucher, 'Cancelled voucher returned when showCancelled=true');
  assert(cancelledVoucher.status === 'CANCELLED', 'Voucher status is CANCELLED');

  // 7. Test Permanent Deletion on CANCELLED Voucher with Audit Tombstone
  console.log('\n[Step 7] Testing Permanent Deletion of CANCELLED Voucher...');
  const deleteCancelled = await req(`/vouchers/${voucherId}`, 'DELETE', {
    reason: 'Verified test purge of cancelled voucher'
  }, token, companyId);
  assert(deleteCancelled.ok, `DELETE /vouchers/${voucherId} on CANCELLED voucher succeeded with status 200`);
  assert(deleteCancelled.body?.tombstoneId || deleteCancelled.body?.success, 'Audit tombstone logged on deletion');

  // Verify voucher is now completely gone
  const getDeleted = await req(`/vouchers/${voucherId}`, 'GET', null, token, companyId);
  assert(getDeleted.status === 404, `GET /vouchers/${voucherId} now returns HTTP 404 Not Found`);

  console.log('\n======================================================================');
  console.log('✅ ALL UI-021 VOUCHER LIFECYCLE & WORDMARK TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================================\n');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
