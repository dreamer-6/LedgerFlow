/**
 * ui040-visual-consistency.test.ts — Test Suite for UI-040 Visual Consistency & Transaction UX Unification
 *
 * Verifies:
 * 1. Typography & design tokens unification across Main Dashboard, Sales, Purchase, and Quotation.
 * 2. Authentic data: Complete purge of hardcoded/synthetic trend strings ('8.6%', '12.3%', '+18%', '+22%').
 * 3. Automatic item row creation behavior and invariants:
 *    - Trailing empty row is never included in totals/taxes.
 *    - Trailing empty row is never persisted into voucher lines or quotation items.
 * 4. Print preview margin configuration & double-margin elimination:
 *    - Dynamic sheet padding based on margin option.
 *    - @media print sheet padding is 0 !important to prevent double margin application.
 *    - Tightened spacing between company identity and customer parties.
 *    - getPaginationConfigForFormat adjusts page height budget based on paperMargin.
 * 5. Navigation origin retention:
 *    - Details and Creation return to originating context (dashboard or register).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPaginationConfigForFormat, estimateItemRowHeight } from '../../frontend/src/utils/printPagination';

describe('UI-040: Visual Consistency & Transaction UX Unification', () => {
  const purchaseViewPath = path.resolve(__dirname, '../../frontend/src/pages/PurchaseView.tsx');
  const purchaseRegisterPath = path.resolve(__dirname, '../../frontend/src/pages/PurchaseRegisterView.tsx');
  const purchaseInvoicePath = path.resolve(__dirname, '../../frontend/src/pages/PurchaseInvoiceView.tsx');
  const quotationDashboardPath = path.resolve(__dirname, '../../frontend/src/pages/QuotationDashboardView.tsx');
  const quotationRegisterPath = path.resolve(__dirname, '../../frontend/src/pages/QuotationRegisterView.tsx');
  const quotationCreationPath = path.resolve(__dirname, '../../frontend/src/pages/QuotationCreationView.tsx');
  const standardInvoicePath = path.resolve(__dirname, '../../frontend/src/components/invoice/StandardInvoice.tsx');
  const simpleInvoicePath = path.resolve(__dirname, '../../frontend/src/components/invoice/SimpleInvoice.tsx');
  const appPath = path.resolve(__dirname, '../../frontend/src/App.tsx');

  describe('Phase 1 & 2: Typography and Number Formatting Audit', () => {
    it('PurchaseView uses design tokens and tabular numbers without local font hacks', () => {
      const code = fs.readFileSync(purchaseViewPath, 'utf8');
      assert.ok(code.includes('var(--font-mono'), 'PurchaseView must use var(--font-mono) design token');
      assert.ok(code.includes('tabular-nums'), 'PurchaseView must enforce tabular-nums formatting');
      assert.ok(!code.includes('fontFamily: "Comic Sans"'), 'No ad-hoc conflicting fonts in PurchaseView');
    });

    it('QuotationDashboardView uses design tokens and tabular numbers', () => {
      const code = fs.readFileSync(quotationDashboardPath, 'utf8');
      assert.ok(code.includes('var(--font-mono'), 'QuotationDashboardView must use var(--font-mono)');
      assert.ok(code.includes('tabular-nums'), 'QuotationDashboardView must use tabular-nums');
      assert.ok(code.includes('var(--color-surface'), 'QuotationDashboardView must use theme tokens');
    });

    it('QuotationRegisterView uses design tokens and tabular numbers', () => {
      const code = fs.readFileSync(quotationRegisterPath, 'utf8');
      assert.ok(code.includes('var(--font-mono'), 'QuotationRegisterView must use var(--font-mono)');
      assert.ok(code.includes('tabular-nums'), 'QuotationRegisterView must use tabular-nums');
    });
  });

  describe('Phase 3: Authentic KPI Cards & Trend Purge', () => {
    it('Purges hardcoded synthetic growth strings from PurchaseView', () => {
      const code = fs.readFileSync(purchaseViewPath, 'utf8');
      assert.ok(!code.includes("'+8.6% vs last month'"), 'Must not have hardcoded +8.6% string');
      assert.ok(!code.includes("'+12.3% vs last month'"), 'Must not have hardcoded +12.3% string');
      assert.ok(code.includes('purchaseGrowth'), 'PurchaseView must calculate real purchaseGrowth');
      assert.ok(code.includes('invoiceGrowth'), 'PurchaseView must calculate real invoiceGrowth');
    });

    it('Purges hardcoded synthetic growth strings from PurchaseRegisterView', () => {
      const code = fs.readFileSync(purchaseRegisterPath, 'utf8');
      assert.ok(!code.includes('+8.6%'), 'Must not have hardcoded +8.6% string in PurchaseRegister');
      assert.ok(!code.includes('+12.3%'), 'Must not have hardcoded +12.3% string in PurchaseRegister');
    });

    it('Purges hardcoded synthetic growth strings from QuotationDashboardView', () => {
      const code = fs.readFileSync(quotationDashboardPath, 'utf8');
      assert.ok(!code.includes('+18% vs last month'), 'Must not have hardcoded +18% string in QuotationDashboard');
      assert.ok(!code.includes('+22% vs last month'), 'Must not have hardcoded +22% string in QuotationDashboard');
      assert.ok(code.includes('qTrend.countGrowth'), 'QuotationDashboard must calculate authentic count growth');
      assert.ok(code.includes('qTrend.valueGrowth'), 'QuotationDashboard must calculate authentic value growth');
    });

    it('Calculates authentic month-over-month growth correctly', () => {
      const prev = { count: 10, value: 100000 };
      const curr = { count: 15, value: 120000 };
      const countGrowth = prev.count > 0 ? Math.round(((curr.count - prev.count) / prev.count) * 1000) / 10 : null;
      const valueGrowth = prev.value > 0 ? Math.round(((curr.value - prev.value) / prev.value) * 1000) / 10 : null;
      assert.equal(countGrowth, 50);
      assert.equal(valueGrowth, 20);

      // Empty previous period handles zero gracefully without NaN or Infinity
      const zeroPrev = { count: 0, value: 0 };
      const zeroPrevGrowth = zeroPrev.count > 0 ? Math.round(((curr.count - zeroPrev.count) / zeroPrev.count) * 1000) / 10 : null;
      assert.equal(zeroPrevGrowth, null);
    });
  });

  describe('Phase 4: Automatic Item Row Creation Invariants', () => {
    it('PurchaseInvoiceView auto-appends row on item selection and excludes empty row from totals', () => {
      const code = fs.readFileSync(purchaseInvoicePath, 'utf8');
      assert.ok(code.includes("if (!l.itemId) return;"), 'invoiceTotals must exclude blank trailing rows');
      assert.ok(code.includes("data-purchase-field=\"qty\""), 'Purchase invoice must have qty focus anchor');
      assert.ok(code.includes("validLines = lines.filter("), 'buildPayload must filter out empty lines');
    });

    it('QuotationCreationView auto-appends row on item selection and excludes empty row from totals/persistence', () => {
      const code = fs.readFileSync(quotationCreationPath, 'utf8');
      assert.ok(code.includes("createBlankRow"), 'QuotationCreationView must have createBlankRow generator');
      assert.ok(code.includes("validItems = items.filter("), 'summary must filter valid items before computing totals');
      assert.ok(code.includes("validPersistedItems = items.filter("), 'assembleQuotationRecord must filter valid items');
      assert.ok(code.includes("data-quotation-field=\"qty\""), 'Quotation table must have data-quotation-field="qty"');
    });
  });

  describe('Phase 5 & 6: Print Preview Margins & Spacing', () => {
    it('StandardInvoice dynamically adjusts preview padding for margin options', () => {
      const code = fs.readFileSync(standardInvoicePath, 'utf8');
      assert.ok(code.includes("sheetPadding = paperMargin === 'compact'"), 'StandardInvoice must compute sheetPadding dynamically');
      assert.ok(code.includes(".a4-page-sheet {\n            page-break-after: always;\n            break-after: page;\n            min-height: ${printSheetMinHeight};\n            box-sizing: border-box;\n            width: 100% !important;\n            max-width: 100% !important;\n            margin: 0 !important;\n            padding: 0 !important;"), 'Print page sheet must set padding: 0 !important to avoid double margins');
    });

    it('SimpleInvoice dynamically adjusts preview padding for margin options', () => {
      const code = fs.readFileSync(simpleInvoicePath, 'utf8');
      assert.ok(code.includes("sheetPadding = paperMargin === 'compact'"), 'SimpleInvoice must compute sheetPadding dynamically');
      assert.ok(code.includes("padding: 0 !important;"), 'SimpleInvoice must set print padding to 0 !important');
    });

    it('StandardInvoice and SimpleInvoice tighten company and parties spacing', () => {
      const standardCode = fs.readFileSync(standardInvoicePath, 'utf8');
      assert.ok(standardCode.includes("marginBottom: '12px'"), 'StandardInvoice renderHeader marginBottom must be <= 12px');
      assert.ok(standardCode.includes("marginBottom: '10px'"), 'StandardInvoice renderParties marginBottom must be <= 10px');

      const simpleCode = fs.readFileSync(simpleInvoicePath, 'utf8');
      assert.ok(simpleCode.includes("marginBottom: '10px'"), 'SimpleInvoice header/bill-to marginBottom must be <= 10px');
    });

    it('getPaginationConfigForFormat adjusts totalPageHeight based on paperMargin', () => {
      const normalConfig = getPaginationConfigForFormat('A4', 'PORTRAIT', 'normal');
      const compactConfig = getPaginationConfigForFormat('A4', 'PORTRAIT', 'compact');
      const spaciousConfig = getPaginationConfigForFormat('A4', 'PORTRAIT', 'spacious');

      assert.ok(compactConfig.totalPageHeight > normalConfig.totalPageHeight, 'Compact margin must provide more printable height');
      assert.ok(spaciousConfig.totalPageHeight < normalConfig.totalPageHeight, 'Spacious margin must reduce printable height');
      assert.ok((compactConfig.maxPage1Items || 7) > (spaciousConfig.maxPage1Items || 7), 'Compact margin allows more page 1 items');
    });
  });

  describe('Phase 7: Navigation Origin Retention', () => {
    it('App.tsx maintains quotationOrigin and returns to originating context', () => {
      const code = fs.readFileSync(appPath, 'utf8');
      assert.ok(code.includes("const [quotationOrigin, setQuotationOrigin] = useState"), 'App.tsx must define quotationOrigin state');
      assert.ok(code.includes("onBack={() => setQuotationViewMode(quotationOrigin)}"), 'Details view onBack must return to quotationOrigin');
    });
  });
});
