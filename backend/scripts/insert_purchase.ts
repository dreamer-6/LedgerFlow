import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { PostingEngine, CreateVoucherInput } from '../src/domain/posting/posting-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/ledgerflow.db');
const db = new DatabaseSync(dbPath);

const originalPrepare = DatabaseSync.prototype.prepare;
DatabaseSync.prototype.prepare = function(sql: string) {
    const stmt = originalPrepare.call(this, sql);
    const originalRun = stmt.run;
    stmt.run = function(...args: any[]) {
        try {
            return originalRun.apply(this, args);
        } catch (e: any) {
            console.error('SQL ERROR on:', sql);
            console.error('ARGS:', args);
            throw e;
        }
    };
    return stmt;
};

console.log('Fetching active company...');
const company = db.prepare('SELECT * FROM companies LIMIT 1').get() as any;
if (!company) {
    console.error('No company found.');
    process.exit(1);
}
const companyId = company.company_id;
console.log('Company:', company.company_name, `(${companyId})`);

const fy = db.prepare("SELECT * FROM financial_years WHERE company_id = ? AND status = 'OPEN' ORDER BY start_date DESC LIMIT 1").get(companyId) as any;
if (!fy) {
    console.error('No open financial year found.');
    process.exit(1);
}
const fyId = fy.fy_id;
console.log('FY:', fy.name, `(${fyId})`);

// 1. Setup Party (Supplier)
const partyName = 'Next IT World';
let party = db.prepare('SELECT * FROM parties WHERE company_id = ? AND party_name = ?').get(companyId, partyName) as any;
if (!party) {
    console.log('Creating party:', partyName);
    const ledgerId = 'led_pty_' + Date.now().toString(36);
    const partyId = 'party_' + Date.now().toString(36);
    const creditorsGroup = db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name = 'Sundry Creditors'").get(companyId) as any;
    
    db.prepare("INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, opening_balance_paise, opening_balance_type) VALUES (?, ?, ?, ?, 0, 'CR')")
      .run(ledgerId, companyId, creditorsGroup.group_id, partyName);
    
    db.prepare("INSERT INTO parties (party_id, company_id, ledger_id, party_type, party_name, gstin) VALUES (?, ?, ?, 'SUPPLIER', ?, '33AAFFN5770P1ZR')")
      .run(partyId, companyId, ledgerId, partyName);
    
    party = db.prepare('SELECT * FROM parties WHERE company_id = ? AND party_name = ?').get(companyId, partyName) as any;
}
console.log('Party ID:', party.party_id, 'Ledger ID:', party.ledger_id);

// Ensure Purchase and Tax Ledgers exist
const ensureLedger = (name: string, code: string, groupName: string) => {
    let led = db.prepare('SELECT * FROM ledgers WHERE company_id = ? AND ledger_name = ?').get(companyId, name) as any;
    if (!led) {
        const grp = db.prepare("SELECT group_id FROM ledger_groups WHERE company_id = ? AND group_name = ?").get(companyId, groupName) as any;
        const ledId = 'led_sys_' + Date.now().toString(36) + Math.random().toString(36).substring(2,5);
        db.prepare("INSERT INTO ledgers (ledger_id, company_id, group_id, ledger_name, code) VALUES (?, ?, ?, ?, ?)").run(ledId, companyId, grp.group_id, name, code);
        led = db.prepare('SELECT * FROM ledgers WHERE company_id = ? AND ledger_name = ?').get(companyId, name) as any;
    }
    return led.ledger_id;
};

const purchaseLedgerId = ensureLedger('Purchase A/c', 'PURCHASE', 'Purchase Accounts');
const cgstLedgerId = ensureLedger('Input CGST', 'INPUT_CGST', 'Duties & Taxes');
const sgstLedgerId = ensureLedger('Input SGST', 'INPUT_SGST', 'Duties & Taxes');
const freightLedgerId = ensureLedger('Freight Charges', 'FREIGHT', 'Direct Expenses');

// Helper to ensure item
const ensureItem = (name: string, hsn: string, qty: number, rate: number, sellRate: number) => {
    let item = db.prepare('SELECT * FROM stock_items WHERE company_id = ? AND item_name = ?').get(companyId, name) as any;
    if (!item) {
        console.log('Creating item:', name);
        const unit = db.prepare('SELECT unit_id FROM units WHERE company_id = ? LIMIT 1').get(companyId) as any;
        const itemId = 'item_' + Date.now().toString(36) + Math.random().toString(36).substring(2,6);
        db.prepare(`
            INSERT INTO stock_items (item_id, company_id, item_name, hsn_sac, unit_id, gst_rate, purchase_rate_paise, selling_rate_paise)
            VALUES (?, ?, ?, ?, ?, 18, ?, ?)
        `).run(itemId, companyId, name, hsn, unit.unit_id, rate * 100, sellRate * 100);
        item = db.prepare('SELECT * FROM stock_items WHERE company_id = ? AND item_name = ?').get(companyId, name) as any;
    }
    return item.item_id;
};

const items = [
    { name: 'Core I5 4TH GEN', hsn: '84733010', qty: 1, rate: 1313.56 },
    { name: 'ZEBRONICS 81 CHIPSET MOTHERBOARD', hsn: '84733020', qty: 1, rate: 1228.81 },
    { name: 'DAICHI 8GB DDR3 DESKTOP RAM', hsn: '84733030', qty: 1, rate: 1525.42 },
    { name: 'EVM 256GB SSD', hsn: '85235100', qty: 1, rate: 2542.37 },
    { name: '1155 CPU FAN', hsn: '84733099', qty: 1, rate: 148.31 },
    { name: 'FOXIN CABINET W/O SMPS', hsn: '84733099', qty: 1, rate: 466.10 },
    { name: 'EVM 500W SMPS', hsn: '85044029', qty: 1, rate: 360.17 }
];

const godown = db.prepare('SELECT godown_id FROM godowns WHERE company_id = ? LIMIT 1').get(companyId) as any;

const voucherLines = items.map(item => ({
    itemId: ensureItem(item.name, item.hsn, item.qty, item.rate, item.rate * 1.5),
    ledgerId: purchaseLedgerId,
    godownId: godown.godown_id,
    quantity: item.qty,
    ratePaise: Math.round(item.rate * 100),
    gstRate: 18,
    isTaxInclusive: false
}));

const totalTaxable = items.reduce((sum, item) => sum + Math.round(item.rate * 100), 0);
const cgst = Math.round(totalTaxable * 0.09);
const sgst = Math.round(totalTaxable * 0.09);
const freight = 10000;
const roundOff = 905000 - (totalTaxable + cgst + sgst + freight);

const customLedgerLines = [
    { ledgerId: purchaseLedgerId, debitPaise: totalTaxable, creditPaise: 0, particulars: 'Purchase' },
    { ledgerId: cgstLedgerId, debitPaise: cgst, creditPaise: 0, particulars: 'CGST' },
    { ledgerId: sgstLedgerId, debitPaise: sgst, creditPaise: 0, particulars: 'SGST' },
    { ledgerId: freightLedgerId, debitPaise: freight, creditPaise: 0, particulars: 'Freight Charges' },
    { ledgerId: party.ledger_id, debitPaise: 0, creditPaise: 905000, particulars: 'Next IT World' }
];

if (roundOff !== 0) {
    const roundOffLedgerId = ensureLedger('Round Off', 'ROUND_OFF', 'Indirect Expenses');
    if (roundOff > 0) {
        customLedgerLines.push({ ledgerId: roundOffLedgerId, debitPaise: roundOff, creditPaise: 0, particulars: 'Round Off' });
    } else {
        customLedgerLines.push({ ledgerId: roundOffLedgerId, debitPaise: 0, creditPaise: Math.abs(roundOff), particulars: 'Round Off' });
    }
}

const input: CreateVoucherInput = {
    companyId,
    fyId,
    voucherType: 'PURCHASE',
    voucherDate: '2026-06-03', // Date from invoice
    voucherNumber: 'PUR-TEST-001',
    referenceNumber: 'NIW262706-3447', // Invoice number
    referenceDate: '2026-06-03',
    partyId: party.party_id,
    narration: 'Purchase from Next IT World',
    lines: voucherLines,
    customLedgerLines,
    billAllocation: {
        allocationType: 'NEW_REF',
        dueDate: '2026-06-03'
    }
};

console.log('Posting Voucher...');
console.log('Input:', JSON.stringify(input, null, 2));
try {
    const result = PostingEngine.postVoucher(db, input);
    console.log('SUCCESS! Voucher Posted:', result);
} catch (e: any) {
    console.error('FAILED TO POST:', e.message);
}
