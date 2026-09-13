-- LedgerFlow Relational Database Schema (SQLite 3)
PRAGMA foreign_keys = ON;

-- 1. COMPANIES & FINANCIAL YEARS
CREATE TABLE IF NOT EXISTS companies (
    company_id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    gstin TEXT,
    pan TEXT,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    state_code TEXT NOT NULL,
    pincode TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    phone TEXT,
    email TEXT,
    currency TEXT DEFAULT 'INR',
    currency_symbol TEXT DEFAULT '₹',
    bank_name TEXT,
    bank_account_no TEXT,
    bank_ifsc TEXT,
    bank_branch TEXT,
    terms_and_conditions TEXT,
    owner_user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_years (
    fy_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    name TEXT NOT NULL, -- e.g. '2026-2027'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT CHECK(status IN ('OPEN', 'LOCKED', 'CLOSED')) DEFAULT 'OPEN',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. CHART OF ACCOUNTS (LEDGER GROUPS & LEDGERS)
CREATE TABLE IF NOT EXISTS ledger_groups (
    group_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    parent_group_id TEXT REFERENCES ledger_groups(group_id),
    group_name TEXT NOT NULL,
    nature TEXT CHECK(nature IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')) NOT NULL,
    affects_gross_profit INTEGER DEFAULT 0 -- 1 for direct expenses/sales/purchases
);

CREATE TABLE IF NOT EXISTS ledgers (
    ledger_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    group_id TEXT NOT NULL REFERENCES ledger_groups(group_id),
    ledger_name TEXT NOT NULL,
    code TEXT,
    opening_balance_paise INTEGER DEFAULT 0,
    opening_balance_type TEXT CHECK(opening_balance_type IN ('DR', 'CR')) DEFAULT 'DR',
    is_party INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, ledger_name)
);

-- 3. PARTIES & MULTIPLE ADDRESSES
CREATE TABLE IF NOT EXISTS parties (
    party_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    ledger_id TEXT NOT NULL UNIQUE REFERENCES ledgers(ledger_id),
    party_type TEXT CHECK(party_type IN ('CUSTOMER', 'SUPPLIER', 'BOTH')) NOT NULL,
    party_name TEXT NOT NULL,
    gstin TEXT,
    pan TEXT,
    phone TEXT,
    email TEXT,
    contact_person TEXT,
    credit_limit_paise INTEGER DEFAULT 0,
    credit_period_days INTEGER DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_addresses (
    address_id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id) ON DELETE CASCADE,
    address_type TEXT CHECK(address_type IN ('BILLING', 'SHIPPING', 'BOTH')) DEFAULT 'BOTH',
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    state_code TEXT NOT NULL,
    pincode TEXT NOT NULL,
    is_default INTEGER DEFAULT 1
);

-- 4. INVENTORY (UNITS, GODOWNS, STOCK ITEMS)
CREATE TABLE IF NOT EXISTS units (
    unit_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    unit_name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    decimal_places INTEGER DEFAULT 0,
    UNIQUE(company_id, symbol)
);

CREATE TABLE IF NOT EXISTS godowns (
    godown_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    godown_name TEXT NOT NULL,
    location TEXT,
    is_default INTEGER DEFAULT 0,
    UNIQUE(company_id, godown_name)
);

CREATE TABLE IF NOT EXISTS stock_items (
    item_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    item_name TEXT NOT NULL,
    item_code TEXT,
    sku TEXT,
    hsn_sac TEXT NOT NULL,
    unit_id TEXT NOT NULL REFERENCES units(unit_id),
    gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
    cess_rate NUMERIC(5,2) DEFAULT 0.00,
    purchase_rate_paise INTEGER DEFAULT 0,
    selling_rate_paise INTEGER DEFAULT 0,
    opening_qty NUMERIC(15,3) DEFAULT 0,
    opening_rate_paise INTEGER DEFAULT 0,
    reorder_level NUMERIC(15,3) DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, item_name)
);

-- 5. VOUCHERS (TRANSACTIONS)
CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(company_id),
    fy_id TEXT NOT NULL REFERENCES financial_years(fy_id),
    voucher_type TEXT CHECK(voucher_type IN (
        'SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL',
        'CREDIT_NOTE', 'DEBIT_NOTE', 'SALES_RETURN', 'PURCHASE_RETURN', 'STOCK_JOURNAL'
    )) NOT NULL,
    voucher_number TEXT NOT NULL,
    voucher_date DATE NOT NULL,
    reference_number TEXT,
    reference_date DATE,
    payment_mode TEXT,
    terms_conditions TEXT,
    party_id TEXT REFERENCES parties(party_id),
    narration TEXT,
    status TEXT CHECK(status IN ('DRAFT', 'POSTED', 'CANCELLED', 'AMENDED')) DEFAULT 'POSTED',
    taxable_amount_paise INTEGER DEFAULT 0,
    cgst_amount_paise INTEGER DEFAULT 0,
    sgst_amount_paise INTEGER DEFAULT 0,
    igst_amount_paise INTEGER DEFAULT 0,
    round_off_paise INTEGER DEFAULT 0,
    total_amount_paise INTEGER NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    cancelled_by TEXT,
    cancelled_at DATETIME,
    cancellation_reason TEXT,
    UNIQUE(company_id, fy_id, voucher_type, voucher_number)
);

CREATE TABLE IF NOT EXISTS voucher_lines (
    line_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    item_id TEXT REFERENCES stock_items(item_id),
    ledger_id TEXT REFERENCES ledgers(ledger_id),
    godown_id TEXT REFERENCES godowns(godown_id),
    description TEXT,
    quantity NUMERIC(15,3) DEFAULT 0,
    rate_paise INTEGER DEFAULT 0,
    discount_percent NUMERIC(5,2) DEFAULT 0.00,
    discount_amount_paise INTEGER DEFAULT 0,
    taxable_amount_paise INTEGER NOT NULL,
    gst_rate NUMERIC(5,2) DEFAULT 0.00,
    cgst_amount_paise INTEGER DEFAULT 0,
    sgst_amount_paise INTEGER DEFAULT 0,
    igst_amount_paise INTEGER DEFAULT 0,
    total_amount_paise INTEGER NOT NULL
);

-- 6. DOUBLE-ENTRY LEDGER ENTRIES
CREATE TABLE IF NOT EXISTS ledger_entries (
    entry_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
    entry_date DATE NOT NULL,
    debit_paise INTEGER DEFAULT 0 CHECK(debit_paise >= 0),
    credit_paise INTEGER DEFAULT 0 CHECK(credit_paise >= 0),
    particulars TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (debit_paise > 0 OR credit_paise > 0),
    CHECK (debit_paise == 0 OR credit_paise == 0)
);

-- 7. TRANSACTION-DRIVEN INVENTORY MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_entries (
    stock_entry_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES stock_items(item_id),
    godown_id TEXT NOT NULL REFERENCES godowns(godown_id),
    entry_date DATE NOT NULL,
    movement_type TEXT CHECK(movement_type IN ('IN', 'OUT')) NOT NULL,
    quantity NUMERIC(15,3) NOT NULL CHECK(quantity > 0),
    rate_paise INTEGER NOT NULL CHECK(rate_paise >= 0),
    value_paise INTEGER NOT NULL CHECK(value_paise >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. STATUTORY TAX ENTRIES
CREATE TABLE IF NOT EXISTS tax_entries (
    tax_entry_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    tax_type TEXT CHECK(tax_type IN ('OUTPUT_CGST', 'OUTPUT_SGST', 'OUTPUT_IGST', 'INPUT_CGST', 'INPUT_SGST', 'INPUT_IGST', 'CESS')) NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    taxable_amount_paise INTEGER NOT NULL,
    tax_amount_paise INTEGER NOT NULL,
    place_of_supply TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. BILL ALLOCATIONS & OUTSTANDING
CREATE TABLE IF NOT EXISTS bill_allocations (
    allocation_id TEXT PRIMARY KEY,
    voucher_id TEXT NOT NULL REFERENCES vouchers(voucher_id) ON DELETE CASCADE,
    ledger_id TEXT NOT NULL REFERENCES ledgers(ledger_id),
    reference_voucher_id TEXT REFERENCES vouchers(voucher_id),
    allocation_type TEXT CHECK(allocation_type IN ('NEW_REF', 'AGAINST_REF', 'ADVANCE', 'ON_ACCOUNT')) NOT NULL,
    amount_paise INTEGER NOT NULL,
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT TRAIL
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('ADMIN', 'ACCOUNTANT', 'DATA_ENTRY', 'AUDITOR')) NOT NULL DEFAULT 'ADMIN',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. MULTI-TENANT USER BUSINESSES MEMBERSHIP
CREATE TABLE IF NOT EXISTS user_businesses (
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    role TEXT CHECK(role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER')) DEFAULT 'OWNER',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, company_id)
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_ledger_entries_ledger_date ON ledger_entries(ledger_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_stock_entries_item_date ON stock_entries(item_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_date_type ON vouchers(voucher_date, voucher_type);
CREATE INDEX IF NOT EXISTS idx_bill_alloc_ref ON bill_allocations(reference_voucher_id);
CREATE INDEX IF NOT EXISTS idx_user_biz_user ON user_businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_biz_company ON user_businesses(company_id);
