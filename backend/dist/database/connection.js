"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabasePath = getDatabasePath;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const node_sqlite_1 = require("node:sqlite");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
// Singleton database instance
let dbInstance = null;
function getDatabasePath() {
    const dbDir = node_path_1.default.resolve(__dirname, '../../data');
    if (!node_fs_1.default.existsSync(dbDir)) {
        node_fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    const dbName = process.env.LEDGERFLOW_DB_NAME || 'ledgerflow.db';
    return node_path_1.default.join(dbDir, dbName);
}
function getDatabase(customPath) {
    if (dbInstance && !customPath) {
        return dbInstance;
    }
    const dbPath = customPath || getDatabasePath();
    const db = new node_sqlite_1.DatabaseSync(dbPath);
    // Enable Foreign Keys, WAL Mode, and Busy Timeout for performance and integrity
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    // Run schema initialization
    const schemaPath = node_path_1.default.resolve(__dirname, 'schema.sql');
    if (node_fs_1.default.existsSync(schemaPath)) {
        const schemaSql = node_fs_1.default.readFileSync(schemaPath, 'utf8');
        db.exec(schemaSql);
    }
    // Safe incremental column migrations
    try {
        db.exec('ALTER TABLE vouchers ADD COLUMN reference_date DATE;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE vouchers ADD COLUMN payment_mode TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE vouchers ADD COLUMN terms_conditions TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE voucher_lines ADD COLUMN description TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE parties ADD COLUMN bank_name TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE users ADD COLUMN email TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN owner_user_id TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_items ADD COLUMN serial_numbers TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_items ADD COLUMN has_serial_no INTEGER DEFAULT 0;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN mailing_name TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN vault_password_hash TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN logo_base64 TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN website TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN invoice_settings TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE companies ADD COLUMN accounting_preferences TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE parties ADD COLUMN banking_name TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE parties ADD COLUMN banking_account_no TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE parties ADD COLUMN banking_ifsc TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE voucher_lines ADD COLUMN serial_number TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE voucher_lines ADD COLUMN warranty_months INTEGER DEFAULT 0;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_items ADD COLUMN warranty_months INTEGER DEFAULT 0;');
    }
    catch { }
    try {
        db.exec(`
      CREATE TABLE IF NOT EXISTS stock_item_serials (
        serial_id TEXT PRIMARY KEY,
        company_id TEXT REFERENCES companies(company_id),
        item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
        godown_id TEXT REFERENCES godowns(godown_id),
        serial_number TEXT NOT NULL,
        status TEXT CHECK(status IN ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'WRITTEN_OFF', 'CANCELLED')) DEFAULT 'AVAILABLE',
        purchase_voucher_id TEXT REFERENCES vouchers(voucher_id),
        purchase_voucher_line_id TEXT,
        supplier_id TEXT REFERENCES parties(party_id),
        purchase_date DATE,
        sales_voucher_id TEXT REFERENCES vouchers(voucher_id),
        sales_voucher_line_id TEXT,
        customer_id TEXT REFERENCES parties(party_id),
        sales_date DATE,
        warranty_expiry_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(company_id, item_id, serial_number)
      );
    `);
    }
    catch { }
    // QA-012: Ensure stock_item_serials has all columns and full status domain including 'CANCELLED'
    try {
        const tableSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'stock_item_serials'").get()?.sql || '';
        if (tableSql && (!tableSql.includes("'CANCELLED'") || !tableSql.includes('updated_at'))) {
            db.exec('PRAGMA foreign_keys = OFF;');
            db.exec('DROP TABLE IF EXISTS stock_item_serials_v3;');
            db.exec(`
        CREATE TABLE stock_item_serials_v3 (
          serial_id TEXT PRIMARY KEY,
          company_id TEXT REFERENCES companies(company_id),
          item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
          godown_id TEXT REFERENCES godowns(godown_id),
          serial_number TEXT NOT NULL,
          status TEXT CHECK(status IN ('DRAFT', 'AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'DAMAGED', 'WRITTEN_OFF', 'CANCELLED')) DEFAULT 'AVAILABLE',
          purchase_voucher_id TEXT REFERENCES vouchers(voucher_id),
          purchase_voucher_line_id TEXT,
          supplier_id TEXT REFERENCES parties(party_id),
          purchase_date DATE,
          sales_voucher_id TEXT REFERENCES vouchers(voucher_id),
          sales_voucher_line_id TEXT,
          customer_id TEXT REFERENCES parties(party_id),
          sales_date DATE,
          warranty_expiry_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(company_id, item_id, serial_number)
        );
      `);
            const cols = db.prepare('PRAGMA table_info(stock_item_serials)').all().map(c => c.name);
            const hasUpdatedAt = cols.includes('updated_at');
            const updatedAtExpr = hasUpdatedAt ? 'COALESCE(s.updated_at, s.created_at, CURRENT_TIMESTAMP)' : 'COALESCE(s.created_at, CURRENT_TIMESTAMP)';
            db.exec(`
        INSERT OR IGNORE INTO stock_item_serials_v3 (
          serial_id, company_id, item_id, godown_id, serial_number, status,
          purchase_voucher_id, purchase_voucher_line_id, supplier_id, purchase_date,
          sales_voucher_id, sales_voucher_line_id, customer_id, sales_date,
          warranty_expiry_date, created_at, updated_at
        )
        SELECT 
          s.serial_id,
          COALESCE(s.company_id, (SELECT company_id FROM companies LIMIT 1)),
          s.item_id,
          COALESCE(s.godown_id, (SELECT godown_id FROM godowns WHERE company_id = s.company_id ORDER BY is_default DESC LIMIT 1)),
          s.serial_number,
          s.status,
          s.purchase_voucher_id,
          s.purchase_voucher_line_id,
          s.supplier_id,
          s.purchase_date,
          s.sales_voucher_id,
          s.sales_voucher_line_id,
          s.customer_id,
          s.sales_date,
          s.warranty_expiry_date,
          s.created_at,
          ${updatedAtExpr}
        FROM stock_item_serials s;

        DROP TABLE stock_item_serials;
        ALTER TABLE stock_item_serials_v3 RENAME TO stock_item_serials;
        CREATE INDEX IF NOT EXISTS idx_serials_comp_item_godown ON stock_item_serials(company_id, item_id, godown_id, status);
        CREATE INDEX IF NOT EXISTS idx_serials_purchase_vch ON stock_item_serials(purchase_voucher_id);
        CREATE INDEX IF NOT EXISTS idx_serials_sales_vch ON stock_item_serials(sales_voucher_id);
        PRAGMA foreign_keys = ON;
      `);
        }
    }
    catch (mErr) {
        console.error('Migration warning for stock_item_serials:', mErr.message);
    }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN company_id TEXT REFERENCES companies(company_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN godown_id TEXT REFERENCES godowns(godown_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN purchase_voucher_id TEXT REFERENCES vouchers(voucher_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN purchase_voucher_line_id TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN supplier_id TEXT REFERENCES parties(party_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN purchase_date DATE;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN sales_voucher_id TEXT REFERENCES vouchers(voucher_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN sales_voucher_line_id TEXT;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN customer_id TEXT REFERENCES parties(party_id);');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN sales_date DATE;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN warranty_expiry_date DATE;');
    }
    catch { }
    try {
        db.exec('ALTER TABLE stock_item_serials ADD COLUMN updated_at DATETIME;');
    }
    catch { }
    try {
        db.exec(`
      UPDATE stock_item_serials
      SET company_id = (SELECT company_id FROM stock_items WHERE stock_items.item_id = stock_item_serials.item_id)
      WHERE company_id IS NULL;
    `);
        db.exec(`
      UPDATE stock_item_serials
      SET godown_id = (SELECT godown_id FROM godowns WHERE godowns.company_id = stock_item_serials.company_id ORDER BY is_default DESC, created_at ASC LIMIT 1)
      WHERE godown_id IS NULL;
    `);
    }
    catch { }
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_serials_comp_item_godown ON stock_item_serials(company_id, item_id, godown_id, status);');
    }
    catch { }
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_serials_purchase_vch ON stock_item_serials(purchase_voucher_id);');
    }
    catch { }
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_serials_sales_vch ON stock_item_serials(sales_voucher_id);');
    }
    catch { }
    try {
        db.exec(`
      CREATE TABLE IF NOT EXISTS user_businesses (
        user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        company_id TEXT NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
        role TEXT CHECK(role IN ('OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER')) DEFAULT 'OWNER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, company_id)
      );
    `);
    }
    catch { }
    try {
        db.exec('ALTER TABLE vouchers ADD COLUMN is_hidden INTEGER DEFAULT 0;');
    }
    catch { }
    try {
        db.exec('CREATE INDEX IF NOT EXISTS idx_vouchers_comp_date_status ON vouchers(company_id, voucher_date, status);');
    }
    catch { }
    if (!customPath) {
        dbInstance = db;
    }
    return db;
}
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
