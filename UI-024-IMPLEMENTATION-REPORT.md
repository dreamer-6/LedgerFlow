TASK: UI-024.2
TITLE: Smart Pricing Rounding Options and Dealer-Based Quotation Workflow

OBJECTIVE

Extend the existing Smart Pricing implementation to support nearest-₹50 rounding and make dealer-cost-based quotation pricing reliable for real business use.

Do not redesign the existing centered Smart Pricing modal.

1. ROUNDING OPTIONS

Add these rounding choices to the existing Rounding selector:

- Exact ₹0.01
- Nearest ₹1
- Nearest ₹5
- Nearest ₹10
- Nearest ₹50
- Nearest ₹100

Use integer-paise arithmetic and deterministic rounding.

For positive values, exact halfway amounts round upward to the next multiple.

Examples for nearest ₹50:
₹8,324 → ₹8,300
₹8,325 → ₹8,350
₹7,975 → ₹8,000
₹2,225 → ₹2,250

Ensure the selected rounding rule is actually applied to suggested selling prices. Do not merely change the selector's appearance.

2. DEALER-COST-BASED PRICING

Preserve the existing pricing methods:

- Target Profit
- Target Total
- Markup Percentage
- Gross Margin Percentage
- Manual Pricing

Use the actual item acquisition cost from the authoritative item master when available, or an explicitly entered internal quotation cost when it is missing.

Never infer dealer cost from customer selling price.

If dealer cost is missing, display Cost not set and prevent misleading cost-based profit claims.

Clearly distinguish unit cost from total line cost.

For quantity greater than one:
Line cost = Unit dealer cost × Quantity.

3. ROUNDING AND PROFIT RECONCILIATION

Apply rounding to the intended selling-price unit values.

After rounding, recalculate:

- Item selling amounts.
- Taxable subtotal.
- GST.
- Round-off.
- Grand total.
- Actual profit.
- Actual markup percentage.
- Actual gross margin percentage.
- Difference from the desired profit or target total.

Do not report the original target as achieved when rounding has changed the result.

If exact target reconciliation is possible without violating the selected rounding rule, use deterministic remainder allocation.

If the target cannot be achieved while every item remains a multiple of ₹50, disclose the difference instead of silently violating the rounding choice.

Manual selling-price overrides must remain respected and clearly identified.

4. GST MODE

Support GST-exclusive and GST-inclusive pricing.

Use the existing authoritative GST engine and current quotation tax rules.

Do not add GST twice.

Ensure rounding, tax calculation and final quotation totals reconcile consistently.

5. REAL QUOTATION REGRESSION

Use the supplied historical hardware quotation as a regression fixture.

Preserve its source values exactly in the test fixture.

Test:
- Different dealer costs across products.
- Fixed desired profit.
- Markup percentage.
- Gross margin percentage.
- Nearest ₹50 rounding.
- Quantity greater than one.
- Mixed tax rates.
- Missing acquisition costs.
- Manual price overrides.
- Exact target reconciliation where possible.
- Honest discrepancy reporting where exact reconciliation is impossible.

Do not import this historical quotation into production as a real transaction.

6. CUSTOMER DOCUMENT PRIVACY

Dealer cost, internal profit, markup and gross margin must never appear on customer-facing quotation printouts or exports.

Verify Standard A4, Simple and Thermal layouts.

7. TESTING AND REPORTING

Add regression tests for every rounding increment and all midpoint cases.

Run the focused pricing tests, full backend test suite and frontend production build.

Perform browser testing where available and report actual results.

Update UI-024-IMPLEMENTATION-REPORT.md and STATUS.md.

Do not claim success based solely on compilation.

Preserve existing accounting, inventory, quotation and security behavior.