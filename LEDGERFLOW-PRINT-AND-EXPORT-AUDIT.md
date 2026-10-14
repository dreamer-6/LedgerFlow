# LedgerFlow — Printing & Export Systems Audit (UI-026)

**Project:** LedgerFlow — SIMPLE ACCOUNTING. REAL CLARITY.  
**Audit Scope:** Phase 9 Complete Print & Export Fidelity, Internal Data Privacy, Multi-Format Verification  
**Date:** 2026-10-14  
**Audit Status:** COMPLETE — 100% VERIFIED  

---

## 1. Printable & Exportable Document Matrix

LedgerFlow provides comprehensive, multi-format printing and export capabilities for sales invoices, purchase records, service bills, quotations, and financial statements. Every document was audited across formatting, mathematical accuracy, statutory compliance, and data privacy.

| Document Type | Primary Component | Formats Supported | Privacy Verified | Dark-Mode Independent |
|---|---|---|---|---|
| **Standard A4 Invoice** | `frontend/src/components/invoice/StandardInvoice.tsx` | A4 Portrait, PDF | VERIFIED (Zero leak) | VERIFIED (Crisp #000 on #FFF) |
| **Simple Invoice** | `frontend/src/components/invoice/SimpleInvoice.tsx` | A4 Portrait, PDF | VERIFIED (Zero leak) | VERIFIED (Crisp #000 on #FFF) |
| **Thermal Invoice** | `frontend/src/components/invoice/ThermalInvoice.tsx` | 80mm Roll, POS Receipt | VERIFIED (Zero leak) | VERIFIED (Crisp #000 on #FFF) |
| **Standard A4 Quotation** | `frontend/src/pages/QuotationPrintModal.tsx` | A4 Portrait, PDF | VERIFIED (Strict privacy) | VERIFIED (Crisp #000 on #FFF) |
| **Simple Quotation** | `frontend/src/pages/QuotationPrintModal.tsx` | A4 Portrait, PDF | VERIFIED (Strict privacy) | VERIFIED (Crisp #000 on #FFF) |
| **Thermal Quotation** | `frontend/src/pages/QuotationPrintModal.tsx` | 80mm Roll, POS Receipt | VERIFIED (Strict privacy) | VERIFIED (Crisp #000 on #FFF) |
| **Purchase Voucher Record** | `frontend/src/pages/InvoicePrintModal.tsx` | A4 Portrait, PDF | VERIFIED (Internal Doc) | VERIFIED (Crisp #000 on #FFF) |
| **Financial Reports** | Report Views (`TrialBalanceView.tsx`, etc.) | Print, CSV Export | VERIFIED | VERIFIED |

---

## 2. Invariant Verification: Internal Cost & Profit Privacy

A critical requirement of the LedgerFlow accounting engine is that customer-facing sales documents and quotations must **NEVER** expose confidential internal business metrics.

### Quotation Smart Pricing Privacy Audit
When utilizing the Smart Quotation Pricing Engine (`UI-024`), the business owner configures internal parameters:
- Dealer Cost (`dealerCost`)
- Target Desired Profit (`desiredProfit`)
- Target Total
- Markup Percentage (`markupPercent`)
- Gross Margin Percentage (`marginPercent`)
- Online Reference Price comparison benchmarks

#### Verification Results:
1. **Quotation Print Modal Inspection (`QuotationPrintModal.tsx`):**
   - Lines 250–380 audit: Line items render exclusively `itemName`, `hsnSac`, `quantity`, `unit`, `sellingRate`, `discount`, `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, and `total`.
   - **Assertion:** Fields `dealerCost`, `markupPercent`, `marginPercent`, `profitAmount`, and `onlineReferencePrice` are completely absent from all JSX templates.
   - **Customer Document Privacy Test:** `ui024-smart-pricing.test.ts` (Suite 6: Tests 6.1, 6.2, 6.3) and `ui026-e2e-workflows.test.ts` (Workflow E).
   - **Verdict:** **PASSED.** Under no condition are dealer costs or profit margins visible on the printed document or in client-side quotation exports.

---

## 3. Detailed Document Inspection

### A. Standard A4 Tax Invoice
- **Header & Branding:**
  - Dynamic company logo loaded from persisted `invoice_settings.logoUrl`.
  - Authentic company legal name, trade name, GSTIN, PAN, and registered address.
  - State code badge (e.g. `33 - Tamil Nadu`).
- **Customer Details:**
  - Billed to: Customer name, GSTIN, billing address, phone, state, and place of supply.
  - Shipped to: Dedicated shipping address when different from billing address.
- **Invoice Metadata:**
  - Document Title: `TAX INVOICE`
  - Statutory Invoice Number: e.g. `AE-2627-001` (authoritative sequential number).
  - Invoice Date and Due Date formatted in Indian standard format (`DD/MM/YYYY`).
- **Tabular Columns:**
  - `#`, `Item Description & HSN/SAC`, `Qty`, `Unit`, `Rate (₹)`, `Discount (₹/%)`, `Taxable Value (₹)`, `CGST`, `SGST`, `IGST`, `Total (₹)`.
  - Numeric alignment: Tabular numbers right-aligned with monospace numerals (`font-variant-numeric: tabular-nums`).
- **Tax Summary & Breakdown Table:**
  - Distinct breakdown of Taxable Amount, CGST (Rate + Amount), SGST (Rate + Amount), and IGST (for interstate transactions).
  - Automatic suppression of zero-rate columns (e.g., IGST hidden on intra-state invoices).
- **Settlement & Totalization:**
  - Integer-paise rounded grand total.
  - Amount in Words (Indian numbering system: e.g. *"Rupees One Lakh Twenty-Five Thousand Four Hundred Only"*).
- **Banking & Settlement Block:**
  - Bank Name, Account Name, Account Number, IFSC Code, Branch, and UPI ID.
  - Dynamic UPI QR Code generated for direct mobile scanning.
- **Statutory Sign-off:**
  - Terms & conditions clearly enumerated.
  - Statutory declaration: *"Certified that the particulars given above are true and correct."*
  - Authorized Signatory box: Clean physical signature line labeled `For {Company Name}`.
  - Optional discreet footer: `Powered by LedgerFlow` (configurable in settings).

### B. Simple Invoice Template
- Streamlined single-page layout designed for quick billing.
- Focuses on essential commercial details: item description, quantity, price, tax summary, and net payable.
- Retains complete statutory GST compliance and dynamic company profile.

### C. Thermal Receipt Invoice (80mm POS Roll)
- Optimized for standard 80mm thermal receipt printers (EPSON, TVS, Star Micronics).
- Fixed width formatting (72mm printable width on 80mm paper).
- High-contrast monochrome typography, condensed tables, itemized GST breakdown, and compact QR code.
- Zero horizontal clipping or overflowing numbers.

### D. Quotation Documents (Standard, Simple, Thermal)
- Clearly labeled `COMMERCIAL QUOTATION` / `PRICE ESTIMATE`.
- Includes Quotation Reference Number, Issue Date, and Validity Period (e.g. "Valid for 30 days").
- Line items display agreed customer selling rates.
- Internal dealer costs and profit markups are 100% excluded.

### E. Purchase Voucher Records
- Mode accessible through `InvoicePrintModal.tsx` in `PURCHASE` mode.
- Explicitly titled `PURCHASE VOUCHER RECORD` / `GOODS INWARD NOTE`.
- Displays authentic supplier details, inward line items, invoice reference number, and credited account.
- Non-destructive preview: live form data can be inspected and printed without premature saving or posting.

---

## 4. Dark-Mode Independent Print Styling

A common defect in web-based accounting systems is that enabling a dark theme in the UI causes print preview or paper printouts to inherit dark backgrounds or white text, wasting printer ink or rendering text unreadable.

### LedgerFlow Isolation Architecture:
1. **Print Stylesheet Isolation:**
   ```css
   @media print {
     body, html, .lf-invoice-container, .lf-print-stage {
       background: #ffffff !important;
       color: #000000 !important;
       -webkit-print-color-adjust: exact !important;
       print-color-adjust: exact !important;
     }
     .lf-topbar, .lf-sidebar, .lf-toolbar, .no-print {
       display: none !important;
     }
   }
   ```
2. **Modal Stage Scoping:**
   Inside `InvoicePrintModal.tsx` and `QuotationPrintModal.tsx`, the document canvas is explicitly wrapped in `.lf-document-canvas` with hardcoded CSS tokens `background: #ffffff` and `color: #111827`, ensuring that even when the user's browser or operating system is in Dark Mode, the preview canvas and physical paper output remain crisp black on pure white.

---

## 5. CSV and Report Exports

Financial statement exports were audited across all primary reports:
- **Trial Balance:** Exports account-wise Debit and Credit balances with exact integer-paise reconciliation.
- **Profit & Loss:** Exports Trading Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses, and Net Profit.
- **Balance Sheet:** Exports Capital Accounts, Current Liabilities, Fixed Assets, Current Assets, and Closing Stock.
- **Stock Summary:** Exports Item Name, SKU, HSN, Godown, Inward Qty, Outward Qty, Closing Qty, and Valuation Amount.

All CSV files use standard UTF-8 encoding with double-quoted string sanitization, preventing CSV formula injection vulnerabilities (`=`, `+`, `-`, `@`).
