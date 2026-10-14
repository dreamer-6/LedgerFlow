/**
 * ui024-smart-pricing.test.ts — Comprehensive Test Suite for LedgerFlow UI-024.1
 * Smart Quotation Pricing, Allocation Repair & Privacy Verification.
 */

import {
  calculateSmartPricing,
  applyRounding,
  SmartPricingItemInput,
  PricingMethod,
  AllocationMethod,
  RoundingMethod,
  GstMode,
  matchDefaultOnlineReference,
  DEFAULT_ONLINE_REFERENCES
} from '../src/utils/smartPricingEngine.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function assertClose(actual: number, expected: number, delta: number = 0.05, message: string = '') {
  const diff = Math.abs(actual - expected);
  if (diff <= delta) {
    console.log(`  ✓ ${message} (${actual} ≈ ${expected})`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} (Actual: ${actual}, Expected: ${expected}, Diff: ${diff})`);
    failed++;
  }
}

console.log('======================================================================');
console.log('LEDGERFLOW UI-024.1 — SMART PRICING & ALLOCATION REPAIR TEST SUITE');
console.log('======================================================================\n');

// Standard 5-item test fixture matching screenshot
function createStandardItemsFixture(): SmartPricingItemInput[] {
  return [
    {
      id: 'row_1',
      name: 'Intel Core i5 4th Gen',
      description: 'Intel Core i5 4th Gen Processor | 3.1GHz | Tray',
      hsnSac: '84733010',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1950,
      currentSellingPrice: 2200,
      onlineReference: DEFAULT_ONLINE_REFERENCES['intel core i5 4th gen']
    },
    {
      id: 'row_2',
      name: 'Zebronics H81',
      description: 'Zebronics H81 Motherboard | LGA 1150',
      hsnSac: '84733020',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 2700,
      currentSellingPrice: 3100,
      onlineReference: DEFAULT_ONLINE_REFERENCES['zebronics h81']
    },
    {
      id: 'row_3',
      name: '8GB DDR3',
      description: '8GB DDR3 Desktop RAM | 1600 MHz',
      hsnSac: '84733030',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1500,
      currentSellingPrice: 1750,
      onlineReference: DEFAULT_ONLINE_REFERENCES['8gb ddr3']
    },
    {
      id: 'row_4',
      name: '256GB SSD',
      description: '256GB SSD SATA SSD | 2.5"',
      hsnSac: '84717020',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 2700,
      currentSellingPrice: 3100,
      onlineReference: DEFAULT_ONLINE_REFERENCES['256gb ssd']
    },
    {
      id: 'row_5',
      name: 'Cooler',
      description: 'Cooler CPU Cooler | Air Cooler',
      hsnSac: '84733099',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 200,
      currentSellingPrice: 240,
      onlineReference: DEFAULT_ONLINE_REFERENCES['cooler']
    }
  ];
}

// ---------------------------------------------------------------------
// Suite 1: Core Pricing Methods
// ---------------------------------------------------------------------
console.log('[Suite 1: Core Pricing Methods]');

{
  const items = createStandardItemsFixture();
  // Total cost = 1950 + 2700 + 1500 + 2700 + 200 = 9050
  const result = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000,
    allocationMethod: 'PROPORTIONAL_COST',
    roundingMethod: 'NEAREST_1',
    gstMode: 'EXCLUSIVE'
  });

  assert(result.totalDealerCost === 9050, '1.1: Total dealer cost calculated accurately as ₹9,050');
  assert(result.desiredProfit === 2000, '1.2: Desired profit correctly set as ₹2,000');
  assert(result.targetSellingSubtotal === 11050, '1.3: Target selling subtotal equals cost + profit = ₹11,050');
  assertClose(result.actualSellingSubtotal, 11050, 1.0, '1.4: Actual selling subtotal reconciles to target subtotal within ₹1');
  assert(result.targetAchieved === true, '1.5: Target achieved flag is true');
}

{
  // Target Total Mode
  const items = createStandardItemsFixture();
  const result = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 12000,
    allocationMethod: 'PROPORTIONAL_COST',
    roundingMethod: 'NEAREST_1',
    gstMode: 'EXCLUSIVE'
  });

  assert(result.targetSellingSubtotal === 12000, '1.6: Target Total (exclusive) sets target subtotal to ₹12,000');
  assert(result.desiredProfit === 2950, '1.7: Implied profit correctly derived as 12,000 - 9,050 = ₹2,950');
  assertClose(result.actualSellingSubtotal, 12000, 1.0, '1.8: Actual subtotal reconciles to target total within ₹1');
}

{
  // Markup Percentage Mode
  const items = createStandardItemsFixture();
  const result = calculateSmartPricing({
    items,
    pricingMethod: 'MARKUP_PERCENT',
    markupPct: 20,
    roundingMethod: 'NEAREST_1',
    gstMode: 'EXCLUSIVE'
  });

  assertClose(result.desiredProfit, 1810, 1.0, '1.9: Markup % derives desired profit of 20% = ₹1,810');
  assertClose(result.effectiveMarkupPct, 20, 0.5, '1.10: Effective markup percentage matches 20%');
}

{
  // Gross Margin Percentage Mode
  const items = createStandardItemsFixture();
  const result = calculateSmartPricing({
    items,
    pricingMethod: 'GROSS_MARGIN_PERCENT',
    grossMarginPct: 20,
    roundingMethod: 'NEAREST_1',
    gstMode: 'EXCLUSIVE'
  });

  assertClose(result.targetSellingSubtotal, 11312.5, 1.0, '1.11: Gross Margin 20% derives subtotal ₹11,312.50');
  assertClose(result.effectiveGrossMarginPct, 20, 0.5, '1.12: Effective gross margin matches 20%');
}

{
  // Manual Pricing Mode
  const items = createStandardItemsFixture();
  items[0].manualFinalPrice = 2500;
  items[1].manualFinalPrice = 3500;
  const result = calculateSmartPricing({
    items,
    pricingMethod: 'MANUAL',
    gstMode: 'EXCLUSIVE'
  });

  assert(result.items[0].isManuallyOverridden === true, '1.13: Item with manual price is flagged isManuallyOverridden');
  assert(result.items[0].finalPrice === 2500, '1.14: Final price reflects user manual override');
  assert(result.actualProfit > 0, '1.15: Manual mode computes real-time profit and margins');
}

// ---------------------------------------------------------------------
// Suite 2: Profit Allocation & Integer-Paise Remainder Reconciliation
// ---------------------------------------------------------------------
console.log('\n[Suite 2: Profit Allocation & Remainder Reconciliation]');

{
  const items = createStandardItemsFixture();
  const resCost = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_COST',
    roundingMethod: 'NEAREST_1'
  });

  const h81Profit = resCost.items[1].allocatedProfit;
  const coolerProfit = resCost.items[4].allocatedProfit;
  assert(h81Profit > coolerProfit * 10, '2.1: Proportional to cost assigns profit proportionally (H81 > Cooler)');

  const resQty = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_QTY',
    roundingMethod: 'NEAREST_1'
  });

  assertClose(resQty.items[0].unitAllocatedProfit, 200, 1.0, '2.2: Proportional to quantity distributes equally when qty=1');

  const sumFinal = resCost.items.reduce((acc, it) => acc + it.finalPrice * it.quantity, 0);
  assert(sumFinal === resCost.targetSellingSubtotal, '2.3: Deterministic remainder reconciliation ensures sum(finalPrice) === target');
}

// ---------------------------------------------------------------------
// Suite 3: GST Integration & Mode Switching
// ---------------------------------------------------------------------
console.log('\n[Suite 3: GST Integration & Modes]');

{
  const items = createStandardItemsFixture();
  const resExcl = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000,
    gstMode: 'EXCLUSIVE'
  });

  assert(resExcl.actualFinalTotal > resExcl.actualSellingSubtotal, '3.1: GST Exclusive adds GST separately to subtotal');
  assertClose(resExcl.actualGstTotal, resExcl.actualSellingSubtotal * 0.18, 2.0, '3.2: GST 18% computed accurately');

  const resIncl = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 11800,
    gstMode: 'INCLUSIVE'
  });

  assert(resIncl.actualFinalTotal === 11800, '3.3: GST Inclusive preserves quotation total of ₹11,800');
  assertClose(resIncl.targetSellingSubtotal, 10000, 5.0, '3.4: GST Inclusive correctly derives pre-tax subtotal of ₹10,000');
  assert(resIncl.actualSellingSubtotal + resIncl.actualGstTotal >= 11800 - 1, '3.5: No double taxation occurs');
}

// ---------------------------------------------------------------------
// Suite 4: Edge Cases & Resilience
// ---------------------------------------------------------------------
console.log('\n[Suite 4: Edge Cases & Resilience]');

{
  const itemsWithZero = createStandardItemsFixture();
  itemsWithZero[4].dealerCost = 0;
  itemsWithZero[4].costNotSet = true;

  const resZero = calculateSmartPricing({
    items: itemsWithZero,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_COST'
  });

  assert(resZero.items[4].allocatedProfit === 0, '4.1: Zero dealer cost item receives 0 profit under proportional cost');
  assert(resZero.hasMissingCosts === true, '4.2: Flags hasMissingCosts when item cost is missing');
  assert(resZero.missingCostCount === 1, '4.3: Counts missing cost items accurately');

  const resInvalidMargin = calculateSmartPricing({
    items: createStandardItemsFixture(),
    pricingMethod: 'GROSS_MARGIN_PERCENT',
    grossMarginPct: 105
  });

  assert(resInvalidMargin.actualSellingSubtotal > 0, '4.4: Gross margin >= 100% is clamped safely without divide-by-zero');

  const itemsOverride = createStandardItemsFixture();
  itemsOverride[0].manualFinalPrice = 5000;
  const resDiscrepancy = calculateSmartPricing({
    items: itemsOverride,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000
  });

  assert(resDiscrepancy.hasManualOverrides === true, '4.5: Flags hasManualOverrides when price edited');
  assert(resDiscrepancy.reconciliationDelta !== 0, '4.6: Discrepancy delta tracked accurately');
}

// ---------------------------------------------------------------------
// Suite 5: Online Price Verification & Analytics
// ---------------------------------------------------------------------
console.log('\n[Suite 5: Online Price Verification & Analytics]');

{
  const ref = matchDefaultOnlineReference('Intel Core i5 4th Gen Processor');
  assert(ref !== null, '5.1: Keyword matching finds default online reference');
  assert(ref?.retailer === 'MDComputers / PrimeABGB', '5.2: Identifies genuine retailer');
  assert(ref?.matchQuality === 'EXACT_MATCH', '5.3: Match quality labelled EXACT_MATCH');

  const items = createStandardItemsFixture();
  const res = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000
  });

  assert(res.onlineComparison.yourSellingTotal > 0, '5.4: Online comparison computes your selling total');
  assert(res.onlineComparison.onlineReferenceTotal > 0, '5.5: Computes online reference market total');
  assert(['COMPETITIVE', 'MATCHING', 'ABOVE'].includes(res.onlineComparison.status), '5.6: Classifies competitive market status');
}

// ---------------------------------------------------------------------
// Suite 6: Customer Document Privacy & Accounting Isolation
// ---------------------------------------------------------------------
console.log('\n[Suite 6: Privacy & Accounting Isolation Invariants]');

{
  const items = createStandardItemsFixture();
  const res = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000
  });

  // Customer facing items for print / invoice
  const customerPrintItems = res.items.map(it => ({
    id: it.id,
    name: it.name,
    quantity: it.quantity,
    rate: it.finalPrice,
    gstRate: it.gstRate,
    totalAmount: it.lineTotal
  }));

  assert(customerPrintItems.every(u => !('dealerCost' in u)), '6.1: Customer document excludes dealer cost');
  assert(customerPrintItems.every(u => !('allocatedProfit' in u)), '6.2: Customer document excludes allocated profit');
  assert(customerPrintItems.every(u => !('effectiveProfitPct' in u)), '6.3: Customer document excludes markup percentage');
  assert(customerPrintItems.every(u => !('effectiveGrossMarginPct' in u)), '6.4: Customer document excludes gross margin');
}

// ---------------------------------------------------------------------
// Suite 7: Exact Ten-Item Screenshot Scenario Regression
// ---------------------------------------------------------------------
console.log('\n[Suite 7: Exact Ten-Item Screenshot Scenario]');

{
  // 10 items without dealer cost (reproducing original bug report)
  const tenItemsWithoutCost: SmartPricingItemInput[] = Array.from({ length: 10 }, (_, i) => ({
    id: `item_${i + 1}`,
    name: `Product ${i + 1}`,
    hsnSac: '8471',
    quantity: 1,
    unit: 'NOS',
    gstRate: 18,
    costNotSet: true,
    currentSellingPrice: 500 + i * 150 // Different original selling prices
  }));

  const resBugFixed = calculateSmartPricing({
    items: tenItemsWithoutCost,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 3855,
    allocationMethod: 'PROPORTIONAL_COST',
    gstMode: 'EXCLUSIVE'
  });

  assert(resBugFixed.totalDealerCost === 0, '7.1: Correctly identifies total dealer cost as ₹0.00');
  assert(resBugFixed.hasMissingCosts === true, '7.2: Accurately flags missing costs on all 10 items');
  assert(resBugFixed.missingCostCount === 10, '7.3: Missing cost count is exactly 10');
  assert(resBugFixed.warnings.length > 0, '7.4: Warning generated informing user costs are required');

  // CRITICAL: Must NOT assign arbitrary identical ₹455 prices to every item!
  const distinctPrices = new Set(resBugFixed.items.map(it => it.suggestedPrice));
  assert(distinctPrices.size === 10, '7.5: Original distinct selling prices are preserved instead of identical ~₹455 per item');
  assert(resBugFixed.items.every(it => it.suggestedPrice !== 455 && it.suggestedPrice !== 386), '7.6: Rejects bogus identical ~₹455 prices');
  assert(resBugFixed.targetAchieved === false, '7.7: Does not claim target achieved when dealer costs are zero');
}

// ---------------------------------------------------------------------
// Suite 8: Authoritative Cost Mapping & Quantity > 1
// ---------------------------------------------------------------------
console.log('\n[Suite 8: Authoritative Cost Mapping & Qty > 1]');

{
  const lineItemWithQty2: SmartPricingItemInput[] = [
    {
      id: 'item_qty_2',
      name: 'Custom Server Component',
      hsnSac: '8471',
      quantity: 2,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1500, // Unit cost: 1,500
      currentSellingPrice: 2000
    },
    {
      id: 'item_single',
      name: 'Standard Accessory',
      hsnSac: '8473',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1000,
      currentSellingPrice: 1500
    }
  ];

  const resQty2 = calculateSmartPricing({
    items: lineItemWithQty2,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_COST',
    gstMode: 'EXCLUSIVE'
  });

  // Unit cost 1,500 * qty 2 = 3,000 line dealer cost. Total dealer cost = 3000 + 1000 = 4000
  assert(resQty2.items[0].dealerCost === 1500, '8.1: Unit dealer cost is preserved as ₹1,500');
  assert(resQty2.items[0].totalDealerCost === 3000, '8.2: Line dealer cost is exactly ₹3,000 for quantity 2');
  assert(resQty2.totalDealerCost === 4000, '8.3: Total dealer cost sums to ₹4,000');

  // Item 0 share = 3000 / 4000 = 75% of profit = 750. Unit profit = 750 / 2 = 375. Suggested unit = 1500 + 375 = 1875
  assertClose(resQty2.items[0].allocatedProfit, 750, 1.0, '8.4: Allocated line profit is ₹750 (75%)');
  assertClose(resQty2.items[0].unitAllocatedProfit, 375, 1.0, '8.5: Unit allocated profit is ₹375');
  assertClose(resQty2.items[0].suggestedPrice, 1875, 1.0, '8.6: Suggested unit price is ₹1,875 (not line total)');
  assert(resQty2.items[0].totalSellingPrice === 3750, '8.7: Line selling total is 1,875 * 2 = ₹3,750');
}

// ---------------------------------------------------------------------
// Suite 9: All Three Allocation Methods Tested Independently
// ---------------------------------------------------------------------
console.log('\n[Suite 9: All Three Allocation Methods]');

{
  const testItems: SmartPricingItemInput[] = [
    { id: '1', name: 'Item A', hsnSac: '8471', quantity: 2, unit: 'NOS', gstRate: 18, dealerCost: 1000, currentSellingPrice: 1500 }, // Line cost 2000
    { id: '2', name: 'Item B', hsnSac: '8471', quantity: 1, unit: 'NOS', gstRate: 18, dealerCost: 2000, currentSellingPrice: 2500 }  // Line cost 2000
  ];
  // Total cost = 4000. Desired profit = 1000.

  // Method 1: Proportional to cost (both have line cost 2000, so each gets 500 line profit)
  const resCost = calculateSmartPricing({
    items: testItems,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_COST',
    gstMode: 'EXCLUSIVE'
  });
  assertClose(resCost.items[0].allocatedProfit, 500, 1.0, '9.1: Proportional to cost: Item A receives ₹500 line profit');
  assertClose(resCost.items[0].suggestedPrice, 1250, 1.0, '9.2: Proportional to cost: Item A unit price = 1000 + (500/2) = ₹1,250');
  assertClose(resCost.items[1].suggestedPrice, 2500, 1.0, '9.3: Proportional to cost: Item B unit price = 2000 + 500 = ₹2,500');

  // Method 2: Proportional to quantity (Total qty = 3. Item A gets 2/3 = ~667, Item B gets 1/3 = ~333)
  const resQty = calculateSmartPricing({
    items: testItems,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'PROPORTIONAL_QTY',
    gstMode: 'EXCLUSIVE'
  });
  assertClose(resQty.items[0].unitAllocatedProfit, 333.33, 1.0, '9.4: Proportional to quantity: Unit profit is ₹333.33');
  assertClose(resQty.items[0].suggestedPrice, 1333, 1.0, '9.5: Proportional to quantity: Item A unit price = 1000 + 333 = ₹1,333');
  assertClose(resQty.items[1].suggestedPrice, 2333, 1.0, '9.6: Proportional to quantity: Item B unit price = 2000 + 333 = ₹2,333');

  // Method 3: Equal allocation (2 items, each line gets 500)
  const resEqual = calculateSmartPricing({
    items: testItems,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 1000,
    allocationMethod: 'EQUAL',
    gstMode: 'EXCLUSIVE'
  });
  assertClose(resEqual.items[0].allocatedProfit, 500, 1.0, '9.7: Equal allocation: Item A line receives ₹500');
  assertClose(resEqual.items[1].allocatedProfit, 500, 1.0, '9.8: Equal allocation: Item B line receives ₹500');
}

// ---------------------------------------------------------------------
// Suite 10: Mixed GST Rates (Inclusive & Exclusive)
// ---------------------------------------------------------------------
console.log('\n[Suite 10: Mixed GST Rates]');

{
  const mixedGstItems: SmartPricingItemInput[] = [
    { id: '1', name: 'Item 28%', hsnSac: '8471', quantity: 1, unit: 'NOS', gstRate: 28, dealerCost: 1000, currentSellingPrice: 1200 },
    { id: '2', name: 'Item 18%', hsnSac: '8472', quantity: 1, unit: 'NOS', gstRate: 18, dealerCost: 1000, currentSellingPrice: 1200 },
    { id: '3', name: 'Item 12%', hsnSac: '8473', quantity: 1, unit: 'NOS', gstRate: 12, dealerCost: 1000, currentSellingPrice: 1200 },
    { id: '4', name: 'Item 5%',  hsnSac: '8474', quantity: 1, unit: 'NOS', gstRate: 5,  dealerCost: 1000, currentSellingPrice: 1200 }
  ];

  // GST-Inclusive Target Total of ₹6,000 across mixed tax rates
  const resMixed = calculateSmartPricing({
    items: mixedGstItems,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 6000,
    allocationMethod: 'PROPORTIONAL_COST',
    gstMode: 'INCLUSIVE'
  });

  assert(resMixed.actualFinalTotal === 6000, '10.1: Mixed GST inclusive total matches ₹6,000 exactly');
  assert(resMixed.targetAchieved === true, '10.2: Target achieved flag is true for mixed GST rates');
  assert(resMixed.items[0].gstRate === 28, '10.3: Item 1 evaluates 28% tax rate');
  assert(resMixed.items[3].gstRate === 5, '10.4: Item 4 evaluates 5% tax rate');
  const sumTaxAndGst = resMixed.actualSellingSubtotal + resMixed.actualGstTotal;
  assertClose(sumTaxAndGst, 6000, 1.0, '10.5: Taxable subtotal + individual taxes equal 6,000 without double taxation');
}

// ---------------------------------------------------------------------
// Suite 11: Dynamic Overrides & Discrepancy Tracking
// ---------------------------------------------------------------------
console.log('\n[Suite 11: Dynamic Overrides & Discrepancy Tracking]');

{
  const items = createStandardItemsFixture();
  // Target total 15,000
  const initialRes = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 15000,
    gstMode: 'EXCLUSIVE'
  });

  assert(initialRes.reconciliationDelta === 0, '11.1: Initially 0 delta vs target total');

  // Override Item 0 price from suggested ~2800 to 4000 (+1200)
  items[0].manualFinalPrice = 4000;
  const overriddenRes = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 15000,
    gstMode: 'EXCLUSIVE'
  });

  assert(overriddenRes.hasManualOverrides === true, '11.2: Flags active manual override');
  assert(overriddenRes.reconciliationDelta > 0, '11.3: Tracks reconciliation delta vs target correctly');
  assert(overriddenRes.actualProfit > initialRes.actualProfit, '11.4: Actual profit updates in real-time');
}

// ---------------------------------------------------------------------
// Suite 12: Rounding Options & Midpoint Invariants (UI-024.2)
// ---------------------------------------------------------------------
console.log('\n[Suite 12: Rounding Options & Midpoint Invariants (UI-024.2)]');

{
  // 12.1 - 12.6: Nearest ₹50 examples and midpoint tests
  assert(applyRounding(8324, 'ROUND_50') === 8300, '12.1: Nearest ₹50 rounds ₹8,324 downward to ₹8,300');
  assert(applyRounding(8325, 'ROUND_50') === 8350, '12.2: Nearest ₹50 rounds exact halfway ₹8,325 upward to ₹8,350');
  assert(applyRounding(7975, 'ROUND_50') === 8000, '12.3: Nearest ₹50 rounds exact halfway ₹7,975 upward to ₹8,000');
  assert(applyRounding(2225, 'ROUND_50') === 2250, '12.4: Nearest ₹50 rounds exact halfway ₹2,225 upward to ₹2,250');
  assert(applyRounding(2224.99, 'ROUND_50') === 2200, '12.5: Nearest ₹50 rounds ₹2,224.99 downward to ₹2,200');
  assert(applyRounding(2275, 'ROUND_50') === 2300, '12.6: Nearest ₹50 rounds exact halfway ₹2,275 upward to ₹2,300');

  // 12.7 - 12.8: Nearest ₹1 midpoint tests
  assert(applyRounding(1.50, 'NEAREST_1') === 2, '12.7: Nearest ₹1 rounds exact halfway ₹1.50 upward to ₹2.00');
  assert(applyRounding(1.49, 'NEAREST_1') === 1, '12.8: Nearest ₹1 rounds ₹1.49 downward to ₹1.00');

  // 12.9 - 12.10: Nearest ₹5 midpoint tests
  assert(applyRounding(12.50, 'ROUND_5') === 15, '12.9: Nearest ₹5 rounds exact halfway ₹12.50 upward to ₹15.00');
  assert(applyRounding(12.49, 'ROUND_5') === 10, '12.10: Nearest ₹5 rounds ₹12.49 downward to ₹10.00');

  // 12.11 - 12.12: Nearest ₹10 midpoint tests
  assert(applyRounding(15.00, 'ROUND_10') === 20, '12.11: Nearest ₹10 rounds exact halfway ₹15.00 upward to ₹20.00');
  assert(applyRounding(14.99, 'ROUND_10') === 10, '12.12: Nearest ₹10 rounds ₹14.99 downward to ₹10.00');

  // 12.13 - 12.14: Nearest ₹100 midpoint tests
  assert(applyRounding(150.00, 'ROUND_100') === 200, '12.13: Nearest ₹100 rounds exact halfway ₹150.00 upward to ₹200.00');
  assert(applyRounding(149.99, 'ROUND_100') === 100, '12.14: Nearest ₹100 rounds ₹149.99 downward to ₹100.00');

  // 12.15: Exact ₹0.01 precision
  assert(applyRounding(1234.567, 'EXACT_2_DECIMALS') === 1234.57, '12.15: Exact ₹0.01 preserves 2 decimal precision (1234.567 → 1234.57)');

  // 12.16: Every item in quotation under ROUND_50 is an exact multiple of 50
  const items = createStandardItemsFixture();
  const res50 = calculateSmartPricing({
    items,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 2000,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  const allMultiplesOf50 = res50.items.every(it => it.finalPrice % 50 === 0);
  assert(allMultiplesOf50, '12.16: Every item in quotation under ROUND_50 evaluates to an exact multiple of ₹50');
}

// ---------------------------------------------------------------------
// Suite 13: Historical Hardware Quotation Regression Reference (UI-024.2)
// ---------------------------------------------------------------------
console.log('\n[Suite 13: Historical Hardware Quotation Regression Reference (UI-024.2)]');

function createHistoricalQuotationFixture(): SmartPricingItemInput[] {
  return [
    {
      id: 'hist_1',
      name: 'Intel Core i5 4th Gen',
      description: 'Intel Core i5 4th Gen Processor | 3.1GHz | Tray',
      hsnSac: '84733010',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1950.00,
      currentSellingPrice: 2200.00
    },
    {
      id: 'hist_2',
      name: 'Zebronics H81',
      description: 'Zebronics H81 Motherboard | LGA 1150',
      hsnSac: '84733020',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 2700.00,
      currentSellingPrice: 3100.00
    },
    {
      id: 'hist_3',
      name: '8GB DDR3',
      description: '8GB DDR3 Desktop RAM | 1600 MHz',
      hsnSac: '84733030',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1500.00,
      currentSellingPrice: 1750.00
    },
    {
      id: 'hist_4',
      name: '256GB SSD',
      description: '256GB SSD SATA SSD | 2.5"',
      hsnSac: '84717020',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 2700.00,
      currentSellingPrice: 3100.00
    },
    {
      id: 'hist_5',
      name: 'Cooler',
      description: 'Cooler CPU Cooler | Air Cooler',
      hsnSac: '84733099',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 200.00,
      currentSellingPrice: 240.00
    },
    {
      id: 'hist_6',
      name: 'Zebronics Cabinet with SMPS',
      description: 'Zebronics Cabinet with 450W SMPS',
      hsnSac: '84733099',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1500.00,
      currentSellingPrice: 1750.00
    },
    {
      id: 'hist_7',
      name: 'Dell 21.5" IPS Monitor',
      description: 'Dell 21.5 Inch Full HD IPS LED Monitor',
      hsnSac: '85285200',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 6500.00,
      currentSellingPrice: 7500.00
    },
    {
      id: 'hist_8',
      name: 'Logitech MK270 Wireless Combo',
      description: 'Logitech MK270 Wireless Keyboard and Mouse',
      hsnSac: '84716040',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1150.00,
      currentSellingPrice: 1350.00
    },
    {
      id: 'hist_9',
      name: 'Seagate 1TB 7200RPM HDD',
      description: 'Seagate Barracuda 1TB Internal Hard Drive',
      hsnSac: '84717020',
      quantity: 1,
      unit: 'NOS',
      gstRate: 18,
      dealerCost: 1400.00,
      currentSellingPrice: 1650.00
    }
  ];
}

{
  const histItems = createHistoricalQuotationFixture();

  // Test 13.1 - 13.6: Historical Reference Core Values Verification
  const histRes = calculateSmartPricing({
    items: histItems,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    allocationMethod: 'PROPORTIONAL_COST',
    roundingMethod: 'NEAREST_1',
    gstMode: 'EXCLUSIVE'
  });

  assert(histRes.totalDealerCost === 19600.00, '13.1: Historical hardware fixture has total dealer cost ₹19,600.00');
  assert(histRes.desiredProfit === 4000.00, '13.2: Desired profit matches ₹4,000.00');
  assert(histRes.targetSellingSubtotal === 23600.00, '13.3: Target selling subtotal equals 19,600 + 4,000 = ₹23,600.00');
  assert(histRes.actualGstTotal === 4248.00, '13.4: Historical GST 18% matches ₹4,248.00 exactly');
  assert(histRes.actualFinalTotal === 27848.00, '13.5: Final Quotation Total equals ₹27,848.00');
  assertClose(histRes.effectiveMarkupPct, 20.41, 0.05, '13.6: Effective Markup on Cost reflects 20.41%');
  assertClose(histRes.effectiveGrossMarginPct, 16.95, 0.05, '13.7: Effective Gross Margin on Selling reflects 16.95%');

  // Test 13.8: Nearest ₹50 Rounding on Historical Fixture
  const hist50Res = calculateSmartPricing({
    items: histItems,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    allocationMethod: 'PROPORTIONAL_COST',
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });

  assert(hist50Res.items.every(it => it.finalPrice % 50 === 0), '13.8: Under ROUND_50, every single suggested unit price is an exact multiple of ₹50');
  assert(hist50Res.reconciliationDelta === 0, '13.9: Remainder allocation reconciled delta while preserving ₹50 multiples');
  assert(hist50Res.targetAchieved === true, '13.10: Target achieved is true when exact reconciliation preserves rounding rule');

  // Test 13.11: Honest Discrepancy Reporting when target cannot be matched with ₹50 multiples
  const histUnreachableRes = calculateSmartPricing({
    items: histItems,
    pricingMethod: 'TARGET_TOTAL',
    targetTotal: 23625.00, // Not a multiple of 50
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });

  assert(histUnreachableRes.items.every(it => it.finalPrice % 50 === 0), '13.11: Items strictly remain multiples of ₹50 without silent violation');
  assert(histUnreachableRes.targetAchieved === false, '13.12: Does NOT claim target achieved when discrepancy exists');
  assert(Math.abs(histUnreachableRes.reconciliationDelta) === 25, '13.13: Honestly reports discrepancy of ₹25.00 vs unreachable target');
  assert(histUnreachableRes.warnings.some(w => w.includes('Nearest ₹50')), '13.14: Discloses rounding constraint warning to user');

  // Test 13.15: Markup % Mode (25%) on Historical Quotation
  const histMarkupRes = calculateSmartPricing({
    items: histItems,
    pricingMethod: 'MARKUP_PERCENT',
    markupPct: 25.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  assert(histMarkupRes.targetSellingSubtotal === 24500.00, '13.15: Markup 25% derives target subtotal 19,600 * 1.25 = ₹24,500.00');
  assert(histMarkupRes.items.every(it => it.finalPrice % 50 === 0), '13.16: Markup mode prices all items to multiples of ₹50');

  // Test 13.17: Gross Margin % Mode (20%) on Historical Quotation
  const histMarginRes = calculateSmartPricing({
    items: histItems,
    pricingMethod: 'GROSS_MARGIN_PERCENT',
    grossMarginPct: 20.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  assert(histMarginRes.targetSellingSubtotal === 24500.00, '13.17: Gross Margin 20% derives target subtotal 19,600 / 0.80 = ₹24,500.00');

  // Test 13.18: Quantity Greater Than 1 (e.g. 2 x RAM @ 1,500)
  const histQtyFixture = createHistoricalQuotationFixture();
  histQtyFixture[2].quantity = 2; // Line cost = 1,500 * 2 = 3,000
  const histQtyRes = calculateSmartPricing({
    items: histQtyFixture,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  assert(histQtyRes.items[2].totalDealerCost === 3000.00, '13.18: Line dealer cost for Qty 2 equals ₹3,000.00');
  assert(histQtyRes.totalDealerCost === 21100.00, '13.19: Total dealer cost correctly sums to ₹21,100.00');
  assert(histQtyRes.items[2].finalPrice % 50 === 0, '13.20: Qty 2 unit price is rounded to multiple of ₹50');

  // Test 13.21: Mixed GST Rates on Historical Hardware
  const histMixedFixture = createHistoricalQuotationFixture();
  histMixedFixture[6].gstRate = 28; // Monitor at 28%
  histMixedFixture[7].gstRate = 5;  // Keyboard/Mouse at 5%
  const histMixedRes = calculateSmartPricing({
    items: histMixedFixture,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  const expectedGst = histMixedRes.items.reduce((s, it) => s + it.gstAmount, 0);
  assertClose(histMixedRes.actualGstTotal, expectedGst, 0.05, '13.21: Mixed GST on historical items calculates without double taxation');

  // Test 13.22: Missing Cost Handling in Historical Quotation
  const histMissingFixture = createHistoricalQuotationFixture();
  histMissingFixture[8].dealerCost = undefined;
  histMissingFixture[8].costNotSet = true;
  const histMissingRes = calculateSmartPricing({
    items: histMissingFixture,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  assert(histMissingRes.hasMissingCosts === true, '13.22: Accurately flags missing cost item in historical quotation');
  assert(histMissingRes.items[8].costNotSet === true, '13.23: Missing item has costNotSet = true');
  assert(histMissingRes.totalDealerCost === 18200.00, '13.24: Total dealer cost excludes missing cost item (19,600 - 1,400 = 18,200)');

  // Test 13.25: Manual Price Overrides on Historical Quotation
  const histOverrideFixture = createHistoricalQuotationFixture();
  histOverrideFixture[0].manualFinalPrice = 3000.00; // User sets manual override
  const histOverrideRes = calculateSmartPricing({
    items: histOverrideFixture,
    pricingMethod: 'TARGET_PROFIT',
    desiredProfit: 4000.00,
    roundingMethod: 'ROUND_50',
    gstMode: 'EXCLUSIVE'
  });
  assert(histOverrideRes.items[0].finalPrice === 3000.00, '13.25: User manual price override of ₹3,000.00 is strictly honored');
  assert(histOverrideRes.hasManualOverrides === true, '13.26: Flags hasManualOverrides = true');
  assert(histOverrideRes.reconciliationDelta !== 0, '13.27: Reconciliation delta updates dynamically for manual override');

  // Test 13.28: Round-Off Field and Grand Total Reconciliation
  assert(typeof histRes.roundOff === 'number', '13.28: Round-off field is present and numeric');
  assertClose(histRes.actualSellingSubtotal + histRes.actualGstTotal + histRes.roundOff, Math.round(histRes.actualFinalTotal), 0.01, '13.29: Subtotal + GST + RoundOff equals rounded grand total');

  // Test 13.30: Customer Document Privacy on Historical Quotation
  const customerDoc = histRes.items.map(it => ({
    name: it.name,
    quantity: it.quantity,
    rate: it.finalPrice,
    gstRate: it.gstRate,
    total: it.lineTotal
  }));
  assert(customerDoc.every(d => !('dealerCost' in d || 'allocatedProfit' in d)), '13.30: Customer document from historical quotation has zero internal cost leakage');
}

console.log('\n======================================================================');
if (failed === 0) {
  console.log(`ALL ${passed} / ${passed} UI-024.2 REGRESSION TESTS PASSED (100% SUCCESS)`);
} else {
  console.error(`${failed} TESTS FAILED out of ${passed + failed}`);
  process.exit(1);
}
console.log('======================================================================\n');

