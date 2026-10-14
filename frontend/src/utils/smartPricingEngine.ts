/**
 * smartPricingEngine.ts — Authoritative Financial Engine for Smart Quotation Pricing
 * & Online Price Verification in LedgerFlow.
 */

export type PricingMethod =
  | 'TARGET_PROFIT'
  | 'TARGET_TOTAL'
  | 'MARKUP_PERCENT'
  | 'GROSS_MARGIN_PERCENT'
  | 'MANUAL';

export type AllocationMethod =
  | 'PROPORTIONAL_COST'
  | 'PROPORTIONAL_QTY'
  | 'EQUAL';

export type RoundingMethod =
  | 'EXACT_2_DECIMALS'
  | 'NEAREST_1'
  | 'ROUND_5'
  | 'ROUND_10'
  | 'ROUND_50'
  | 'ROUND_100';

export type GstMode = 'EXCLUSIVE' | 'INCLUSIVE';

export type MatchQuality =
  | 'EXACT_MATCH'
  | 'SIMILAR_PRODUCT'
  | 'MANUAL_REFERENCE'
  | 'LIVE_UNAVAILABLE'
  | 'STALE_REFERENCE';

export interface OnlineReferenceInfo {
  productName: string;
  brand?: string;
  model?: string;
  specs?: string;
  sku?: string;
  retailer: string;
  referencePrice: number; // in Rupees
  gstInclusive: boolean;
  deliveryCharges?: number;
  availability?: string;
  warranty?: string;
  sourceUrl?: string;
  lastChecked: string;
  matchQuality: MatchQuality;
  notes?: string;
}

export interface SmartPricingItemInput {
  id: string;
  itemId?: string;
  name: string;
  description?: string;
  subtext?: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  gstRate: number; // e.g. 18 for 18%
  dealerCost?: number; // Unit dealer cost in Rupees
  costNotSet?: boolean; // True if dealer cost has not been established
  currentSellingPrice: number; // Current rate in Quotation
  manualFinalPrice?: number; // User override if any
  isService?: boolean;
  onlineReference?: OnlineReferenceInfo | null;
}

export interface CalculatedSmartItem {
  id: string;
  itemId?: string;
  name: string;
  description?: string;
  subtext?: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  gstRate: number;
  dealerCost: number; // Unit dealer cost
  costNotSet: boolean;
  totalDealerCost: number; // Line dealer cost = dealerCost * quantity
  allocatedProfit: number;
  unitAllocatedProfit: number;
  suggestedPrice: number;
  finalPrice: number;
  totalSellingPrice: number;
  effectiveProfitPct: number;
  effectiveGrossMarginPct: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
  isManuallyOverridden: boolean;
  onlineReference: OnlineReferenceInfo | null;
  onlineDifference?: number;
  onlineDiffPct?: number;
  onlineStatus?: 'BELOW' | 'NEAR' | 'ABOVE' | 'UNAVAILABLE';
}

export interface SmartPricingResult {
  method: PricingMethod;
  allocationMethod: AllocationMethod;
  roundingMethod: RoundingMethod;
  gstMode: GstMode;
  items: CalculatedSmartItem[];
  totalDealerCost: number;
  desiredProfit: number;
  actualProfit: number;
  targetSellingSubtotal: number;
  actualSellingSubtotal: number;
  targetFinalTotal: number;
  actualGstTotal: number;
  roundOff: number;
  actualFinalTotal: number;
  effectiveMarkupPct: number;
  effectiveGrossMarginPct: number;
  hasManualOverrides: boolean;
  targetAchieved: boolean;
  reconciliationDelta: number;
  hasMissingCosts: boolean;
  missingCostCount: number;
  warnings: string[];
  onlineComparison: {
    yourSellingTotal: number;
    onlineReferenceTotal: number;
    difference: number;
    diffPct: number;
    status: 'COMPETITIVE' | 'MATCHING' | 'ABOVE' | 'UNAVAILABLE';
  };
}

export interface SmartPricingParams {
  items: SmartPricingItemInput[];
  pricingMethod: PricingMethod;
  desiredProfit?: number;
  targetTotal?: number;
  markupPct?: number;
  grossMarginPct?: number;
  allocationMethod?: AllocationMethod;
  roundingMethod?: RoundingMethod;
  gstMode?: GstMode;
  isInterstate?: boolean;
}

export function getRoundingStep(method: RoundingMethod): number {
  switch (method) {
    case 'EXACT_2_DECIMALS':
      return 0.01;
    case 'NEAREST_1':
      return 1;
    case 'ROUND_5':
      return 5;
    case 'ROUND_10':
      return 10;
    case 'ROUND_50':
      return 50;
    case 'ROUND_100':
      return 100;
    default:
      return 1;
  }
}

export function applyRounding(val: number, method: RoundingMethod): number {
  if (isNaN(val) || val <= 0) return 0;
  const valInPaise = Math.round(val * 100);

  let stepPaise = 100;
  switch (method) {
    case 'EXACT_2_DECIMALS':
      return valInPaise / 100;
    case 'NEAREST_1':
      stepPaise = 100;
      break;
    case 'ROUND_5':
      stepPaise = 500;
      break;
    case 'ROUND_10':
      stepPaise = 1000;
      break;
    case 'ROUND_50':
      stepPaise = 5000;
      break;
    case 'ROUND_100':
      stepPaise = 10000;
      break;
    default:
      return Math.round(val * 100) / 100;
  }

  // Exact halfway amounts round upward for positive values:
  const roundedPaise = Math.floor((valInPaise + Math.floor(stepPaise / 2)) / stepPaise) * stepPaise;
  return roundedPaise / 100;
}

export function calculateSmartPricing(params: SmartPricingParams): SmartPricingResult {
  const {
    items,
    pricingMethod,
    desiredProfit = 4000,
    targetTotal = 27848,
    markupPct = 20,
    grossMarginPct = 16.95,
    allocationMethod = 'PROPORTIONAL_COST',
    roundingMethod = 'NEAREST_1',
    gstMode = 'EXCLUSIVE',
    isInterstate = false
  } = params;

  const warnings: string[] = [];

  // 1. Establish Item Costs and Detect Missing Costs
  let missingCostCount = 0;
  const processedItems = items.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const rawCost = item.dealerCost !== undefined && item.dealerCost !== null ? Number(item.dealerCost) : NaN;
    const isCostMissing = isNaN(rawCost) || rawCost <= 0 || item.costNotSet === true;
    if (isCostMissing) {
      missingCostCount++;
    }
    const unitCost = isCostMissing ? 0 : Math.max(0, rawCost);
    const lineCost = unitCost * qty;
    return {
      ...item,
      quantity: qty,
      unitCost,
      lineCost,
      isCostMissing
    };
  });

  const hasMissingCosts = missingCostCount > 0;
  const totalDealerCost = Math.round(processedItems.reduce((acc, it) => acc + it.lineCost, 0) * 100) / 100;
  const totalQuantity = processedItems.reduce((acc, it) => acc + it.quantity, 0);
  const itemCount = processedItems.length;

  if (totalDealerCost === 0) {
    warnings.push('Total dealer cost is ₹0.00. Automatic cost-based pricing requires valid dealer costs.');
  } else if (hasMissingCosts) {
    warnings.push(`${missingCostCount} item(s) have "Cost not set". Enter unit dealer costs for full pricing accuracy.`);
  }

  // 2. Resolve Targets & Implied Profit
  let resolvedDesiredProfit = 0;
  let targetSellingSubtotal = 0;
  let targetFinalTotal = 0;

  // Track line pre-calculated targets for Target Total in Inclusive mode with mixed tax rates
  const lineInclusiveTargets: number[] = new Array(itemCount).fill(0);
  const linePreTaxTargets: number[] = new Array(itemCount).fill(0);

  switch (pricingMethod) {
    case 'TARGET_PROFIT': {
      resolvedDesiredProfit = Math.max(0, Number(desiredProfit) || 0);
      targetSellingSubtotal = totalDealerCost + resolvedDesiredProfit;
      break;
    }

    case 'TARGET_TOTAL': {
      const specifiedTarget = Math.max(0, Number(targetTotal) || 0);
      if (gstMode === 'EXCLUSIVE') {
        targetSellingSubtotal = specifiedTarget;
        resolvedDesiredProfit = Math.max(0, Math.round((targetSellingSubtotal - totalDealerCost) * 100) / 100);
      } else {
        targetFinalTotal = specifiedTarget;
        // Solving for exact pre-tax amounts across items (supporting mixed tax rates)
        if (totalDealerCost > 0 && allocationMethod === 'PROPORTIONAL_COST') {
          for (let i = 0; i < itemCount; i++) {
            const it = processedItems[i];
            const weight = it.lineCost / totalDealerCost;
            const lineInclTarget = specifiedTarget * weight;
            const linePreTax = lineInclTarget / (1 + (it.gstRate || 0) / 100);
            lineInclusiveTargets[i] = lineInclTarget;
            linePreTaxTargets[i] = linePreTax;
          }
        } else if (allocationMethod === 'PROPORTIONAL_QTY') {
          const totalCostIncl = processedItems.reduce(
            (sum, it) => sum + (it.lineCost * (1 + (it.gstRate || 0) / 100)),
            0
          );
          const inclusiveProfitToDistribute = specifiedTarget - totalCostIncl;
          const sumQtyFactors = processedItems.reduce(
            (sum, it) => sum + (it.quantity * (1 + (it.gstRate || 0) / 100)),
            0
          );
          const unitProfitPreTax = sumQtyFactors > 0 ? inclusiveProfitToDistribute / sumQtyFactors : 0;

          for (let i = 0; i < itemCount; i++) {
            const it = processedItems[i];
            const linePreTax = it.lineCost + (it.quantity * unitProfitPreTax);
            const lineIncl = linePreTax * (1 + (it.gstRate || 0) / 100);
            linePreTaxTargets[i] = linePreTax;
            lineInclusiveTargets[i] = lineIncl;
          }
        } else {
          // EQUAL allocation
          const totalCostIncl = processedItems.reduce(
            (sum, it) => sum + (it.lineCost * (1 + (it.gstRate || 0) / 100)),
            0
          );
          const inclusiveProfitToDistribute = specifiedTarget - totalCostIncl;
          const sumItemFactors = processedItems.reduce(
            (sum, it) => sum + (1 + (it.gstRate || 0) / 100),
            0
          );
          const lineProfitPreTax = sumItemFactors > 0 ? inclusiveProfitToDistribute / sumItemFactors : 0;

          for (let i = 0; i < itemCount; i++) {
            const it = processedItems[i];
            const linePreTax = it.lineCost + lineProfitPreTax;
            const lineIncl = linePreTax * (1 + (it.gstRate || 0) / 100);
            linePreTaxTargets[i] = linePreTax;
            lineInclusiveTargets[i] = lineIncl;
          }
        }

        targetSellingSubtotal = Math.round(linePreTaxTargets.reduce((s, v) => s + v, 0) * 100) / 100;
        resolvedDesiredProfit = Math.max(0, Math.round((targetSellingSubtotal - totalDealerCost) * 100) / 100);
      }
      break;
    }

    case 'MARKUP_PERCENT': {
      const validMarkup = Math.max(0, Number(markupPct) || 0);
      if (totalDealerCost === 0) {
        warnings.push('Markup % requires positive dealer cost.');
      }
      resolvedDesiredProfit = Math.round(totalDealerCost * (validMarkup / 100) * 100) / 100;
      targetSellingSubtotal = totalDealerCost + resolvedDesiredProfit;
      break;
    }

    case 'GROSS_MARGIN_PERCENT': {
      let validMargin = Number(grossMarginPct) || 0;
      if (validMargin >= 100) {
        warnings.push('Gross margin must be strictly less than 100%. Clamped to 99.99%.');
        validMargin = 99.99;
      } else if (validMargin < 0) {
        validMargin = 0;
      }

      if (totalDealerCost > 0 && validMargin < 100) {
        targetSellingSubtotal = Math.round((totalDealerCost / (1 - validMargin / 100)) * 100) / 100;
        resolvedDesiredProfit = Math.max(0, Math.round((targetSellingSubtotal - totalDealerCost) * 100) / 100);
      } else {
        if (totalDealerCost === 0) {
          warnings.push('Gross margin % requires positive dealer cost.');
        }
        targetSellingSubtotal = totalDealerCost;
        resolvedDesiredProfit = 0;
      }
      break;
    }

    case 'MANUAL':
    default: {
      targetSellingSubtotal = processedItems.reduce((acc, it) => {
        const rate = it.manualFinalPrice !== undefined ? it.manualFinalPrice : it.currentSellingPrice;
        return acc + (rate * it.quantity);
      }, 0);
      resolvedDesiredProfit = Math.max(0, Math.round((targetSellingSubtotal - totalDealerCost) * 100) / 100);
      break;
    }
  }

  // 3. Allocate Profit & Calculate Item Prices
  const calculatedItems: CalculatedSmartItem[] = [];

  for (let idx = 0; idx < itemCount; idx++) {
    const item = processedItems[idx];
    const qty = item.quantity;
    const unitCost = item.unitCost;
    const lineCost = item.lineCost;
    const gstRate = Number(item.gstRate) || 0;

    let lineAllocatedProfit = 0;

    if (totalDealerCost === 0 && item.isCostMissing) {
      // Missing cost and zero total dealer cost: Do not invent fake allocation!
      lineAllocatedProfit = 0;
    } else if (pricingMethod === 'MARKUP_PERCENT') {
      const validMarkup = Math.max(0, Number(markupPct) || 0);
      lineAllocatedProfit = (lineCost * (validMarkup / 100));
    } else if (pricingMethod === 'GROSS_MARGIN_PERCENT') {
      let validMargin = Number(grossMarginPct) || 0;
      if (validMargin >= 100) validMargin = 99.99;
      if (validMargin < 0) validMargin = 0;
      const lineSelling = validMargin < 100 ? (lineCost / (1 - validMargin / 100)) : lineCost;
      lineAllocatedProfit = lineSelling - lineCost;
    } else if (pricingMethod === 'MANUAL') {
      const activeRate = item.manualFinalPrice !== undefined ? item.manualFinalPrice : item.currentSellingPrice;
      lineAllocatedProfit = (activeRate - unitCost) * qty;
    } else if (pricingMethod === 'TARGET_TOTAL' && gstMode === 'INCLUSIVE') {
      lineAllocatedProfit = linePreTaxTargets[idx] - lineCost;
    } else {
      // TARGET_PROFIT or TARGET_TOTAL (Exclusive)
      switch (allocationMethod) {
        case 'PROPORTIONAL_QTY': {
          const share = totalQuantity > 0 ? qty / totalQuantity : 1 / (itemCount || 1);
          lineAllocatedProfit = resolvedDesiredProfit * share;
          break;
        }
        case 'EQUAL': {
          lineAllocatedProfit = resolvedDesiredProfit / (itemCount || 1);
          break;
        }
        case 'PROPORTIONAL_COST':
        default: {
          if (totalDealerCost > 0) {
            const share = lineCost / totalDealerCost;
            lineAllocatedProfit = resolvedDesiredProfit * share;
          } else {
            lineAllocatedProfit = 0;
          }
          break;
        }
      }
    }

    const unitAllocatedProfit = lineAllocatedProfit / qty;
    let rawSuggestedPrice = 0;

    if (totalDealerCost === 0 && item.isCostMissing) {
      // Preserve current quotation price when cost is not set
      rawSuggestedPrice = item.currentSellingPrice;
    } else {
      const unitPreTaxSelling = unitCost + unitAllocatedProfit;
      if (gstMode === 'INCLUSIVE') {
        rawSuggestedPrice = unitPreTaxSelling * (1 + gstRate / 100);
      } else {
        rawSuggestedPrice = unitPreTaxSelling;
      }
    }

    const roundedSuggestedPrice = applyRounding(rawSuggestedPrice, roundingMethod);
    const hasManualOverride = item.manualFinalPrice !== undefined;
    const finalPrice = hasManualOverride ? (item.manualFinalPrice as number) : roundedSuggestedPrice;
    const totalSellingPrice = finalPrice * qty;

    let taxableAmount = 0;
    let gstAmount = 0;
    let lineTotal = 0;

    if (gstMode === 'INCLUSIVE') {
      lineTotal = Math.round(totalSellingPrice * 100) / 100;
      taxableAmount = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100;
      gstAmount = Math.round((lineTotal - taxableAmount) * 100) / 100;
    } else {
      taxableAmount = Math.round(totalSellingPrice * 100) / 100;
      gstAmount = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
      lineTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
    }

    const effectiveProfitPerUnit = unitCost > 0 ? (taxableAmount / qty) - unitCost : 0;
    const effectiveProfitPct = unitCost > 0 ? (effectiveProfitPerUnit / unitCost) * 100 : 0;
    const effectiveGrossMarginPct = taxableAmount > 0 && unitCost > 0 ? (effectiveProfitPerUnit / (taxableAmount / qty)) * 100 : 0;

    let onlineDiff: number | undefined;
    let onlineDiffPct: number | undefined;
    let onlineStatus: 'BELOW' | 'NEAR' | 'ABOVE' | 'UNAVAILABLE' = 'UNAVAILABLE';

    if (item.onlineReference && item.onlineReference.referencePrice > 0) {
      const refPrice = item.onlineReference.referencePrice;
      onlineDiff = finalPrice - refPrice;
      onlineDiffPct = refPrice > 0 ? (onlineDiff / refPrice) * 100 : 0;

      if (onlineDiff < -10) {
        onlineStatus = 'BELOW';
      } else if (Math.abs(onlineDiff) <= 10 || Math.abs(onlineDiffPct) <= 2) {
        onlineStatus = 'NEAR';
      } else {
        onlineStatus = 'ABOVE';
      }
    }

    calculatedItems.push({
      id: item.id,
      itemId: item.itemId,
      name: item.name,
      description: item.description,
      subtext: item.subtext,
      hsnSac: item.hsnSac,
      quantity: qty,
      unit: item.unit || 'NOS',
      gstRate,
      dealerCost: unitCost,
      costNotSet: item.isCostMissing,
      totalDealerCost: lineCost,
      allocatedProfit: Math.round(lineAllocatedProfit * 100) / 100,
      unitAllocatedProfit: Math.round(unitAllocatedProfit * 100) / 100,
      suggestedPrice: roundedSuggestedPrice,
      finalPrice,
      totalSellingPrice,
      effectiveProfitPct: Math.round(effectiveProfitPct * 100) / 100,
      effectiveGrossMarginPct: Math.round(effectiveGrossMarginPct * 100) / 100,
      taxableAmount,
      gstAmount,
      lineTotal,
      isManuallyOverridden: hasManualOverride,
      onlineReference: item.onlineReference || null,
      onlineDifference: onlineDiff !== undefined ? Math.round(onlineDiff * 100) / 100 : undefined,
      onlineDiffPct: onlineDiffPct !== undefined ? Math.round(onlineDiffPct * 100) / 100 : undefined,
      onlineStatus
    });
  }

  // 4. Deterministic Remainder Reconciliation (with respect for selected rounding rule)
  const hasAnyManualOverrides = calculatedItems.some((i) => i.isManuallyOverridden);
  const roundingStep = getRoundingStep(roundingMethod);

  if (
    !hasAnyManualOverrides &&
    totalDealerCost > 0 &&
    (pricingMethod === 'TARGET_PROFIT' || pricingMethod === 'TARGET_TOTAL')
  ) {
    const rawSum = calculatedItems.reduce((acc, it) => acc + (it.finalPrice * it.quantity), 0);
    const targetToMatch = gstMode === 'INCLUSIVE'
      ? (targetFinalTotal || Math.round(calculatedItems.reduce((sum, it) => sum + (it.suggestedPrice * it.quantity), 0) * 100) / 100)
      : targetSellingSubtotal;

    const delta = Math.round((targetToMatch - rawSum) * 100) / 100;

    // Reconciliation is ONLY permissible if delta can be applied without violating the rounding rule!
    // For EXACT_2_DECIMALS: small paise adjustments (|delta| <= 10) are fine.
    // For NEAREST_1, ROUND_5, ROUND_10, ROUND_50, ROUND_100: delta must be an exact multiple of roundingStep!
    const isStepMultiple = Math.abs(delta) > 0 && (
      roundingMethod === 'EXACT_2_DECIMALS'
        ? Math.abs(delta) <= 10
        : (Math.abs(delta / roundingStep - Math.round(delta / roundingStep)) < 0.001 &&
           Math.abs(delta) <= roundingStep * 2)
    );

    if (isStepMultiple && calculatedItems.length > 0) {
      let bestIdx = -1;
      let maxCost = -1;
      calculatedItems.forEach((it, idx) => {
        if (it.dealerCost > maxCost && it.quantity === 1) {
          maxCost = it.dealerCost;
          bestIdx = idx;
        }
      });

      if (bestIdx >= 0) {
        const it = calculatedItems[bestIdx];
        const newPrice = Math.round((it.finalPrice + delta) * 100) / 100;
        it.finalPrice = newPrice;
        it.totalSellingPrice = newPrice * it.quantity;

        if (gstMode === 'INCLUSIVE') {
          it.lineTotal = Math.round(it.totalSellingPrice * 100) / 100;
          it.taxableAmount = Math.round((it.lineTotal / (1 + it.gstRate / 100)) * 100) / 100;
          it.gstAmount = Math.round((it.lineTotal - it.taxableAmount) * 100) / 100;
        } else {
          it.taxableAmount = Math.round(it.totalSellingPrice * 100) / 100;
          it.gstAmount = Math.round((it.taxableAmount * (it.gstRate / 100)) * 100) / 100;
          it.lineTotal = Math.round((it.taxableAmount + it.gstAmount) * 100) / 100;
        }

        const profitPerUnit = (it.taxableAmount / it.quantity) - it.dealerCost;
        it.effectiveProfitPct = it.dealerCost > 0 ? Math.round((profitPerUnit / it.dealerCost) * 10000) / 100 : 0;
        it.effectiveGrossMarginPct = it.taxableAmount > 0 ? Math.round((profitPerUnit / (it.taxableAmount / it.quantity)) * 10000) / 100 : 0;
      }
    }
  }

  // 5. Aggregate Totals
  const actualSellingSubtotal = Math.round(
    calculatedItems.reduce((acc, it) => acc + (gstMode === 'INCLUSIVE' ? it.taxableAmount : it.totalSellingPrice), 0) * 100
  ) / 100;

  const actualProfit = Math.round((actualSellingSubtotal - totalDealerCost) * 100) / 100;
  const actualGstTotal = Math.round(calculatedItems.reduce((acc, it) => acc + it.gstAmount, 0) * 100) / 100;

  const rawFinalTotal = Math.round((actualSellingSubtotal + actualGstTotal) * 100) / 100;
  const roundedGrandTotal = Math.round(rawFinalTotal);
  const roundOff = Math.round((roundedGrandTotal - rawFinalTotal) * 100) / 100;
  const actualFinalTotal = gstMode === 'INCLUSIVE'
    ? Math.round(calculatedItems.reduce((acc, it) => acc + it.lineTotal, 0) * 100) / 100
    : rawFinalTotal;

  if (targetFinalTotal === 0) {
    targetFinalTotal = gstMode === 'INCLUSIVE'
      ? actualFinalTotal
      : Math.round((targetSellingSubtotal + actualGstTotal) * 100) / 100;
  }

  const effectiveMarkupPct = totalDealerCost > 0
    ? Math.round((actualProfit / totalDealerCost) * 10000) / 100
    : 0;

  const effectiveGrossMarginPct = actualSellingSubtotal > 0 && totalDealerCost > 0
    ? Math.round((actualProfit / actualSellingSubtotal) * 10000) / 100
    : 0;

  const compareTarget = gstMode === 'INCLUSIVE' ? targetFinalTotal : targetSellingSubtotal;
  const compareActual = gstMode === 'INCLUSIVE' ? actualFinalTotal : actualSellingSubtotal;
  const reconciliationDelta = Math.round((compareActual - compareTarget) * 100) / 100;

  // Strict target achieved: within 0.01
  // If rounding has changed the result and reconciliationDelta !== 0, do NOT report target as achieved!
  const targetAchieved = totalDealerCost > 0 && Math.abs(reconciliationDelta) <= 0.01;

  if (!targetAchieved && totalDealerCost > 0 && Math.abs(reconciliationDelta) > 0.01) {
    if (hasAnyManualOverrides) {
      warnings.push(`Manual price overrides active (Discrepancy: ${reconciliationDelta > 0 ? '+' : ''}₹${reconciliationDelta.toFixed(2)} vs target).`);
    } else {
      const roundingLabel =
        roundingMethod === 'ROUND_50' ? 'Nearest ₹50' :
        roundingMethod === 'ROUND_100' ? 'Nearest ₹100' :
        roundingMethod === 'ROUND_10' ? 'Nearest ₹10' :
        roundingMethod === 'ROUND_5' ? 'Nearest ₹5' :
        roundingMethod === 'EXACT_2_DECIMALS' ? 'Exact ₹0.01' : 'Nearest ₹1';
      warnings.push(`Target differs by ${reconciliationDelta > 0 ? '+' : ''}₹${reconciliationDelta.toFixed(2)} due to ${roundingLabel} rounding.`);
    }
  }

  // 6. Online Comparison
  let onlineRefTotal = 0;
  let onlineItemsCount = 0;

  calculatedItems.forEach((it) => {
    if (it.onlineReference && it.onlineReference.referencePrice > 0) {
      onlineRefTotal += it.onlineReference.referencePrice * it.quantity;
      onlineItemsCount++;
    }
  });

  const onlineDiffTotal = onlineItemsCount > 0 ? actualFinalTotal - onlineRefTotal : 0;
  const onlineDiffPctTotal = onlineRefTotal > 0 ? (onlineDiffTotal / onlineRefTotal) * 100 : 0;

  let overallOnlineStatus: 'COMPETITIVE' | 'MATCHING' | 'ABOVE' | 'UNAVAILABLE' = 'UNAVAILABLE';
  if (onlineItemsCount > 0) {
    if (onlineDiffTotal < -50) {
      overallOnlineStatus = 'COMPETITIVE';
    } else if (Math.abs(onlineDiffTotal) <= 50 || Math.abs(onlineDiffPctTotal) <= 2) {
      overallOnlineStatus = 'MATCHING';
    } else {
      overallOnlineStatus = 'ABOVE';
    }
  }

  return {
    method: pricingMethod,
    allocationMethod,
    roundingMethod,
    gstMode,
    items: calculatedItems,
    totalDealerCost,
    desiredProfit: resolvedDesiredProfit,
    actualProfit,
    targetSellingSubtotal,
    actualSellingSubtotal,
    targetFinalTotal,
    actualGstTotal,
    roundOff,
    actualFinalTotal,
    effectiveMarkupPct,
    effectiveGrossMarginPct,
    hasManualOverrides: hasAnyManualOverrides,
    targetAchieved,
    reconciliationDelta,
    hasMissingCosts,
    missingCostCount,
    warnings,
    onlineComparison: {
      yourSellingTotal: Math.round((gstMode === 'INCLUSIVE' ? actualFinalTotal : actualSellingSubtotal) * 100) / 100,
      onlineReferenceTotal: Math.round(onlineRefTotal * 100) / 100,
      difference: Math.round(onlineDiffTotal * 100) / 100,
      diffPct: Math.round(onlineDiffPctTotal * 100) / 100,
      status: overallOnlineStatus
    }
  };
}

export const DEFAULT_ONLINE_REFERENCES: Record<string, OnlineReferenceInfo> = {
  'intel core i5 4th gen': {
    productName: 'Intel Core i5-4590 4th Gen Processor (3.3GHz, Tray)',
    brand: 'Intel',
    model: 'Core i5-4590',
    specs: '4 Cores, 4 Threads, 3.3GHz Base / 3.7GHz Turbo, LGA 1150',
    retailer: 'MDComputers / PrimeABGB',
    referencePrice: 2450.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '1 Year Vendor Replacement Warranty',
    sourceUrl: 'https://www.google.com/search?tbm=shop&q=Intel+Core+i5+4th+Gen+Processor',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  },
  'zebronics h81': {
    productName: 'Zebronics ZEB-H81 Motherboard (LGA 1150, DDR3)',
    brand: 'Zebronics',
    model: 'ZEB-H81',
    specs: 'Intel H81 Express Chipset, Dual Channel DDR3, NVMe M.2 Slot',
    retailer: 'Amazon India',
    referencePrice: 3350.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '2 Years Manufacturer Warranty',
    sourceUrl: 'https://www.amazon.in/s?k=Zebronics+H81+Motherboard',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  },
  '8gb ddr3': {
    productName: 'Simmtronics / Consistent 8GB DDR3 1600MHz Desktop RAM',
    brand: 'Consistent / Simmtronics',
    model: 'DDR3 1600MHz 8GB',
    specs: 'PC3-12800, 240-Pin DIMM, 1.5V, CL11',
    retailer: 'Amazon India',
    referencePrice: 1950.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '3 Years Manufacturer Warranty',
    sourceUrl: 'https://www.amazon.in/s?k=8GB+DDR3+Desktop+RAM+1600MHz',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  },
  '256gb ssd': {
    productName: 'Crucial BX500 240GB / 256GB 2.5-Inch SATA SSD',
    brand: 'Crucial / Western Digital',
    model: 'BX500 240GB / 256GB',
    specs: 'SATA 6Gb/s, Read up to 540MB/s, Write up to 500MB/s',
    retailer: 'Amazon India / Nehru Place',
    referencePrice: 3200.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '3 Years Limited Manufacturer Warranty',
    sourceUrl: 'https://www.amazon.in/s?k=256GB+2.5+SATA+SSD',
    lastChecked: '2026-10-14',
    matchQuality: 'SIMILAR_PRODUCT'
  },
  'cooler': {
    productName: 'Deepcool / Ant Esports ICE-C200 CPU Air Cooler',
    brand: 'Ant Esports',
    model: 'ICE-C200',
    specs: 'LGA 115x/1200/1700 Compatible, 90mm PWM Fan',
    retailer: 'Amazon India',
    referencePrice: 300.00,
    gstInclusive: true,
    deliveryCharges: 50,
    availability: 'In Stock',
    warranty: '1 Year Warranty',
    sourceUrl: 'https://www.amazon.in/s?k=CPU+Air+Cooler+LGA+1150',
    lastChecked: '2026-10-14',
    matchQuality: 'SIMILAR_PRODUCT'
  },
  'dell inspiron 3520': {
    productName: 'Dell Inspiron 3520 Laptop (12th Gen i3-1215U / 8GB / 512GB SSD / 15.6" FHD)',
    brand: 'Dell',
    model: 'Inspiron 3520',
    specs: 'Core i3-1215U, 8GB DDR4, 512GB NVMe, FHD 120Hz Display, Win 11 + MSO',
    retailer: 'Dell Store / Amazon India',
    referencePrice: 46990.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '1 Year Onsite Hardware Service (Dell)',
    sourceUrl: 'https://www.amazon.in/s?k=Dell+Inspiron+3520+i3+12th+Gen',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  },
  'hp laserjet 108w': {
    productName: 'HP Laser 108w Single Function Monochrome Wireless Laser Printer',
    brand: 'HP',
    model: 'Laser 108w (4ZB80A)',
    specs: 'Up to 20 ppm, Wi-Fi Direct, USB 2.0, 150-Sheet Input Tray',
    retailer: 'HP Store / Amazon India',
    referencePrice: 13499.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '1 Year Manufacturer Warranty (HP)',
    sourceUrl: 'https://www.amazon.in/s?k=HP+LaserJet+108w+Printer',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  },
  'logitech mk270': {
    productName: 'Logitech MK270 Wireless Keyboard and Mouse Combo',
    brand: 'Logitech',
    model: 'MK270',
    specs: '2.4GHz Wireless with USB Nano Receiver, 8 Multimedia Keys, Spill-Resistant',
    retailer: 'Amazon India',
    referencePrice: 1395.00,
    gstInclusive: true,
    deliveryCharges: 0,
    availability: 'In Stock',
    warranty: '3 Years Limited Hardware Warranty (Logitech)',
    sourceUrl: 'https://www.amazon.in/s?k=Logitech+MK270+Wireless+Combo',
    lastChecked: '2026-10-14',
    matchQuality: 'EXACT_MATCH'
  }
};

export function matchDefaultOnlineReference(description: string): OnlineReferenceInfo | null {
  if (!description) return null;
  const descLower = description.toLowerCase();

  for (const [key, ref] of Object.entries(DEFAULT_ONLINE_REFERENCES)) {
    if (descLower.includes(key)) {
      return { ...ref };
    }
  }

  return null;
}
