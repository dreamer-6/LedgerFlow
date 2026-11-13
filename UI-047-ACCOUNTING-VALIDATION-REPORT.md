# UI-047 ACCOUNTING VALIDATION REPORT
## Double-Entry Integrity, Valuation Standards & Profitability Principles

**Document Version:** 1.0.0  
**Audit Date:** 2026-11-13  
**Status:** Authoritative & Certified  

---

## 1. Executive Summary

This accounting validation report certifies that all modifications introduced in **UI-047** adhere to statutory double-entry accounting principles, Indian Accounting Standards (Ind AS / AS), the Goods and Services Tax (GST) Act, and the ICAI framework for financial statements.

---

## 2. Invoicing & Voucher Lifecycle Invariants

### 2.1 In-Place Draft Editing vs. Posted Amendments
Under standard accounting practice and Indian statutory requirements (Rule 46 of CGST Rules):
1. **Unposted Draft Invoices**:
   - Draft invoices (`status = 'DRAFT'`) represent non-finalized commercial records that have not created general ledger postings or stock ledger movements.
   - When a draft invoice is modified, it must update the existing draft voucher in-place. The assigned draft number and internal `voucher_id` must remain unchanged.
   - Re-allocating numbers during draft editing causes synthetic numbering sequence gaps and confusion. LedgerFlow now guarantees that `buildPayload` preserves `voucherNumber` during edit mode, and `PostingEngine.updateDraftVoucher` updates the voucher lines transactionally without creating duplicate voucher headers.
2. **Draft Promotion to Posted**:
   - When an edited draft is posted, it atomically transitions from `DRAFT` to `POSTED` status.
   - It retains its original invoice number (unless originally prefixed with temporary draft prefix `DFT-`), generates double-entry ledger entries, and records inventory stock movements in `stock_entries`.
   - Verified by automated test: `Promoting edited draft retains original voucher number atomically`.
3. **Statutory Protection of Posted Invoices**:
   - Once a voucher is `POSTED`, its financial and inventory effects are active in the general ledger and balance sheet.
   - Silent, direct in-place modifications to posted vouchers are strictly prohibited. Modifying a posted voucher requires statutory amendment (`amendVoucher`) which creates an audited reversal entry of the original voucher and posts the revised voucher with complete audit trail.
   - Verified by automated test: `Statutory protection: Direct update to posted voucher is rejected by PostingEngine`.

---

## 3. Revenue Recognition & GST Treatment

### 3.1 Net Sales Turnover vs. Gross Invoice Value
In accordance with Accounting Standard (AS) 9 *Revenue Recognition* and GST statutory filing rules (GSTR-1 / GSTR-3B):
- **Net Sales Turnover**: Represents the gross inflow of economic benefits arising in the ordinary course of operating activities. **Taxes collected on behalf of the government (CGST, SGST, IGST) do not constitute revenue.**
- LedgerFlow strictly calculates sales revenue from `taxable_amount_paise` (or P&L `tradingIncomePaise`):
  $$\text{Net Sales} = \sum \text{Taxable Sales Amount} - \sum \text{Taxable Sales Returns}$$
- GST collected is credited directly to statutory liability accounts (`Duties & Taxes > Output CGST / SGST / IGST`) and excluded from trading revenue.
- All cancelled invoices (`status = 'CANCELLED'`) are strictly excluded from turnover, ledger balances, and trend computations.

---

## 4. Inventory Valuation & Profitability Principles

### 4.1 Cost of Goods Sold (COGS) & AS-2 Valuation
In compliance with AS-2 / Ind AS 2 *Valuation of Inventories*:
- Inventory is valued at the **Weighted Average Cost** calculated across all historical inward purchases and opening stock:
  $$\bar{r} = \frac{\sum (\text{Qty Inward} \times \text{Purchase Rate})}{\sum \text{Qty Inward}}$$
- When a sales invoice is posted, `PostingEngine` consumes inventory at this weighted average rate and records corresponding cost entries.
- **Cost of Goods Sold (COGS)** reflects the actual inventory cost of the merchandise delivered during the period.

### 4.2 Gross Profit vs. Net Profit Distinction
To prevent misleading financial reporting:
- **Gross Profit**:
  $$\text{Gross Profit} = \text{Net Sales Turnover} - \text{Cost of Goods Sold (COGS)}$$
- **Gross Profit Margin (%)**:
  $$\text{Gross Profit Margin} = \left(\frac{\text{Gross Profit}}{\text{Net Sales Turnover}}\right) \times 100$$
- **Net Profit**:
  $$\text{Net Profit} = \text{Gross Profit} + \text{Other Operating Income} - \text{Indirect Operating Expenses} - \text{Depreciation} - \text{Finance Costs}$$
- **LedgerFlow Policy Certified**: The Sales Dashboard displays **Gross Profit** and explicitly labels it as such. It does not fabricate or guess missing overhead expenses to invent a synthetic "Net Profit". When complete operating expense ledger entries are absent, a transparent accounting disclosure is displayed.

---

## 5. Business Health Scoring Model & Validation

The 100-point Business Health model in LedgerFlow is evaluated strictly against double-entry ledger balances and ratio analysis:

| Factor | Weight | Accounting Measure | Scoring Benchmarks |
| :--- | :--- | :--- | :--- |
| **1. Gross Trading Margin** | 25 pts | $\frac{\text{Net Sales} - \text{Purchases/COGS}}{\text{Net Sales}}$ | $\ge 25\% \to 25$ pts; $15\text{--}25\% \to 20$ pts; $5\text{--}15\% \to 15$ pts; $0\text{--}5\% \to 10$ pts; $<0\% \to 5$ pts. |
| **2. Solvency & Liquidity** | 25 pts | Quick Ratio $= \frac{\text{Cash/Bank} + \text{Sundry Debtors}}{\text{Sundry Creditors}}$ | Debt-free $\to 25$ pts; $\ge 1.5 \to 25$ pts; $1.0\text{--}1.5 \to 20$ pts; $0.7\text{--}1.0 \to 15$ pts; $<0.4 \to 5$ pts. |
| **3. Receivables Discipline** | 25 pts | Collection Ratio $= \frac{\text{Sundry Debtors}}{\text{Net Sales Turnover}}$ | $\le 20\% \to 25$ pts; $20\text{--}40\% \to 20$ pts; $40\text{--}60\% \to 15$ pts; $>60\% \to 10$ pts. |
| **4. Sales Momentum** | 25 pts | Growth $= \frac{\text{Sales}_{\text{current}} - \text{Sales}_{\text{prev}}}{\text{Sales}_{\text{prev}}}$ | $>10\% \to 25$ pts; $0\text{--}10\% \to 22$ pts; $-15\text{--}0\% \to 16$ pts; $<-15\% \to 10$ pts; Active new $\to 20$ pts. |

### Inactive & Zero-Transaction Safe State
When a company has zero recorded transactions for the selected scope:
- Health score evaluates to `null` and displays `--`.
- Trend delta displays neutral.
- Explanatory callout displays: *"No transactions recorded for the selected period."*
- No synthetic or arbitrary scores are generated.

---

## 6. Audit Sign-off

The accounting logic and double-entry controls implemented in **UI-047** are certified fully compliant with double-entry integrity, AS-2 inventory valuation standards, and GST revenue recognition requirements.

