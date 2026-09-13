"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeBusiness = initializeBusiness;
exports.seedInitialData = seedInitialData;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
function initializeBusiness(db, options) {
    const { companyId, companyName, legalName = companyName, gstin = '', state = 'Tamil Nadu', stateCode = '33', ownerUserId } = options;
    const fyId = `${companyId}_fy_2026_27`;
    // 1. Create Business / Company Record
    db.prepare(`
    INSERT INTO companies (
      company_id, company_name, legal_name, gstin, pan,
      address_line1, address_line2, city, state, state_code,
      pincode, country, phone, email, currency, currency_symbol,
      bank_name, bank_account_no, bank_ifsc, bank_branch, terms_and_conditions, owner_user_id
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(companyId, companyName, legalName, gstin, gstin ? gstin.slice(2, 12) : '', '123, Commercial High Road', '', 'Chennai', state, stateCode, '600001', 'India', '+91 98765 43210', 'accounts@business.in', 'INR', '₹', 'State Bank of India', '', '', '', '1. Goods once sold will not be taken back.\n2. Payment terms 30 days.', ownerUserId || null);
    // Link to user if ownerUserId is provided
    if (ownerUserId) {
        db.prepare(`
      INSERT OR IGNORE INTO user_businesses (user_id, company_id, role)
      VALUES (?, ?, 'OWNER')
    `).run(ownerUserId, companyId);
    }
    // 2. Create Active Financial Year (2026 - 2027)
    db.prepare(`
    INSERT INTO financial_years (fy_id, company_id, name, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, 'OPEN')
  `).run(fyId, companyId, '2026-2027', '2026-04-01', '2027-03-31');
    // 3. Create Default Measurement Units
    const units = [
        { id: `${companyId}_unit_nos`, name: 'Numbers', symbol: 'Nos', decimals: 0 },
        { id: `${companyId}_unit_pcs`, name: 'Pieces', symbol: 'Pcs', decimals: 0 },
        { id: `${companyId}_unit_kg`, name: 'Kilograms', symbol: 'Kg', decimals: 3 },
        { id: `${companyId}_unit_box`, name: 'Boxes', symbol: 'Box', decimals: 0 },
        { id: `${companyId}_unit_mtr`, name: 'Meters', symbol: 'Mtr', decimals: 2 }
    ];
    for (const u of units) {
        db.prepare('INSERT OR IGNORE INTO units (unit_id, company_id, unit_name, symbol, decimal_places) VALUES (?, ?, ?, ?, ?)')
            .run(u.id, companyId, u.name, u.symbol, u.decimals);
    }
    // 4. Create Default Godown
    db.prepare('INSERT OR IGNORE INTO godowns (godown_id, company_id, godown_name, location, is_default) VALUES (?, ?, ?, ?, 1)')
        .run(`${companyId}_godown_main`, companyId, 'Main Warehouse', 'Central Warehouse');
    // 5. Create Standard Ledger Groups
    const groups = [
        { id: `${companyId}_grp_assets`, parent: null, name: 'Assets', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_current_assets`, parent: `${companyId}_grp_assets`, name: 'Current Assets', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_bank`, parent: `${companyId}_grp_current_assets`, name: 'Bank Accounts', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_cash`, parent: `${companyId}_grp_current_assets`, name: 'Cash-in-Hand', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_debtors`, parent: `${companyId}_grp_current_assets`, name: 'Sundry Debtors', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_stock`, parent: `${companyId}_grp_current_assets`, name: 'Stock-in-Hand', nature: 'ASSET', affects_gp: 0 },
        { id: `${companyId}_grp_liabilities`, parent: null, name: 'Liabilities', nature: 'LIABILITY', affects_gp: 0 },
        { id: `${companyId}_grp_current_liab`, parent: `${companyId}_grp_liabilities`, name: 'Current Liabilities', nature: 'LIABILITY', affects_gp: 0 },
        { id: `${companyId}_grp_creditors`, parent: `${companyId}_grp_current_liab`, name: 'Sundry Creditors', nature: 'LIABILITY', affects_gp: 0 },
        { id: `${companyId}_grp_duties_taxes`, parent: `${companyId}_grp_current_liab`, name: 'Duties & Taxes', nature: 'LIABILITY', affects_gp: 0 },
        { id: `${companyId}_grp_equity`, parent: null, name: 'Equity & Capital', nature: 'EQUITY', affects_gp: 0 },
        { id: `${companyId}_grp_capital`, parent: `${companyId}_grp_equity`, name: 'Capital Account', nature: 'EQUITY', affects_gp: 0 },
        { id: `${companyId}_grp_income`, parent: null, name: 'Income', nature: 'INCOME', affects_gp: 1 },
        { id: `${companyId}_grp_sales`, parent: `${companyId}_grp_income`, name: 'Sales Accounts', nature: 'INCOME', affects_gp: 1 },
        { id: `${companyId}_grp_indirect_income`, parent: `${companyId}_grp_income`, name: 'Indirect Incomes', nature: 'INCOME', affects_gp: 0 },
        { id: `${companyId}_grp_expense`, parent: null, name: 'Expenses', nature: 'EXPENSE', affects_gp: 1 },
        { id: `${companyId}_grp_purchase`, parent: `${companyId}_grp_expense`, name: 'Purchase Accounts', nature: 'EXPENSE', affects_gp: 1 },
        { id: `${companyId}_grp_direct_expense`, parent: `${companyId}_grp_expense`, name: 'Direct Expenses', nature: 'EXPENSE', affects_gp: 1 },
        { id: `${companyId}_grp_indirect_expense`, parent: `${companyId}_grp_expense`, name: 'Indirect Expenses', nature: 'EXPENSE', affects_gp: 0 }
    ];
    for (const g of groups) {
        db.prepare('INSERT OR IGNORE INTO ledger_groups (group_id, company_id, parent_group_id, group_name, nature, affects_gross_profit) VALUES (?, ?, ?, ?, ?, ?)')
            .run(g.id, companyId, g.parent, g.name, g.nature, g.affects_gp);
    }
    // 6. Create Standard Core Ledgers
    const standardLedgers = [
        // Cash & Bank
        { id: `${companyId}_led_cash`, group: `${companyId}_grp_cash`, name: 'Cash', code: '1001', bal: 0, type: 'DR' },
        { id: `${companyId}_led_bank`, group: `${companyId}_grp_bank`, name: 'Bank Account', code: '1002', bal: 0, type: 'DR' },
        // Capital
        { id: `${companyId}_led_capital`, group: `${companyId}_grp_capital`, name: 'Proprietor Capital', code: '3001', bal: 0, type: 'CR' },
        // Trading
        { id: `${companyId}_led_sales`, group: `${companyId}_grp_sales`, name: 'Sales Account', code: '4001', bal: 0, type: 'CR' },
        { id: `${companyId}_led_sales_ret`, group: `${companyId}_grp_sales`, name: 'Sales Return Account', code: '4002', bal: 0, type: 'DR' },
        { id: `${companyId}_led_purchase`, group: `${companyId}_grp_purchase`, name: 'Purchase Account', code: '5001', bal: 0, type: 'DR' },
        { id: `${companyId}_led_purch_ret`, group: `${companyId}_grp_purchase`, name: 'Purchase Return Account', code: '5002', bal: 0, type: 'CR' },
        { id: `${companyId}_led_cogs`, group: `${companyId}_grp_direct_expense`, name: 'Cost of Goods Sold', code: '5003', bal: 0, type: 'DR' },
        { id: `${companyId}_led_inventory`, group: `${companyId}_grp_stock`, name: 'Inventory Asset', code: '1003', bal: 0, type: 'DR' },
        // GST Output Liabilities
        { id: `${companyId}_led_out_cgst`, group: `${companyId}_grp_duties_taxes`, name: 'Output CGST', code: '2101', bal: 0, type: 'CR' },
        { id: `${companyId}_led_out_sgst`, group: `${companyId}_grp_duties_taxes`, name: 'Output SGST', code: '2102', bal: 0, type: 'CR' },
        { id: `${companyId}_led_out_igst`, group: `${companyId}_grp_duties_taxes`, name: 'Output IGST', code: '2103', bal: 0, type: 'CR' },
        // GST Input Tax Credits
        { id: `${companyId}_led_in_cgst`, group: `${companyId}_grp_duties_taxes`, name: 'Input CGST', code: '2201', bal: 0, type: 'DR' },
        { id: `${companyId}_led_in_sgst`, group: `${companyId}_grp_duties_taxes`, name: 'Input SGST', code: '2202', bal: 0, type: 'DR' },
        { id: `${companyId}_led_in_igst`, group: `${companyId}_grp_duties_taxes`, name: 'Input IGST', code: '2203', bal: 0, type: 'DR' },
        // Round Off & Expenses
        { id: `${companyId}_led_roundoff`, group: `${companyId}_grp_indirect_expense`, name: 'Round Off Account', code: '5999', bal: 0, type: 'DR' },
        { id: `${companyId}_led_rent`, group: `${companyId}_grp_indirect_expense`, name: 'Rent Expense', code: '5101', bal: 0, type: 'DR' },
        { id: `${companyId}_led_electric`, group: `${companyId}_grp_indirect_expense`, name: 'Electricity Expense', code: '5102', bal: 0, type: 'DR' }
    ];
    for (const l of standardLedgers) {
        db.prepare(`
      INSERT OR IGNORE INTO ledgers (
        ledger_id, company_id, group_id, ledger_name, code,
        opening_balance_paise, opening_balance_type, is_party, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(l.id, companyId, l.group, l.name, l.code, l.bal, l.type);
    }
    return companyId;
}
function seedInitialData(db) {
    // Check if admin user exists
    const existingUser = db.prepare('SELECT user_id FROM users WHERE username = ?').get('admin');
    let adminUserId = existingUser?.user_id;
    if (!adminUserId) {
        adminUserId = 'usr_admin';
        const salt = bcryptjs_1.default.genSaltSync(10);
        const passwordHash = bcryptjs_1.default.hashSync('admin123', salt);
        db.prepare(`
      INSERT OR IGNORE INTO users (user_id, username, email, password_hash, full_name, role)
      VALUES (?, 'admin', 'admin@ledgerflow.com', ?, 'System Administrator', 'ADMIN')
    `).run(adminUserId, passwordHash);
    }
    // Check if initial company already exists
    const existingCompany = db.prepare('SELECT company_id FROM companies LIMIT 1').get();
    if (existingCompany) {
        // Link existing company to admin user if not already linked
        db.prepare(`
      INSERT OR IGNORE INTO user_businesses (user_id, company_id, role)
      VALUES (?, ?, 'OWNER')
    `).run(adminUserId, existingCompany.company_id);
        return existingCompany.company_id;
    }
    const companyId = 'comp_default_01';
    initializeBusiness(db, {
        companyId,
        companyName: 'Apex Technologies Enterprises',
        legalName: 'Apex Technologies Pvt Ltd',
        gstin: '33AAAAA0000A1Z5',
        ownerUserId: adminUserId
    });
    return companyId;
}
