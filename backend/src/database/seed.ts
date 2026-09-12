import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export function seedInitialData(db: DatabaseSync) {
  // Check if company already exists
  const existingCompany = db.prepare('SELECT company_id FROM companies LIMIT 1').get() as { company_id: string } | undefined;
  if (existingCompany) {
    return existingCompany.company_id;
  }

  const companyId = 'comp_default_01';
  const fyId = 'fy_2026_27';

  // 1. Create Default Company (Tamil Nadu, India)
  db.prepare(`
    INSERT INTO companies (
      company_id, company_name, legal_name, gstin, pan,
      address_line1, address_line2, city, state, state_code,
      pincode, country, phone, email, currency, currency_symbol,
      bank_name, bank_account_no, bank_ifsc, bank_branch, terms_and_conditions
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `).run(
    companyId,
    'Apex Technologies Enterprises',
    'Apex Technologies Pvt Ltd',
    '33AAAAA0000A1Z5',
    'AAAAA0000A',
    '123, Mount Road, Anna Salai',
    'Commercial Plaza, Suite 402',
    'Chennai',
    'Tamil Nadu',
    '33',
    '600002',
    'India',
    '+91 98765 43210',
    'accounts@apextech.in',
    'INR',
    '₹',
    'State Bank of India',
    '12345678901234',
    'SBIN0000123',
    'Chennai Main Branch',
    '1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. will be charged if bill is not paid within due date.\n3. Subject to Chennai jurisdiction.'
  );

  // 2. Create Active Financial Year (2026 - 2027)
  db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, 'OPEN')
  `).run(fyId, companyId, '2026-2027', '2026-04-01', '2027-03-31');

  // 3. Create Default Units
  const units = [
    { id: 'unit_nos', name: 'Numbers', symbol: 'Nos', decimals: 0 },
    { id: 'unit_pcs', name: 'Pieces', symbol: 'Pcs', decimals: 0 },
    { id: 'unit_kg', name: 'Kilograms', symbol: 'Kg', decimals: 3 },
    { id: 'unit_box', name: 'Boxes', symbol: 'Box', decimals: 0 },
    { id: 'unit_mtr', name: 'Meters', symbol: 'Mtr', decimals: 2 }
  ];
  for (const u of units) {
    db.prepare('INSERT OR IGNORE INTO units (unit_id, company_id, unit_name, symbol, decimal_places) VALUES (?, ?, ?, ?, ?)')
      .run(u.id, companyId, u.name, u.symbol, u.decimals);
  }

  // 4. Create Default Godown
  db.prepare('INSERT OR IGNORE INTO godowns (godown_id, company_id, godown_name, location, is_default) VALUES (?, ?, ?, ?, 1)')
    .run('godown_main', companyId, 'Main Warehouse', 'Ground Floor, Central Store');

  // 5. Create Standard Ledger Groups
  const groups = [
    { id: 'grp_assets', parent: null, name: 'Assets', nature: 'ASSET', affects_gp: 0 },
    { id: 'grp_current_assets', parent: 'grp_assets', name: 'Current Assets', nature: 'ASSET', affects_gp: 0 },
    { id: 'grp_bank', parent: 'grp_current_assets', name: 'Bank Accounts', nature: 'ASSET', affects_gp: 0 },
    { id: 'grp_cash', parent: 'grp_current_assets', name: 'Cash-in-Hand', nature: 'ASSET', affects_gp: 0 },
    { id: 'grp_debtors', parent: 'grp_current_assets', name: 'Sundry Debtors', nature: 'ASSET', affects_gp: 0 },
    { id: 'grp_stock', parent: 'grp_current_assets', name: 'Stock-in-Hand', nature: 'ASSET', affects_gp: 0 },

    { id: 'grp_liabilities', parent: null, name: 'Liabilities', nature: 'LIABILITY', affects_gp: 0 },
    { id: 'grp_current_liab', parent: 'grp_liabilities', name: 'Current Liabilities', nature: 'LIABILITY', affects_gp: 0 },
    { id: 'grp_creditors', parent: 'grp_current_liab', name: 'Sundry Creditors', nature: 'LIABILITY', affects_gp: 0 },
    { id: 'grp_duties_taxes', parent: 'grp_current_liab', name: 'Duties & Taxes', nature: 'LIABILITY', affects_gp: 0 },

    { id: 'grp_equity', parent: null, name: 'Equity & Capital', nature: 'EQUITY', affects_gp: 0 },
    { id: 'grp_capital', parent: 'grp_equity', name: 'Capital Account', nature: 'EQUITY', affects_gp: 0 },

    { id: 'grp_income', parent: null, name: 'Income', nature: 'INCOME', affects_gp: 1 },
    { id: 'grp_sales', parent: 'grp_income', name: 'Sales Accounts', nature: 'INCOME', affects_gp: 1 },
    { id: 'grp_indirect_income', parent: 'grp_income', name: 'Indirect Incomes', nature: 'INCOME', affects_gp: 0 },

    { id: 'grp_expense', parent: null, name: 'Expenses', nature: 'EXPENSE', affects_gp: 1 },
    { id: 'grp_purchase', parent: 'grp_expense', name: 'Purchase Accounts', nature: 'EXPENSE', affects_gp: 1 },
    { id: 'grp_direct_expense', parent: 'grp_expense', name: 'Direct Expenses', nature: 'EXPENSE', affects_gp: 1 },
    { id: 'grp_indirect_expense', parent: 'grp_expense', name: 'Indirect Expenses', nature: 'EXPENSE', affects_gp: 0 }
  ];

  for (const g of groups) {
    db.prepare('INSERT OR IGNORE INTO ledger_groups (group_id, company_id, parent_group_id, group_name, nature, affects_gross_profit) VALUES (?, ?, ?, ?, ?, ?)')
      .run(g.id, companyId, g.parent, g.name, g.nature, g.affects_gp);
  }

  // 6. Create Standard Core Ledgers
  const standardLedgers = [
    // Cash & Bank
    { id: 'led_cash', group: 'grp_cash', name: 'Cash', code: '1001', bal: 2500000, type: 'DR' }, // ₹25,000 opening
    { id: 'led_sbi_bank', group: 'grp_bank', name: 'SBI Current Account', code: '1002', bal: 10000000, type: 'DR' }, // ₹1,00,000 opening
    // Capital
    { id: 'led_capital', group: 'grp_capital', name: 'Proprietor Capital', code: '3001', bal: 12500000, type: 'CR' }, // ₹1,25,000 opening
    // Trading
    { id: 'led_sales', group: 'grp_sales', name: 'Sales Account', code: '4001', bal: 0, type: 'CR' },
    { id: 'led_sales_return', group: 'grp_sales', name: 'Sales Return Account', code: '4002', bal: 0, type: 'DR' },
    { id: 'led_purchase', group: 'grp_purchase', name: 'Purchase Account', code: '5001', bal: 0, type: 'DR' },
    { id: 'led_purchase_return', group: 'grp_purchase', name: 'Purchase Return Account', code: '5002', bal: 0, type: 'CR' },
    { id: 'led_cogs', group: 'grp_direct_expense', name: 'Cost of Goods Sold', code: '5003', bal: 0, type: 'DR' },
    { id: 'led_inventory', group: 'grp_stock', name: 'Inventory Asset', code: '1003', bal: 0, type: 'DR' },
    // GST Output Liabilities
    { id: 'led_output_cgst', group: 'grp_duties_taxes', name: 'Output CGST', code: '2101', bal: 0, type: 'CR' },
    { id: 'led_output_sgst', group: 'grp_duties_taxes', name: 'Output SGST', code: '2102', bal: 0, type: 'CR' },
    { id: 'led_output_igst', group: 'grp_duties_taxes', name: 'Output IGST', code: '2103', bal: 0, type: 'CR' },
    // GST Input Tax Credits
    { id: 'led_input_cgst', group: 'grp_duties_taxes', name: 'Input CGST', code: '2201', bal: 0, type: 'DR' },
    { id: 'led_input_sgst', group: 'grp_duties_taxes', name: 'Input SGST', code: '2202', bal: 0, type: 'DR' },
    { id: 'led_input_igst', group: 'grp_duties_taxes', name: 'Input IGST', code: '2203', bal: 0, type: 'DR' },
    // Round Off & Expenses
    { id: 'led_round_off', group: 'grp_indirect_expense', name: 'Round Off Account', code: '5999', bal: 0, type: 'DR' },
    { id: 'led_rent_expense', group: 'grp_indirect_expense', name: 'Rent Expense', code: '5101', bal: 0, type: 'DR' },
    { id: 'led_electricity', group: 'grp_indirect_expense', name: 'Electricity Expense', code: '5102', bal: 0, type: 'DR' }
  ];

  for (const l of standardLedgers) {
    db.prepare(`
      INSERT OR IGNORE INTO ledgers (
        ledger_id, company_id, group_id, ledger_name, code,
        opening_balance_paise, opening_balance_type, is_party, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(l.id, companyId, l.group, l.name, l.code, l.bal, l.type);
  }

  // 7. Seed Admin User
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('admin123', salt);
  db.prepare(`
    INSERT OR IGNORE INTO users (user_id, username, password_hash, full_name, role)
    VALUES ('usr_admin', 'admin', ?, 'System Administrator', 'ADMIN')
  `).run(passwordHash);

  // 8. Seed a Sample Customer and Supplier for immediate business readiness
  const sampleCustomerLedger = 'led_cust_sample_01';
  db.prepare(`
    INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'grp_debtors', 'Customer A (Chennai)', 0, 'DR', 1)
  `).run(sampleCustomerLedger, companyId);

  db.prepare(`
    INSERT OR IGNORE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person)
    VALUES ('party_cust_01', ?, ?, 'CUSTOMER', 'Customer A (Chennai)', '33ABCDE1234F1Z5', 'ABCDE1234F', '+91 94440 11223', 'customer.a@example.com', 'Aravind Kumar')
  `).run(companyId, sampleCustomerLedger);

  db.prepare(`
    INSERT OR IGNORE INTO party_addresses (address_id, party_id, address_type, address_line1, city, state, state_code, pincode, is_default)
    VALUES ('addr_cust_01', 'party_cust_01', 'BOTH', '54, TTK Road, Alwarpet', 'Chennai', 'Tamil Nadu', '33', '600018', 1)
  `).run();

  const sampleSupplierLedger = 'led_supp_sample_01';
  db.prepare(`
    INSERT OR IGNORE INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type, is_party)
    VALUES (?, ?, 'grp_creditors', 'Supplier A (Bangalore)', 0, 'CR', 1)
  `).run(sampleSupplierLedger, companyId);

  db.prepare(`
    INSERT OR IGNORE INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin, pan, phone, email, contact_person)
    VALUES ('party_supp_01', ?, ?, 'SUPPLIER', 'Supplier A (Bangalore)', '29XYZAB9876C1Z3', 'XYZAB9876C', '+91 98880 99887', 'orders@suppliera.in', 'Rajesh Sharma')
  `).run(companyId, sampleSupplierLedger);

  db.prepare(`
    INSERT OR IGNORE INTO party_addresses (address_id, party_id, address_type, address_line1, city, state, state_code, pincode, is_default)
    VALUES ('addr_supp_01', 'party_supp_01', 'BOTH', '12, Industrial Layout, Peenya', 'Bengaluru', 'Karnataka', '29', '560058', 1)
  `).run();

  // 9. Seed Sample Stock Items
  db.prepare(`
    INSERT OR IGNORE INTO stock_items (
      item_id, company_id, item_name, item_code, sku, hsn_sac,
      unit_id, gst_rate, cess_rate, purchase_rate_paise, selling_rate_paise,
      opening_qty, opening_rate_paise, reorder_level
    ) VALUES (
      'item_laptop_01', ?, 'ThinkPad Business Laptop', 'LAP-001', 'TP-E14-G4', '84713010',
      'unit_nos', 18.00, 0.00, 4000000, 5000000,
      10, 4000000, 2
    )
  `).run(companyId);

  // Seed initial stock entry for the opening quantity (10 units @ 40,000 = 4,00,000)
  const existingStockEntry = db.prepare('SELECT stock_entry_id FROM stock_entries WHERE item_id = ?').get('item_laptop_01');
  if (!existingStockEntry) {
    // Generate dummy opening voucher or direct opening movement
    const openingVoucherId = 'vch_opening_stock_01';
    db.prepare(`
      INSERT OR IGNORE INTO vouchers (
        voucher_id, company_id, fy_id, voucher_type, voucher_number,
        voucher_date, narration, status, total_amount_paise, created_by
      ) VALUES (?, ?, ?, 'STOCK_JOURNAL', 'OPN-STK-001', '2026-04-01', 'Opening Stock Entry', 'POSTED', 40000000, 'system')
    `).run(openingVoucherId, companyId, fyId);

    db.prepare(`
      INSERT OR IGNORE INTO stock_entries (
        stock_entry_id, voucher_id, item_id, godown_id, entry_date,
        movement_type, quantity, rate_paise, value_paise
      ) VALUES ('se_opn_01', ?, 'item_laptop_01', 'godown_main', '2026-04-01', 'IN', 10, 4000000, 40000000)
    `).run(openingVoucherId);
  }

  return companyId;
}
