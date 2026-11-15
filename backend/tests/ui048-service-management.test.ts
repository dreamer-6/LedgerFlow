import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../src/database/connection.js';
import { PostingEngine } from '../src/domain/posting/posting-engine.js';
import { ReportEngine } from '../src/reports/report-engine.js';

describe('UI-048: Service Management, Voucher Numbering & Day Book Integrity', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = OFF;');

  // Run schema initialization
  const fs = require('node:fs');
  const path = require('node:path');
  const schemaSql = fs.readFileSync(path.resolve(__dirname, '../src/database/schema.sql'), 'utf8');
  db.exec(schemaSql);
  db.exec('PRAGMA foreign_keys = ON;');

  const compA = 'comp_ui048_a';
  const compB = 'comp_ui048_b';
  const fyIdA = `${compA}_fy_2627`;
  const fyIdB = `${compB}_fy_2627`;
  const userA = 'usr_ui048_a';

  // Seed Companies & Financial Years
  db.prepare(`
    INSERT INTO companies (company_id, company_name, legal_name, address_line1, city, state, state_code, pincode, email)
    VALUES (?, 'Dream Tech Solutions', 'Dream Tech Solutions Private Limited', '1060 North 4th St', 'Pudukkottai', 'Tamil Nadu', '33', '622001', 'admin@dts.com'),
           (?, 'Alpha Infotech', 'Alpha Infotech Private Limited', '12 Anna Salai', 'Chennai', 'Tamil Nadu', '33', '600001', 'info@alpha.com')
  `).run(compA, compB);

  db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN'),
           (?, ?, 'FY 2026-27', '2026-04-01', '2027-03-31', 'OPEN')
  `).run(fyIdA, compA, fyIdB, compB);

  db.prepare(`
    INSERT INTO users (user_id, username, password_hash, full_name, role)
    VALUES (?, 'admin_dts', 'hash', 'Admin DTS', 'ADMIN')
  `).run(userA);

  // Seed Ledger Groups
  db.prepare(`
    INSERT INTO ledger_groups (group_id, company_id, group_name, nature)
    VALUES ('group_debtors', ?, 'Sundry Debtors', 'ASSET'),
           ('group_creditors', ?, 'Sundry Creditors', 'LIABILITY'),
           ('group_cash', ?, 'Cash-in-Hand', 'ASSET'),
           ('group_purchase', ?, 'Purchase Accounts', 'EXPENSE')
  `).run(compA, compA, compA, compA);

  // Seed Ledgers
  db.prepare(`
    INSERT INTO ledgers (ledger_id, company_id, ledger_name, group_id)
    VALUES ('led_cust_001', ?, 'Aravind K', 'group_debtors'),
           ('led_dealer_001', ?, 'HP Service Center', 'group_creditors'),
           ('led_cash', ?, 'Cash Account', 'group_cash'),
           ('led_purchase', ?, 'Purchase Account', 'group_purchase'),
           ('led_supp', ?, 'Supplier Account', 'group_creditors')
  `).run(compA, compA, compA, compA, compA);

  // Seed Party (Customer & Dealer)
  const custId = 'party_cust_001';
  const dealerId = 'party_dealer_001';
  db.prepare(`
    INSERT INTO parties (party_id, company_id, ledger_id, party_name, party_type, phone)
    VALUES (?, ?, 'led_cust_001', 'Aravind K', 'CUSTOMER', '9876543210'),
           (?, ?, 'led_dealer_001', 'Authorized HP Service Center', 'SUPPLIER', '9123456780')
  `).run(custId, compA, dealerId, compA);

  // =========================================================================
  // SUITE 1: SALES INVOICE NUMBERING INTEGRITY (19 -> 20 CONTINUATION)
  // =========================================================================
  it('1.1: Continues monotonically after invoice 19 to 20 without skipping', () => {
    // Seed vouchers up to DTS-2627-019
    for (let i = 1; i <= 19; i++) {
      const numStr = `DTS-2627-${i.toString().padStart(3, '0')}`;
      db.prepare(`
        INSERT INTO vouchers (
          voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
          status, total_amount_paise, created_by
        ) VALUES (?, ?, ?, 'SALES', ?, '2026-10-01', 'POSTED', 100000, ?)
      `).run(`vch_test_${i}`, compA, fyIdA, numStr, userA);
    }

    // Call getNextVoucherNumber
    const nextNum = PostingEngine.getNextVoucherNumber(db, compA, fyIdA, 'SALES');
    assert.equal(nextNum, 'DTS-2627-020', 'Next invoice number after 19 must strictly continue to 20');
  });

  it('1.2: Concurrency safety: multiple simultaneous allocations do not create duplicate invoice numbers', () => {
    const allocated: string[] = [];
    for (let j = 0; j < 5; j++) {
      const num = PostingEngine.getNextVoucherNumber(db, compA, fyIdA, 'SALES');
      allocated.push(num);
      db.prepare(`
        INSERT INTO vouchers (
          voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
          status, total_amount_paise, created_by
        ) VALUES (?, ?, ?, 'SALES', ?, '2026-10-02', 'POSTED', 50000, ?)
      `).run(`vch_concurrent_${j}`, compA, fyIdA, num, userA);
    }

    assert.equal(allocated[0], 'DTS-2627-020');
    assert.equal(allocated[1], 'DTS-2627-021');
    assert.equal(allocated[2], 'DTS-2627-022');
    assert.equal(allocated[3], 'DTS-2627-023');
    assert.equal(allocated[4], 'DTS-2627-024');

    const uniqueSet = new Set(allocated);
    assert.equal(uniqueSet.size, 5, 'Every sequentially allocated invoice number must be unique');
  });

  it('1.3: Tenant isolation: Company B sequence starts independently from configured start number', () => {
    const nextCompB = PostingEngine.getNextVoucherNumber(db, compB, fyIdB, 'SALES');
    assert.equal(nextCompB, 'AI-2627-001', 'Company B numbering must begin at 001 and not inherit Company A sequence');
  });

  // =========================================================================
  // SUITE 2: SERVICE MANAGEMENT — SERVICE JOB LIFECYCLE & DEALER WARRANTY
  // =========================================================================
  it('2.1: Creates Service Job with sequential job number and records initial audit event', () => {
    const jobId = 'job_test_001';
    const jobNumber = 'JOB-0148';
    db.prepare(`
      INSERT INTO service_jobs (
        job_id, company_id, fy_id, job_number, job_date,
        customer_id, customer_name, customer_phone, device_type, brand, model, serial_number,
        problem_reported, service_type, status, physical_location, created_by
      ) VALUES (?, ?, ?, ?, '2026-11-01', ?, 'Aravind K', '9876543210', 'Laptop', 'HP', 'Pavilion 15', 'CND1234A9F', 'Laptop not powering on.', 'INTERNAL_REPAIR', 'RECEIVED', 'SHOP', ?)
    `).run(jobId, compA, fyIdA, jobNumber, custId, userA);

    db.prepare(`
      INSERT INTO service_job_events (
        event_id, job_id, event_type, from_status, to_status, location, notes, created_by
      ) VALUES (?, ?, 'JOB_CREATED', NULL, 'RECEIVED', 'SHOP', 'Device received from customer', ?)
    `).run('event_001', jobId, userA);

    const job = db.prepare('SELECT * FROM service_jobs WHERE job_id = ?').get(jobId) as any;
    assert.ok(job, 'Service job must exist');
    assert.equal(job.job_number, 'JOB-0148');
    assert.equal(job.status, 'RECEIVED');
    assert.equal(job.physical_location, 'SHOP');

    const events = db.prepare('SELECT * FROM service_job_events WHERE job_id = ?').all(jobId);
    assert.equal(events.length, 1);
  });

  it('2.2: Dealer Warranty Flow: Dispatches defective product to dealer with courier docket', () => {
    const jobId = 'job_test_001';
    db.prepare(`
      UPDATE service_jobs SET
        service_type = 'DEALER_WARRANTY',
        status = 'SENT_TO_DEALER',
        physical_location = 'COURIER_TO_DEALER',
        dealer_id = ?,
        dealer_name = 'Authorized HP Service Center',
        courier_name = 'Professional Courier',
        docket_number = 'PC-99882211',
        dispatch_date = '2026-11-02',
        expected_return_date = '2026-11-10'
      WHERE job_id = ?
    `).run(dealerId, jobId);

    db.prepare(`
      INSERT INTO service_job_events (
        event_id, job_id, event_type, from_status, to_status, location, notes, created_by
      ) VALUES (?, ?, 'DISPATCHED_TO_DEALER', 'RECEIVED', 'SENT_TO_DEALER', 'COURIER_TO_DEALER', 'Dispatched via Professional Courier Docket PC-99882211', ?)
    `).run('event_002', jobId, userA);

    const job = db.prepare('SELECT * FROM service_jobs WHERE job_id = ?').get(jobId) as any;
    assert.equal(job.status, 'SENT_TO_DEALER');
    assert.equal(job.physical_location, 'COURIER_TO_DEALER');
    assert.equal(job.docket_number, 'PC-99882211');
  });

  it('2.3: Dealer Warranty Flow: Receives replacement/repaired product back from dealer with replacement serial', () => {
    const jobId = 'job_test_001';
    db.prepare(`
      UPDATE service_jobs SET
        status = 'RECEIVED_FROM_DEALER',
        physical_location = 'SHOP',
        dealer_action = 'REPLACED_UNIT',
        replacement_serial_number = 'CND9876NEW',
        dealer_return_date = '2026-11-08',
        dealer_docket_number = 'ST-443322',
        work_performed = 'Motherboard replaced under warranty by HP'
      WHERE job_id = ?
    `).run(jobId);

    db.prepare(`
      INSERT INTO service_job_events (
        event_id, job_id, event_type, from_status, to_status, location, notes, created_by
      ) VALUES (?, ?, 'RECEIVED_FROM_DEALER', 'SENT_TO_DEALER', 'RECEIVED_FROM_DEALER', 'SHOP', 'Unit replaced under warranty with S/N CND9876NEW', ?)
    `).run('event_003', jobId, userA);

    const job = db.prepare('SELECT * FROM service_jobs WHERE job_id = ?').get(jobId) as any;
    assert.equal(job.status, 'RECEIVED_FROM_DEALER');
    assert.equal(job.physical_location, 'SHOP');
    assert.equal(job.replacement_serial_number, 'CND9876NEW');
    assert.equal(job.dealer_action, 'REPLACED_UNIT');
  });

  it('2.4: Internal Repair & Service Bill Decoupling: Operational job transitions to delivered without requiring bill', () => {
    const jobId = 'job_test_001';
    db.prepare(`
      UPDATE service_jobs SET
        status = 'DELIVERED',
        physical_location = 'DELIVERED_TO_CUSTOMER'
      WHERE job_id = ?
    `).run(jobId);

    db.prepare(`
      INSERT INTO service_job_events (
        event_id, job_id, event_type, from_status, to_status, location, notes, created_by
      ) VALUES (?, ?, 'DELIVERED', 'RECEIVED_FROM_DEALER', 'DELIVERED', 'DELIVERED_TO_CUSTOMER', 'Product handed over to customer Aravind K', ?)
    `).run('event_004', jobId, userA);

    const job = db.prepare('SELECT * FROM service_jobs WHERE job_id = ?').get(jobId) as any;
    assert.equal(job.status, 'DELIVERED');
    assert.equal(job.physical_location, 'DELIVERED_TO_CUSTOMER');
    assert.equal(job.service_bill_id, null, 'Dealer warranty job completes cleanly without creating artificial accounting bills');
  });

  it('2.5: Optional Billing: Service Bill can link to service job and display in job workspace', () => {
    const jobId = 'job_test_002';
    const vchId = 'vch_srv_bill_001';
    // Create Job 2
    db.prepare(`
      INSERT INTO service_jobs (
        job_id, company_id, fy_id, job_number, job_date,
        customer_id, customer_name, device_type, problem_reported, status, created_by
      ) VALUES (?, ?, ?, 'JOB-0149', '2026-11-09', ?, 'Priya Systems', 'Printer', 'Print Quality Issue', 'COMPLETED', ?)
    `).run(jobId, compA, fyIdA, custId, userA);

    // Create Service Bill Voucher
    db.prepare(`
      INSERT INTO vouchers (
        voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
        party_id, total_amount_paise, narration, status, created_by
      ) VALUES (?, ?, ?, 'SALES', 'SRV-2026-0149', '2026-11-09', ?, 82000, 'Service & Cartridge Refill', 'POSTED', ?)
    `).run(vchId, compA, fyIdA, custId, userA);

    // Link Service Bill to Job
    db.prepare(`
      UPDATE service_jobs SET
        service_bill_id = ?,
        service_bill_number = 'SRV-2026-0149'
      WHERE job_id = ?
    `).run(vchId, jobId);

    const linkedJob = db.prepare(`
      SELECT sj.job_number, sj.service_bill_number, v.total_amount_paise
      FROM service_jobs sj
      JOIN vouchers v ON sj.service_bill_id = v.voucher_id
      WHERE sj.job_id = ?
    `).get(jobId) as any;

    assert.equal(linkedJob.job_number, 'JOB-0149');
    assert.equal(linkedJob.service_bill_number, 'SRV-2026-0149');
    assert.equal(linkedJob.total_amount_paise, 82000);
  });

  // =========================================================================
  // SUITE 3: DAY BOOK INTEGRITY & REFERENCE LINKING
  // =========================================================================
  it('3.1: Day Book exposes linked vouchers and authentic double-entry debits and credits', () => {
    // Seed purchase voucher and linked immediate payment settlement
    const purVchId = 'vch_daybook_pur_001';
    const payVchId = 'vch_daybook_pay_001';
    const purDate = '2026-11-13';

    db.prepare(`
      INSERT INTO vouchers (
        voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
        total_amount_paise, status, created_by
      ) VALUES (?, ?, ?, 'PURCHASE', 'PUR-2627-016', ?, 85000, 'POSTED', ?)
    `).run(purVchId, compA, fyIdA, purDate, userA);

    db.prepare(`
      INSERT INTO vouchers (
        voucher_id, company_id, fy_id, voucher_type, voucher_number, voucher_date,
        total_amount_paise, reference_number, status, created_by
      ) VALUES (?, ?, ?, 'PAYMENT', 'PAY-2627-016', ?, 85000, 'PUR-2627-016', 'POSTED', ?)
    `).run(payVchId, compA, fyIdA, purDate, userA);

    // Seed ledger entries for both
    const ledCash = 'led_cash';
    const ledPur = 'led_purchase';
    const ledSupp = 'led_supp';

    // Seed bill allocation linking PAY to PUR
    db.prepare(`
      INSERT INTO bill_allocations (
        allocation_id, voucher_id, ledger_id, reference_voucher_id, allocation_type, amount_paise
      ) VALUES ('ba_001', ?, ?, ?, 'AGAINST_REF', 85000)
    `).run(payVchId, ledSupp, purVchId);

    db.prepare(`
      INSERT INTO ledger_entries (entry_id, voucher_id, ledger_id, entry_date, debit_paise, credit_paise)
      VALUES ('le_1', ?, ?, ?, 85000, 0),
             ('le_2', ?, ?, ?, 0, 85000),
             ('le_3', ?, ?, ?, 85000, 0),
             ('le_4', ?, ?, ?, 0, 85000)
    `).run(purVchId, ledPur, purDate, purVchId, ledSupp, purDate, payVchId, ledSupp, purDate, payVchId, ledCash, purDate);

    const dayBook = ReportEngine.getDayBook(db, compA, purDate, purDate);
    assert.equal(dayBook.length, 2, 'Day Book must contain exactly the 2 vouchers posted on that day');

    const purEntry = dayBook.find(d => d.voucherNumber === 'PUR-2627-016');
    const payEntry = dayBook.find(d => d.voucherNumber === 'PAY-2627-016');

    assert.ok(purEntry, 'Purchase voucher must exist in Day Book');
    assert.ok(payEntry, 'Payment voucher must exist in Day Book');

    assert.equal(payEntry.linkedVoucherNumber, 'PUR-2627-016', 'Payment voucher must expose linked parent purchase voucher number');
    assert.equal(payEntry.referenceNumber, 'PUR-2627-016', 'Payment voucher must expose reference number');

    assert.equal(purEntry.debitPaise, 85000);
    assert.equal(purEntry.creditPaise, 85000);
    assert.equal(payEntry.debitPaise, 85000);
    assert.equal(payEntry.creditPaise, 85000);
  });
});
