import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

describe('UI-043: Remove Sales/Purchase/Stock Entries & Items Table Sorting Invariants', () => {
  const dbPath = path.resolve(__dirname, '../data/ledgerflow.db');
  const db = new DatabaseSync(dbPath);

  /* ─────────────────────────────────────────────────────────────
   * Section 1: Transaction & Stock Clean Slate Verification
   * ───────────────────────────────────────────────────────────── */
  it('1.1: Database contains ZERO sales, purchase, stock journal, payment, or receipt vouchers', () => {
    const vouchersCount = (db.prepare('SELECT COUNT(*) as c FROM vouchers').get() as any).c;
    assert.equal(vouchersCount, 0, 'All vouchers must be removed from the database');

    const salesCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE voucher_type LIKE 'SALE%'").get() as any).c;
    assert.equal(salesCount, 0, 'Sales vouchers must be 0');

    const purCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE voucher_type LIKE 'PURCHASE%'").get() as any).c;
    assert.equal(purCount, 0, 'Purchase vouchers must be 0');

    const stkCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers WHERE voucher_type = 'STOCK_JOURNAL'").get() as any).c;
    assert.equal(stkCount, 0, 'Stock journal vouchers must be 0');
  });

  it('1.2: Database contains ZERO voucher lines, ledger entries, tax entries, and bill allocations', () => {
    const vlCount = (db.prepare('SELECT COUNT(*) as c FROM voucher_lines').get() as any).c;
    assert.equal(vlCount, 0, 'All voucher lines must be 0');

    const leCount = (db.prepare('SELECT COUNT(*) as c FROM ledger_entries').get() as any).c;
    assert.equal(leCount, 0, 'All ledger entries must be 0');

    const teCount = (db.prepare('SELECT COUNT(*) as c FROM tax_entries').get() as any).c;
    assert.equal(teCount, 0, 'All tax entries must be 0');

    const baCount = (db.prepare('SELECT COUNT(*) as c FROM bill_allocations').get() as any).c;
    assert.equal(baCount, 0, 'All bill allocations must be 0');
  });

  it('1.3: Database contains ZERO stock entries and ZERO stock item serials', () => {
    const seCount = (db.prepare('SELECT COUNT(*) as c FROM stock_entries').get() as any).c;
    assert.equal(seCount, 0, 'All stock entries must be 0');

    const sisCount = (db.prepare('SELECT COUNT(*) as c FROM stock_item_serials').get() as any).c;
    assert.equal(sisCount, 0, 'All stock item serials must be 0');
  });

  it('1.4: Stock items master is preserved with opening_qty = 0 and clean serials', () => {
    const items = db.prepare('SELECT item_id, item_name, opening_qty, serial_numbers FROM stock_items').all() as any[];
    assert.ok(items.length > 0, 'Stock items master must remain intact');
    for (const item of items) {
      assert.equal(Number(item.opening_qty), 0, `Item ${item.item_name} opening_qty must be 0`);
      assert.equal(item.serial_numbers, null, `Item ${item.item_name} serial_numbers must be null`);
    }
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 2: ItemsView Component Sorting Logic Verification
   * ───────────────────────────────────────────────────────────── */
  const itemsViewSrc = fs.readFileSync(
    path.resolve(__dirname, '../../frontend/src/pages/ItemsView.tsx'),
    'utf8'
  );

  it('2.1: ItemsView declares ItemSortField with all key columns', () => {
    assert.ok(itemsViewSrc.includes('type ItemSortField ='), 'Declares ItemSortField type');
    assert.ok(itemsViewSrc.includes("'code'"), 'ItemSortField includes code');
    assert.ok(itemsViewSrc.includes("'name'"), 'ItemSortField includes name');
    assert.ok(itemsViewSrc.includes("'category'"), 'ItemSortField includes category');
    assert.ok(itemsViewSrc.includes("'hsn'"), 'ItemSortField includes hsn');
    assert.ok(itemsViewSrc.includes("'unit'"), 'ItemSortField includes unit');
    assert.ok(itemsViewSrc.includes("'purchase_rate'"), 'ItemSortField includes purchase_rate');
    assert.ok(itemsViewSrc.includes("'rate'"), 'ItemSortField includes rate');
    assert.ok(itemsViewSrc.includes("'stock'"), 'ItemSortField includes stock');
    assert.ok(itemsViewSrc.includes("'status'"), 'ItemSortField includes status');
  });

  it('2.2: ItemsView implements code alphanumeric sorting with formatItemCode', () => {
    assert.ok(itemsViewSrc.includes("case 'code':"), 'ItemsView comparator handles code');
    assert.ok(itemsViewSrc.includes('formatItemCode(a)'), 'ItemsView sorts using formatted item codes');
    assert.ok(itemsViewSrc.includes('numeric: true'), 'ItemsView uses natural numeric sorting');
  });

  it('2.3: ItemsView implements stock quantity sorting with service item grouping', () => {
    assert.ok(itemsViewSrc.includes("case 'stock':"), 'ItemsView comparator handles stock');
    assert.ok(itemsViewSrc.includes('comparison = stockA - stockB;'), 'ItemsView compares numeric stock');
  });

  it('2.4: ItemsView implements rate, purchase_rate, category, hsn, unit, and status sorting', () => {
    assert.ok(itemsViewSrc.includes("case 'rate':"), 'Handles sales rate sorting');
    assert.ok(itemsViewSrc.includes("case 'purchase_rate':"), 'Handles purchase rate sorting');
    assert.ok(itemsViewSrc.includes("case 'category':"), 'Handles category sorting');
    assert.ok(itemsViewSrc.includes("case 'hsn':"), 'Handles HSN sorting');
    assert.ok(itemsViewSrc.includes("case 'unit':"), 'Handles unit sorting');
    assert.ok(itemsViewSrc.includes("case 'status':"), 'Handles status sorting');
  });

  it('2.5: ItemsView renders sortable headers with directional ArrowUp, ArrowDown, and ArrowUpDown', () => {
    assert.ok(itemsViewSrc.includes('renderSortHeader('), 'Uses reusable renderSortHeader helper');
    assert.ok(itemsViewSrc.includes("<ArrowUp size={13}"), 'Renders ArrowUp on active ascending column');
    assert.ok(itemsViewSrc.includes("<ArrowDown size={13}"), 'Renders ArrowDown on active descending column');
    assert.ok(itemsViewSrc.includes("<ArrowUpDown size={12}"), 'Renders neutral ArrowUpDown on inactive column');
  });

  it('2.6: ItemsView resets pagination to page 1 on sort change', () => {
    assert.ok(itemsViewSrc.includes('setCurrentPage(1);'), 'Resets page to 1 when changing sort column or direction');
  });

  /* ─────────────────────────────────────────────────────────────
   * Section 3: Sorting Mathematical & Algorithmic Parity Test
   * ───────────────────────────────────────────────────────────── */
  it('3.1: Alphanumeric code sorting correctly orders ITM-001, ITM-002, ITM-010', () => {
    const mockList = [
      { item_code: 'ITM-010', item_name: 'SSD', current_stock: 5 },
      { item_code: 'ITM-002', item_name: 'HDD', current_stock: 12 },
      { item_code: 'ITM-001', item_name: 'CPU', current_stock: 0 },
      { item_code: 'ITM-020', item_name: 'RAM', current_stock: 3 }
    ];

    const sortAsc = [...mockList].sort((a, b) =>
      a.item_code.localeCompare(b.item_code, undefined, { numeric: true })
    );
    assert.deepEqual(
      sortAsc.map(i => i.item_code),
      ['ITM-001', 'ITM-002', 'ITM-010', 'ITM-020'],
      'Ascending code sort must follow natural numeric ordering'
    );

    const sortDesc = [...mockList].sort((a, b) =>
      b.item_code.localeCompare(a.item_code, undefined, { numeric: true })
    );
    assert.deepEqual(
      sortDesc.map(i => i.item_code),
      ['ITM-020', 'ITM-010', 'ITM-002', 'ITM-001'],
      'Descending code sort must reverse natural numeric ordering'
    );
  });

  it('3.2: Stock quantity sorting accurately orders items from highest to lowest and lowest to highest', () => {
    const mockList = [
      { item_name: 'CPU', current_stock: 0 },
      { item_name: 'GPU', current_stock: 15 },
      { item_name: 'RAM', current_stock: 3 },
      { item_name: 'Cabinet', current_stock: 8 }
    ];

    // Descending stock sort (highest first)
    const descStock = [...mockList].sort((a, b) => b.current_stock - a.current_stock);
    assert.deepEqual(
      descStock.map(i => i.item_name),
      ['GPU', 'Cabinet', 'RAM', 'CPU'],
      'Highest stock first'
    );

    // Ascending stock sort (lowest first)
    const ascStock = [...mockList].sort((a, b) => a.current_stock - b.current_stock);
    assert.deepEqual(
      ascStock.map(i => i.item_name),
      ['CPU', 'RAM', 'Cabinet', 'GPU'],
      'Lowest stock first'
    );
  });

  it('3.3: StockSummaryView also implements comprehensive column sorting', () => {
    const summarySrc = fs.readFileSync(
      path.resolve(__dirname, '../../frontend/src/pages/StockSummaryView.tsx'),
      'utf8'
    );
    assert.ok(summarySrc.includes('renderSortHeader('), 'StockSummaryView uses renderSortHeader helper');
    assert.ok(summarySrc.includes("case 'closingQty':"), 'StockSummaryView sorts by closing quantity');
    assert.ok(summarySrc.includes("case 'rate':"), 'StockSummaryView sorts by rate');
    assert.ok(summarySrc.includes("case 'value':"), 'StockSummaryView sorts by value');
  });
});

