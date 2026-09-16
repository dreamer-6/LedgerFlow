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
    // Enable Foreign Keys and WAL Mode for performance and integrity
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
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
        db.exec(`
      CREATE TABLE IF NOT EXISTS stock_item_serials (
        serial_id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL REFERENCES stock_items(item_id) ON DELETE CASCADE,
        serial_number TEXT NOT NULL,
        status TEXT CHECK(status IN ('AVAILABLE', 'SOLD')) DEFAULT 'AVAILABLE',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(item_id, serial_number)
      );
    `);
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
