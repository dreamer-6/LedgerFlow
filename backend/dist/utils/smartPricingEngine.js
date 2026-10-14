"use strict";
/**
 * smartPricingEngine.ts — Authoritative Financial Engine for Smart Quotation Pricing
 * & Online Price Verification in LedgerFlow.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ONLINE_REFERENCES = void 0;
exports.applyRounding = applyRounding;
exports.calculateSmartPricing = calculateSmartPricing;
exports.matchDefaultOnlineReference = matchDefaultOnlineReference;
function applyRounding(val, method) {
    switch (method) {
        case 'NEAREST_1':
            return Math.round(val);
        case 'ROUND_5':
            return Math.round(val / 5) * 5;
        case 'ROUND_10':
            return Math.round(val / 10) * 10;
        case 'EXACT_2_DECIMALS':
        default:
            return Math.round(val * 100) / 100;
    }
}
function calculateSmartPricing(params) {
    const { items, pricingMethod, desiredProfit = 4000, targetTotal = 27848, markupPct = 20, grossMarginPct = 16.95, allocationMethod = 'PROPORTIONAL_COST', roundingMethod = 'NEAREST_1', gstMode = 'EXCLUSIVE', isInterstate = false } = params;
    // 1. Total Dealer Cost and Total Quantity
    const totalDealerCost = items.reduce((acc, item) => {
        const qty = Math.max(0, Number(item.quantity) || 0);
        const cost = Math.max(0, Number(item.dealerCost) || 0);
        return acc + (cost * qty);
    }, 0);
    const totalQuantity = items.reduce((acc, item) => {
        return acc + Math.max(0, Number(item.quantity) || 0);
    }, 0);
    // 2. Resolve Target Subtotal and Desired Profit
    let resolvedDesiredProfit = 0;
    let targetSellingSubtotal = 0;
    let targetQuotationTotal = 0;
    const totalBaseCost = totalDealerCost || 1;
    const weightedGst = items.reduce((acc, it) => {
        const costWeight = (Math.max(0, it.dealerCost || 0) * (it.quantity || 1)) / totalBaseCost;
        return acc + ((it.gstRate || 18) * costWeight);
    }, 0) || 18;
    switch (pricingMethod) {
        case 'TARGET_PROFIT': {
            resolvedDesiredProfit = Math.max(0, Number(desiredProfit) || 0);
            targetSellingSubtotal = totalDealerCost + resolvedDesiredProfit;
            if (gstMode === 'INCLUSIVE') {
                targetQuotationTotal = Math.round(targetSellingSubtotal * (1 + weightedGst / 100) * 100) / 100;
            }
            break;
        }
        case 'TARGET_TOTAL': {
            const specifiedTarget = Math.max(0, Number(targetTotal) || 0);
            if (gstMode === 'EXCLUSIVE') {
                targetSellingSubtotal = specifiedTarget;
                resolvedDesiredProfit = Math.max(0, targetSellingSubtotal - totalDealerCost);
            }
            else {
                targetQuotationTotal = specifiedTarget;
                targetSellingSubtotal = Math.round((specifiedTarget / (1 + weightedGst / 100)) * 100) / 100;
                resolvedDesiredProfit = Math.max(0, Math.round((targetSellingSubtotal - totalDealerCost) * 100) / 100);
            }
            break;
        }
        case 'MARKUP_PERCENT': {
            const validMarkup = Math.max(0, Number(markupPct) || 0);
            resolvedDesiredProfit = Math.round(totalDealerCost * (validMarkup / 100) * 100) / 100;
            targetSellingSubtotal = totalDealerCost + resolvedDesiredProfit;
            break;
        }
        case 'GROSS_MARGIN_PERCENT': {
            const validMargin = Math.min(99.99, Math.max(0, Number(grossMarginPct) || 0));
            if (validMargin < 100 && totalDealerCost > 0) {
                targetSellingSubtotal = Math.round((totalDealerCost / (1 - validMargin / 100)) * 100) / 100;
                resolvedDesiredProfit = Math.max(0, targetSellingSubtotal - totalDealerCost);
            }
            else {
                targetSellingSubtotal = totalDealerCost;
                resolvedDesiredProfit = 0;
            }
            break;
        }
        case 'MANUAL':
        default: {
            targetSellingSubtotal = items.reduce((acc, it) => {
                const rate = it.manualFinalPrice !== undefined ? it.manualFinalPrice : it.currentSellingPrice;
                return acc + (rate * (it.quantity || 1));
            }, 0);
            resolvedDesiredProfit = Math.max(0, targetSellingSubtotal - totalDealerCost);
            break;
        }
    }
    // 3. Distribute Profit Across Items
    const calculatedItems = [];
    const itemCount = items.length;
    items.forEach((item) => {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitCost = Math.max(0, Number(item.dealerCost) || 0);
        const lineCost = unitCost * qty;
        const gstRate = Number(item.gstRate) || 18;
        let lineAllocatedProfit = 0;
        if (pricingMethod === 'MARKUP_PERCENT') {
            const validMarkup = Math.max(0, Number(markupPct) || 0);
            lineAllocatedProfit = (unitCost * (validMarkup / 100)) * qty;
        }
        else if (pricingMethod === 'GROSS_MARGIN_PERCENT') {
            const validMargin = Math.min(99.99, Math.max(0, Number(grossMarginPct) || 0));
            const unitSelling = validMargin < 100 ? (unitCost / (1 - validMargin / 100)) : unitCost;
            lineAllocatedProfit = (unitSelling - unitCost) * qty;
        }
        else if (pricingMethod === 'MANUAL') {
            const rate = item.manualFinalPrice !== undefined ? item.manualFinalPrice : item.currentSellingPrice;
            lineAllocatedProfit = (rate - unitCost) * qty;
        }
        else {
            switch (allocationMethod) {
                case 'PROPORTIONAL_QTY': {
                    const share = totalQuantity > 0 ? qty / totalQuantity : 1 / itemCount;
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
                    }
                    else {
                        lineAllocatedProfit = resolvedDesiredProfit / (itemCount || 1);
                    }
                    break;
                }
            }
        }
        const unitAllocatedProfit = lineAllocatedProfit / qty;
        let rawSuggestedPrice = unitCost + unitAllocatedProfit;
        if (gstMode === 'INCLUSIVE') {
            rawSuggestedPrice = rawSuggestedPrice * (1 + gstRate / 100);
        }
        const roundedSuggestedPrice = applyRounding(rawSuggestedPrice, roundingMethod);
        const hasManualOverride = item.manualFinalPrice !== undefined;
        const finalPrice = item.manualFinalPrice !== undefined ? item.manualFinalPrice : roundedSuggestedPrice;
        const totalSellingPrice = finalPrice * qty;
        let taxableAmount = 0;
        let gstAmount = 0;
        let lineTotal = 0;
        if (gstMode === 'INCLUSIVE') {
            lineTotal = totalSellingPrice;
            taxableAmount = Math.round((lineTotal / (1 + gstRate / 100)) * 100) / 100;
            gstAmount = Math.round((lineTotal - taxableAmount) * 100) / 100;
        }
        else {
            taxableAmount = totalSellingPrice;
            gstAmount = Math.round((taxableAmount * (gstRate / 100)) * 100) / 100;
            lineTotal = Math.round((taxableAmount + gstAmount) * 100) / 100;
        }
        const effectiveProfitPerUnit = (taxableAmount / qty) - unitCost;
        const effectiveProfitPct = unitCost > 0 ? (effectiveProfitPerUnit / unitCost) * 100 : 0;
        const effectiveGrossMarginPct = taxableAmount > 0 ? (effectiveProfitPerUnit / (taxableAmount / qty)) * 100 : 0;
        let onlineDiff;
        let onlineDiffPct;
        let onlineStatus = 'UNAVAILABLE';
        if (item.onlineReference && item.onlineReference.referencePrice > 0) {
            const refPrice = item.onlineReference.referencePrice;
            onlineDiff = finalPrice - refPrice;
            onlineDiffPct = refPrice > 0 ? (onlineDiff / refPrice) * 100 : 0;
            if (onlineDiff < -10) {
                onlineStatus = 'BELOW';
            }
            else if (Math.abs(onlineDiff) <= 10 || Math.abs(onlineDiffPct) <= 2) {
                onlineStatus = 'NEAR';
            }
            else {
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
    });
    // 4. Deterministic Remainder Reconciliation
    const hasAnyManualOverrides = calculatedItems.some(i => i.isManuallyOverridden);
    if (!hasAnyManualOverrides && (pricingMethod === 'TARGET_PROFIT' || pricingMethod === 'TARGET_TOTAL')) {
        const rawSum = calculatedItems.reduce((acc, it) => acc + (it.finalPrice * it.quantity), 0);
        const targetToMatch = gstMode === 'INCLUSIVE'
            ? (targetQuotationTotal || Math.round(targetSellingSubtotal * (1 + weightedGst / 100) * 100) / 100)
            : targetSellingSubtotal;
        const delta = Math.round((targetToMatch - rawSum) * 100) / 100;
        if (Math.abs(delta) > 0 && Math.abs(delta) <= 5 && calculatedItems.length > 0) {
            let bestIdx = 0;
            let maxCost = -1;
            calculatedItems.forEach((it, idx) => {
                if (it.dealerCost > maxCost && it.quantity === 1) {
                    maxCost = it.dealerCost;
                    bestIdx = idx;
                }
            });
            const it = calculatedItems[bestIdx];
            const newPrice = Math.round((it.finalPrice + delta) * 100) / 100;
            it.finalPrice = newPrice;
            it.totalSellingPrice = newPrice * it.quantity;
            if (gstMode === 'INCLUSIVE') {
                it.lineTotal = it.totalSellingPrice;
                it.taxableAmount = Math.round((it.lineTotal / (1 + it.gstRate / 100)) * 100) / 100;
                it.gstAmount = Math.round((it.lineTotal - it.taxableAmount) * 100) / 100;
            }
            else {
                it.taxableAmount = it.totalSellingPrice;
                it.gstAmount = Math.round((it.taxableAmount * (it.gstRate / 100)) * 100) / 100;
                it.lineTotal = Math.round((it.taxableAmount + it.gstAmount) * 100) / 100;
            }
            const profitPerUnit = (it.taxableAmount / it.quantity) - it.dealerCost;
            it.effectiveProfitPct = it.dealerCost > 0 ? Math.round((profitPerUnit / it.dealerCost) * 10000) / 100 : 0;
            it.effectiveGrossMarginPct = it.taxableAmount > 0 ? Math.round((profitPerUnit / (it.taxableAmount / it.quantity)) * 10000) / 100 : 0;
        }
    }
    // 5. Aggregate Totals
    const actualSellingSubtotal = calculatedItems.reduce((acc, it) => acc + (gstMode === 'INCLUSIVE' ? it.taxableAmount : it.totalSellingPrice), 0);
    const actualProfit = actualSellingSubtotal - totalDealerCost;
    const actualGstTotal = calculatedItems.reduce((acc, it) => acc + it.gstAmount, 0);
    const actualFinalTotal = gstMode === 'INCLUSIVE'
        ? calculatedItems.reduce((acc, it) => acc + it.lineTotal, 0)
        : Math.round((actualSellingSubtotal + actualGstTotal) * 100) / 100;
    const targetFinalTotal = gstMode === 'INCLUSIVE'
        ? (targetQuotationTotal || Math.round(targetSellingSubtotal * (1 + weightedGst / 100) * 100) / 100)
        : Math.round((targetSellingSubtotal + actualGstTotal) * 100) / 100;
    const effectiveMarkupPct = totalDealerCost > 0
        ? Math.round((actualProfit / totalDealerCost) * 10000) / 100
        : 0;
    const effectiveGrossMarginPct = actualSellingSubtotal > 0
        ? Math.round((actualProfit / actualSellingSubtotal) * 10000) / 100
        : 0;
    const compareTarget = gstMode === 'INCLUSIVE' ? targetFinalTotal : targetSellingSubtotal;
    const compareActual = gstMode === 'INCLUSIVE' ? actualFinalTotal : actualSellingSubtotal;
    const reconciliationDelta = Math.round((compareActual - compareTarget) * 100) / 100;
    const targetAchieved = Math.abs(reconciliationDelta) <= 1.0;
    // 6. Overall Online Comparison Aggregation
    let onlineRefTotal = 0;
    let onlineItemsCount = 0;
    calculatedItems.forEach(it => {
        if (it.onlineReference && it.onlineReference.referencePrice > 0) {
            onlineRefTotal += it.onlineReference.referencePrice * it.quantity;
            onlineItemsCount++;
        }
    });
    const onlineDiffTotal = onlineItemsCount > 0 ? actualFinalTotal - onlineRefTotal : 0;
    const onlineDiffPctTotal = onlineRefTotal > 0 ? (onlineDiffTotal / onlineRefTotal) * 100 : 0;
    let overallOnlineStatus = 'UNAVAILABLE';
    if (onlineItemsCount > 0) {
        if (onlineDiffTotal < -50) {
            overallOnlineStatus = 'COMPETITIVE';
        }
        else if (Math.abs(onlineDiffTotal) <= 50 || Math.abs(onlineDiffPctTotal) <= 2) {
            overallOnlineStatus = 'MATCHING';
        }
        else {
            overallOnlineStatus = 'ABOVE';
        }
    }
    return {
        method: pricingMethod,
        allocationMethod,
        roundingMethod,
        gstMode,
        items: calculatedItems,
        totalDealerCost: Math.round(totalDealerCost * 100) / 100,
        desiredProfit: resolvedDesiredProfit,
        actualProfit: Math.round(actualProfit * 100) / 100,
        targetSellingSubtotal: Math.round(targetSellingSubtotal * 100) / 100,
        actualSellingSubtotal: Math.round(actualSellingSubtotal * 100) / 100,
        targetFinalTotal: Math.round(targetFinalTotal * 100) / 100,
        actualGstTotal: Math.round(actualGstTotal * 100) / 100,
        actualFinalTotal: Math.round(actualFinalTotal * 100) / 100,
        effectiveMarkupPct,
        effectiveGrossMarginPct,
        hasManualOverrides: hasAnyManualOverrides,
        targetAchieved,
        reconciliationDelta,
        onlineComparison: {
            yourSellingTotal: Math.round((gstMode === 'INCLUSIVE' ? actualFinalTotal : actualSellingSubtotal) * 100) / 100,
            onlineReferenceTotal: Math.round(onlineRefTotal * 100) / 100,
            difference: Math.round(onlineDiffTotal * 100) / 100,
            diffPct: Math.round(onlineDiffPctTotal * 100) / 100,
            status: overallOnlineStatus
        }
    };
}
exports.DEFAULT_ONLINE_REFERENCES = {
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
function matchDefaultOnlineReference(description) {
    if (!description)
        return null;
    const descLower = description.toLowerCase();
    for (const [key, ref] of Object.entries(exports.DEFAULT_ONLINE_REFERENCES)) {
        if (descLower.includes(key)) {
            return { ...ref };
        }
    }
    return null;
}
