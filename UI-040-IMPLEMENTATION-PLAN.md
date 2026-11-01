# UI-040 Implementation Plan: LedgerFlow Visual Consistency & Transaction UX Unification

**Objective:** Complete the visual and functional consistency pass across Main Dashboard, Sales, Purchase, and Quotation. Re-use existing architecture and tokens, preserving all UI-039 additions (Quotation Dashboard, Register, Details, GST presentation setting, print adapter fixes, and Smart Pricing).

---

## 1. Visual Source-of-Truth Audit (Phase 1)

The **Main Dashboard** (`DashboardView.tsx`) and **Sales Module** (`SalesView.tsx`, `SalesRegisterView.tsx`, `SalesInvoiceView.tsx`) establish the authoritative design tokens and visual language:

### 1.1 Design Specification Matrix
| Visual Property | Authoritative Source (Main Dashboard & Sales) | Current Purchase & Quotation Inconsistencies | Target Unification |
|---|---|---|---|
| **Font Family** | Inter (`'Inter', system-ui, sans-serif`) for UI; JetBrains Mono (`var(--font-mono, 'JetBrains Mono', monospace)`) for figures and codes | Purchase & Quotation occasionally fall back to system monospace or unstyled serif | Enforce `var(--font-mono)` for all amounts, HSN, voucher numbers, and dates |
| **Numeric Typography** | `font-variant-numeric: tabular-nums; font-family: var(--font-mono); font-weight: 700 / 800;` right-aligned in tables | Inconsistent font weights (500 vs 800), mixed font families | Uniform `tabular-nums`, `font-family: var(--font-mono)`, right alignment for currency |
| **Currency Format** | Indian numbering with `₹` prefix and 2 decimal places in tables/details, rounded integer in large KPI cards: e.g. `₹ 12,48,320` or `₹ 60,000.00` | Inconsistent spacing (`₹` vs `₹ `) and mixed decimal precisions | Standardized `formatINR` / `formatCurrency` with uniform `en-IN` comma grouping |
| **KPI Card Structure** | Card with `border-radius: 12px`, `padding: 16px 18px`, `border: 1px solid var(--color-border)`, themed background `var(--color-surface)`, subtle hover lift | Purchase & Quotation cards had inline hardcoded `#FFFFFF`, static `#E2E8F0` borders, or missing hover transitions | Uniform card container matching `.lf-kpi-card-mockup` and `.ledger-card` |
| **KPI Icon Badge** | 28px–34px rounded box with 10% opacity tinted background matching the icon theme | Unboxed icons or raw SVG without container in some cards | 28px–34px tinted rounded badge (`borderRadius: 8px`, 10% fill) for every KPI icon |
| **KPI Trends & Sparklines** | Authentic calculations comparing current vs previous period, positive green (`#10B981` / `#16A34A`), negative red (`#EF4444`), or neutral "Active Period". Dynamic miniature bars strictly proportional to data | Hardcoded `+18%`, `+22%`, `8.6%`, `12.3%` and static span bars | **Purge all hardcoded percentages and static bars**. Calculate authentic trends from actual voucher/quote records or display "Active Period" / "All Time" |
| **Table Headings & Text** | Heading `text-sm font-semibold text-slate-500 uppercase tracking-wider`, body `text-xs / text-sm` | Mixed font sizes and weights | Uniform typography scale across all registers and view screens |

---

## 2. Typography and Number Formatting (Phase 2)

1. **Font Tokens**: Ensure all screens rely on the central CSS variables:
   - `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
   - `--font-mono`: `'JetBrains Mono', monospace`
2. **Heading & Body Hierarchy**:
   - Page Titles: `24px` (`text-2xl`), `font-weight: 700 / 800`, letter-spacing `-0.02em`, `color: var(--color-text, #0F172A)`.
   - Subtitles: `13px / 13.5px`, `color: var(--color-text-secondary, #64748B)`.
   - Section Titles: `14px / 16px`, `font-weight: 700`.
   - Table Headers: `11px / 11.5px`, `font-weight: 600`, uppercase, `color: var(--color-text-muted, #64748B)`.
   - Table Body: `12.5px / 13px`, `color: var(--color-text, #0F172A)`.
   - Financial Table Amounts: `font-family: var(--font-mono)`, `font-weight: 600 / 700`, `font-variant-numeric: tabular-nums`, right-aligned.
3. **Currency Standardization**:
   - `formatINR(paise, { decimals: true/false })` applied consistently across Main Dashboard, Sales, Purchase, and Quotation.

---

## 3. KPI Card Visual Unification (Phase 3)

### 3.1 Purchase Dashboard
- Unify 5 cards with theme tokens:
  1. **Total Purchases**: Real `totalPurchasesPaise`, monthly purchase trend calculated from voucher dates (this month vs last month), mini-bars proportional to real monthly purchases.
  2. **Total Invoices**: Real invoice count, real count trend, mini-bars proportional to monthly counts.
  3. **Outstanding To Pay**: Real payables balance from supplier outstanding.
  4. **Paid Invoices**: Real paid count and payment progress ring or percentage.
  5. **Suppliers**: Active supplier count and activity indicator.
- **Eliminate hardcoded `8.6%` and `12.3%`**. If prior month data does not exist, show "Active Period" or "FY 2026-27".

### 3.2 Purchase Register
- 5 summary cards: Total Purchases, Total Invoices, Posted Invoices, Draft Invoices, Cancelled Invoices.
- Reconcile strictly with actual records and active filters.
- Remove hardcoded percentages.

### 3.3 Quotation Dashboard
- 5 cards: Total Quotations, Total Quoted Value, Converted to Sales, Awaiting Response, Expired.
- **Eliminate hardcoded `+18%` and `+22%`**. Calculate authentic month-over-month trend from `quotations` array, or show "All Time" / "Active Period".
- Dynamic mini-bars derived from actual monthly quotation volumes.
- Circular conversion ring or authentic conversion rate.

### 3.4 Quotation Register
- Reconcile 5 KPI cards with actual register records: Total Quotations, Converted, Awaiting Response, Rejected, Expired.

---

## 4. Automatic Item Row Creation (Phase 4)

Adopt the established Sales Invoice row creation pattern in:
1. **Purchase Invoice Creation** (`PurchaseInvoiceView.tsx`)
2. **Quotation Creation** (`QuotationCreationView.tsx`)

### Rules & Invariants:
1. When an item is selected or completed on the last row (`index === lines.length - 1`), automatically append **one** trailing blank row.
2. Advance focus logically to the next row's item or quantity field.
3. Do not create unlimited blank rows: maintain **at most one** trailing blank row. If the last row is already blank, do not append another.
4. Trailing blank rows must **never** be included in totals, tax calculations, or saved payloads.
5. Deleting an item must preserve at least one row, and if deleting leaves no blank row at the end, maintain one valid entry state.
6. Keyboard navigation (Tab, Enter, Arrow keys) and manual "Add Row" / "New Item" remain fully functional.

---

## 5. Print Preview Margins (Phase 5)

1. **Synchronize Preview & Print Margins**:
   - In `InvoicePrintModal.tsx` and `StandardInvoice.tsx`, `paperMargin` options:
     - `'compact'` (Narrow): Preview padding `14px 18px` / Print `@page { margin: 5mm }`
     - `'normal'` (Normal): Preview padding `24px 28px` / Print `@page { margin: 8mm }`
     - `'spacious'` (Wide): Preview padding `36px 40px` / Print `@page { margin: 14mm }`
2. **Prevent Double-Margin Application**:
   - When printing via iframe / `@media print`, set `.a4-page-sheet` padding to `0 !important` so the `@page { margin: ... }` rule controls page margins cleanly without compounding container padding.
3. **Pagination Budgeting**:
   - `getPaginationConfigForFormat` in `printPagination.ts` adjusted for `paperMargin` so that spacious margins budget fewer items safely and prevent footer clipping.

---

## 6. Company and Customer Information Spacing (Phase 6)

1. **Reduce Vertical Padding**:
   - In `StandardInvoice.tsx` and `SimpleInvoice.tsx`, reduce `renderHeader` `marginBottom` from `20px` to `12px`.
   - Reduce `renderParties` `marginBottom` from `16px` to `10px`.
   - Compact company contacts and statutory details with clean grid alignment.
   - Maintain clear separation between Company Header and Bill To / Ship To cards without awkward vertical chasms.
2. Ensure document metadata box (Invoice/Quotation No, Date, Due Date, Place of Supply) is neatly aligned with company identity on Page 1.

---

## 7. Navigation Behavior (Phase 7)

1. **Sidebar Accordion**:
   - Primary `Quotation` sidebar item opens `Quotation Dashboard` and expands the section.
   - Sub-items: (1) `Quotation Dashboard`, (2) `Create Quotation`, (3) `Quotation Register`.
   - Single-open accordion logic matches Sales and Purchase.
2. **Details Navigation Context**:
   - Track `quotationOriginatingView`: `'dashboard'` or `'register'`.
   - When user clicks a quotation from the Dashboard recent table, opening details and then clicking "Back" returns to the Dashboard.
   - When user clicks from Register, clicking "Back" returns to Register.

---

## 8. Regression & Verification (Phase 8)

1. Automated test suite for UI-040:
   - Typography & formatting tests.
   - KPI card calculation & zero-synthetic data tests.
   - Automatic row creation & trailing blank row filtering tests.
   - Print margin & spacing configuration tests.
   - Quotation navigation origin tracking tests.
2. Regression runs:
   - UI-039 quotation test suite (`ui039-quotation-rebuild.test.ts`).
   - Smart Pricing test suite (`ui024-smart-pricing.test.ts`).
   - Purchase test suites.
   - Frontend TypeScript check (`tsc`) & Vite production build (`npm run build`).
