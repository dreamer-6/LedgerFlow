import { calculateSmartPricing } from './frontend/src/utils/smartPricingEngine.ts';

console.log('======================================================================');
console.log('SMART PRICING DEALER COST & INTERACTIVITY VERIFICATION');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// 1. Verify custom item dealer cost is not replaced with fake keywords
const customItem = {
  id: 'custom_1',
  name: 'Dell Wireless Optical Mouse MS116',
  quantity: 2,
  unit: 'NOS',
  gstRate: 18,
  dealerCost: 280, // Real dealer cost entered by user
  currentSellingPrice: 450
};

const result1 = calculateSmartPricing({
  items: [customItem],
  pricingMethod: 'TARGET_PROFIT',
  desiredProfit: 200,
  gstMode: 'EXCLUSIVE'
});

assert(result1.totalDealerCost === 560, 'Total dealer cost calculated accurately as 280 * 2 = ₹560 (not fake ₹38,000 Dell default)');
assert(result1.items[0].dealerCost === 280, 'Item dealer cost preserved at user-entered ₹280');
assert(result1.targetSellingSubtotal === 760, 'Target selling subtotal equals cost + profit = ₹760');
assert(result1.items[0].finalPrice === 380, 'Each mouse calculated to selling price of ₹380 (560 + 200 = 760 / 2)');

// 2. Verify changing dealer cost dynamically
customItem.dealerCost = 350;
const result2 = calculateSmartPricing({
  items: [customItem],
  pricingMethod: 'TARGET_PROFIT',
  desiredProfit: 200,
  gstMode: 'EXCLUSIVE'
});

assert(result2.totalDealerCost === 700, 'Updated dealer cost reflects immediately: 350 * 2 = ₹700');
assert(result2.targetSellingSubtotal === 900, 'Target selling subtotal recalculates to 700 + 200 = ₹900');
assert(result2.items[0].finalPrice === 450, 'Selling price per unit updates to ₹450');

// 3. Verify markup percentage mode with dealer cost
const result3 = calculateSmartPricing({
  items: [customItem],
  pricingMethod: 'MARKUP_PERCENT',
  markupPct: 20,
  gstMode: 'EXCLUSIVE'
});

assert(result3.items[0].dealerCost === 350, 'Dealer cost preserved under Markup % mode');
assert(result3.actualProfit === 140, '20% markup on ₹700 cost yields ₹140 profit');
assert(result3.targetSellingSubtotal === 840, 'Target selling subtotal equals 700 + 140 = ₹840');
assert(result3.items[0].finalPrice === 420, 'Final price per unit equals ₹420');

// 4. Verify Gross Margin mode
const result4 = calculateSmartPricing({
  items: [customItem],
  pricingMethod: 'GROSS_MARGIN_PERCENT',
  grossMarginPct: 25,
  gstMode: 'EXCLUSIVE'
});

assert(Math.round(result4.actualSellingSubtotal) === 933 || Math.round(result4.actualSellingSubtotal) === 934, '25% gross margin derives selling subtotal of ₹933-934');
assert(result4.effectiveGrossMarginPct >= 24.9 && result4.effectiveGrossMarginPct <= 25.1, 'Effective gross margin reflects 25%');

// 5. Verify Manual override on an item
const manualItem = {
  ...customItem,
  manualFinalPrice: 500
};

const result5 = calculateSmartPricing({
  items: [manualItem],
  pricingMethod: 'TARGET_PROFIT',
  desiredProfit: 200,
  gstMode: 'EXCLUSIVE'
});

assert(result5.items[0].isManuallyOverridden === true, 'Item flagged isManuallyOverridden');
assert(result5.items[0].finalPrice === 500, 'Manual price override honored as ₹500');
assert(result5.items[0].effectiveProfitPct > 40, 'Profit percentage reflects real profit on ₹350 dealer cost: ((500-350)/350)*100 = 42.86%');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
