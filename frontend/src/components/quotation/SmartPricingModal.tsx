import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Tag,
  Coins,
  Receipt,
  Percent,
  BarChart3,
  Edit3,
  RotateCcw,
  Check,
  Search,
  ExternalLink,
  Info,
  ShoppingCart,
  Wand2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Globe,
  Sliders,
  DollarSign
} from 'lucide-react';
import {
  PricingMethod,
  AllocationMethod,
  RoundingMethod,
  GstMode,
  SmartPricingItemInput,
  CalculatedSmartItem,
  SmartPricingResult,
  calculateSmartPricing,
  matchDefaultOnlineReference,
  OnlineReferenceInfo,
  MatchQuality
} from '../../utils/smartPricingEngine';
import { QuotationLineItem } from '../../utils/quotationStorage';

export interface SmartPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationItems: QuotationLineItem[];
  stockItemsList?: any[]; // Full stock items catalog with purchase_rate_paise
  currentTaxMode: 'EXCLUSIVE' | 'INCLUSIVE';
  companyState?: string;
  placeOfSupply?: string;
  onApplyPricing: (
    updatedItems: { id: string; rate: number; dealerCost?: number }[],
    newTaxMode: 'EXCLUSIVE' | 'INCLUSIVE'
  ) => void;
}

function formatINR(val: number): string {
  return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const SmartPricingModal: React.FC<SmartPricingModalProps> = ({
  isOpen,
  onClose,
  quotationItems,
  stockItemsList = [],
  currentTaxMode,
  companyState = 'Tamil Nadu',
  placeOfSupply = 'Tamil Nadu',
  onApplyPricing
}) => {
  // Modal active tab
  const [activeTab, setActiveTab] = useState<'SMART_PRICING' | 'ONLINE_CHECK'>('SMART_PRICING');

  // Pricing configuration states
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('TARGET_PROFIT');
  const [gstMode, setGstMode] = useState<GstMode>(currentTaxMode);
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>('PROPORTIONAL_COST');
  const [roundingMethod, setRoundingMethod] = useState<RoundingMethod>('NEAREST_1');

  // Target inputs
  const [desiredProfitInput, setDesiredProfitInput] = useState<string>('1000');
  const [targetTotalInput, setTargetTotalInput] = useState<string>('5000');
  const [markupPctInput, setMarkupPctInput] = useState<string>('20.00');
  const [grossMarginPctInput, setGrossMarginPctInput] = useState<string>('16.67');

  // Item working state (dealer costs, manual overrides, online references)
  const [workingItems, setWorkingItems] = useState<SmartPricingItemInput[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  // Manual reference editing modal state
  const [editingReferenceItemIdx, setEditingReferenceItemIdx] = useState<number | null>(null);
  const [refPriceInput, setRefPriceInput] = useState<string>('');
  const [refRetailerInput, setRefRetailerInput] = useState<string>('');
  const [refUrlInput, setRefUrlInput] = useState<string>('');
  const [refMatchQuality, setRefMatchQuality] = useState<MatchQuality>('MANUAL_REFERENCE');

  // Initialize working items when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial: SmartPricingItemInput[] = quotationItems.map((qItem, idx) => {
        // 1. Check if qItem already has a genuine dealerCost explicitly specified
        let defaultCost: number | undefined = undefined;
        let isCostMissing = true;

        if (typeof qItem.dealerCost === 'number' && !isNaN(qItem.dealerCost) && qItem.dealerCost > 0) {
          defaultCost = qItem.dealerCost;
          isCostMissing = false;
        } else if (stockItemsList && stockItemsList.length > 0) {
          // 2. Look up dealer cost from stockItemsList purchase_rate_paise
          const matchedStock = stockItemsList.find((s) =>
            (qItem.itemId && (s.item_id === qItem.itemId || s.id === qItem.itemId)) ||
            (s.item_name && qItem.description && s.item_name.trim().toLowerCase() === qItem.description.trim().toLowerCase())
          );
          if (matchedStock) {
            if (matchedStock.purchase_rate_paise && matchedStock.purchase_rate_paise > 0) {
              defaultCost = matchedStock.purchase_rate_paise / 100;
              isCostMissing = false;
            } else if (matchedStock.purchase_rate && Number(matchedStock.purchase_rate) > 0) {
              defaultCost = Number(matchedStock.purchase_rate);
              isCostMissing = false;
            } else if (matchedStock.cost_price_paise && matchedStock.cost_price_paise > 0) {
              defaultCost = matchedStock.cost_price_paise / 100;
              isCostMissing = false;
            }
          }
        }

        // Online reference lookup
        const onlineRef = matchDefaultOnlineReference(qItem.description);

        return {
          id: qItem.id || `item_${idx}`,
          itemId: qItem.itemId,
          name: qItem.description || `Item ${idx + 1}`,
          description: qItem.description,
          subtext: qItem.subtext,
          hsnSac: qItem.hsnSac || '',
          quantity: Number(qItem.quantity) || 1,
          unit: qItem.unit || 'NOS',
          gstRate: Number(qItem.gstRate) || 18,
          dealerCost: defaultCost,
          costNotSet: isCostMissing,
          currentSellingPrice: Number(qItem.rate) || 0,
          manualFinalPrice: undefined,
          isService: qItem.isService,
          onlineReference: onlineRef
        };
      });

      setWorkingItems(initial);
      setGstMode(currentTaxMode);

      // Compute realistic initial target values based on real items in this quotation
      const totalCost = initial.reduce((sum, it) => sum + ((it.dealerCost && !it.costNotSet ? it.dealerCost : 0) * (it.quantity || 1)), 0);
      const currentSellingTotal = initial.reduce((sum, it) => sum + ((it.currentSellingPrice || 0) * (it.quantity || 1)), 0);

      let initialProfit = 0;
      if (totalCost > 0) {
        if (currentSellingTotal > totalCost) {
          initialProfit = Math.round(currentSellingTotal - totalCost);
        } else {
          initialProfit = Math.round(totalCost * 0.20); // 20% default markup
        }
      } else {
        // Dealer cost not set: do not invent bogus profit
        initialProfit = 0;
      }

      const initialSubtotal = totalCost + initialProfit;
      const avgGst = initial.length > 0 ? (initial.reduce((s, it) => s + (it.gstRate || 18), 0) / initial.length) : 18;
      const initialGrandTotal = Math.round(initialSubtotal * (1 + avgGst / 100));

      const markupPct = totalCost > 0 ? ((initialProfit / totalCost) * 100).toFixed(2) : '20.00';
      const marginPct = initialSubtotal > 0 ? ((initialProfit / initialSubtotal) * 100).toFixed(2) : '16.67';

      setDesiredProfitInput(String(initialProfit));
      setTargetTotalInput(currentTaxMode === 'INCLUSIVE' ? String(initialGrandTotal) : String(initialSubtotal));
      setMarkupPctInput(markupPct);
      setGrossMarginPctInput(marginPct);
      setIsDirty(false);
    }
  }, [isOpen]);

  // Keyboard navigation & Escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (editingReferenceItemIdx !== null) {
          setEditingReferenceItemIdx(null);
        } else if (isDirty) {
          setShowConfirmClose(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDirty, editingReferenceItemIdx, onClose]);

  // Compute calculated pricing result
  const isInterstate = Boolean(
    placeOfSupply && companyState && placeOfSupply.toLowerCase() !== companyState.toLowerCase()
  );

  const pricingResult: SmartPricingResult = useMemo(() => {
    return calculateSmartPricing({
      items: workingItems,
      pricingMethod,
      desiredProfit: parseFloat(desiredProfitInput) || 0,
      targetTotal: parseFloat(targetTotalInput) || 0,
      markupPct: parseFloat(markupPctInput) || 0,
      grossMarginPct: parseFloat(grossMarginPctInput) || 0,
      allocationMethod,
      roundingMethod,
      gstMode,
      isInterstate
    });
  }, [
    workingItems,
    pricingMethod,
    desiredProfitInput,
    targetTotalInput,
    markupPctInput,
    grossMarginPctInput,
    allocationMethod,
    roundingMethod,
    gstMode,
    isInterstate
  ]);

  // Handlers for modifying working items
  const handleUpdateDealerCost = (index: number, newCostStr: string) => {
    if (newCostStr.trim() === '') {
      setWorkingItems((prev) => {
        const copy = [...prev];
        if (copy[index]) {
          copy[index] = { ...copy[index], dealerCost: undefined, costNotSet: true };
        }
        return copy;
      });
      setIsDirty(true);
      return;
    }
    const parsed = parseFloat(newCostStr);
    const cost = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setWorkingItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], dealerCost: cost, costNotSet: cost <= 0 };
      }
      return copy;
    });
    setIsDirty(true);
  };

  const handleUpdateFinalPrice = (index: number, newPriceStr: string) => {
    if (newPriceStr.trim() === '') {
      // Revert back to suggested price
      setWorkingItems((prev) => {
        const copy = [...prev];
        if (copy[index]) {
          copy[index] = { ...copy[index], manualFinalPrice: undefined };
        }
        return copy;
      });
      setIsDirty(true);
      return;
    }
    const parsed = parseFloat(newPriceStr);
    const price = isNaN(parsed) ? 0 : Math.max(0, parsed);
    setWorkingItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], manualFinalPrice: price };
      }
      return copy;
    });
    setIsDirty(true);
  };

  const handleResetManualPrices = () => {
    setWorkingItems((prev) =>
      prev.map((it) => ({
        ...it,
        manualFinalPrice: undefined
      }))
    );
    setIsDirty(true);
  };

  const handleRecalculate = () => {
    handleResetManualPrices();
  };

  const handleApplyToQuotation = () => {
    const updates = pricingResult.items.map((item) => ({
      id: item.id,
      rate: item.finalPrice,
      dealerCost: item.dealerCost > 0 ? item.dealerCost : undefined
    }));
    onApplyPricing(updates, gstMode);
    setIsDirty(false);
    onClose();
  };

  const handleAdoptOnlinePrice = (index: number) => {
    const item = pricingResult.items[index];
    if (item.onlineReference && item.onlineReference.referencePrice > 0) {
      handleUpdateFinalPrice(index, String(item.onlineReference.referencePrice));
    }
  };

  const handleOpenEditReference = (index: number) => {
    const item = workingItems[index];
    setEditingReferenceItemIdx(index);
    setRefPriceInput(item.onlineReference?.referencePrice ? String(item.onlineReference.referencePrice) : '');
    setRefRetailerInput(item.onlineReference?.retailer || 'Amazon India');
    setRefUrlInput(item.onlineReference?.sourceUrl || '');
    setRefMatchQuality(item.onlineReference?.matchQuality || 'MANUAL_REFERENCE');
  };

  const handleSaveReference = () => {
    if (editingReferenceItemIdx === null) return;
    const price = Math.max(0, parseFloat(refPriceInput) || 0);
    setWorkingItems((prev) => {
      const copy = [...prev];
      const it = copy[editingReferenceItemIdx];
      const updatedRef: OnlineReferenceInfo = {
        productName: it.name,
        retailer: refRetailerInput || 'Manual Reference',
        referencePrice: price,
        gstInclusive: true,
        sourceUrl: refUrlInput || `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(it.name)}`,
        lastChecked: new Date().toISOString().slice(0, 10),
        matchQuality: refMatchQuality,
        availability: 'Verified'
      };
      copy[editingReferenceItemIdx] = { ...it, onlineReference: updatedRef };
      return copy;
    });
    setEditingReferenceItemIdx(null);
    setIsDirty(true);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-pricing-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1050,
        padding: '16px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (isDirty) setShowConfirmClose(true);
          else onClose();
        }
      }}
    >
      {/* Centered Modal Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '1240px',
          maxHeight: 'calc(100vh - 36px)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          color: 'var(--color-text, #0F172A)',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #E5E7EB)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--color-border, #E5E7EB)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 100, 31, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary, #FF641F)',
                flexShrink: 0
              }}
            >
              <Tag size={20} />
            </div>
            <div>
              <h2
                id="smart-pricing-title"
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--color-text, #0F172A)',
                  letterSpacing: '-0.01em'
                }}
              >
                Smart Pricing & Online Price Check
              </h2>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '12px',
                  color: 'var(--color-text-muted, #64748B)'
                }}
              >
                Set your desired profit or target price and let LedgerFlow calculate item-wise selling prices.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* GST Mode Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label
                htmlFor="gst-mode-select"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-muted, #64748B)'
                }}
              >
                GST Mode:
              </label>
              <select
                id="gst-mode-select"
                value={gstMode}
                onChange={(e) => {
                  setGstMode(e.target.value as GstMode);
                  setIsDirty(true);
                }}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                  color: 'var(--color-text, #0F172A)',
                  cursor: 'pointer'
                }}
              >
                <option value="EXCLUSIVE">Exclusive (Add GST Separately)</option>
                <option value="INCLUSIVE">Inclusive (Target includes GST)</option>
              </select>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (isDirty) setShowConfirmClose(true);
                else onClose();
              }}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                border: '1px solid var(--color-border, #E5E7EB)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted, #64748B)',
                cursor: 'pointer'
              }}
              title="Close (Esc)"
              aria-label="Close Smart Pricing Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border, #E5E7EB)',
            padding: '0 24px',
            backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
            gap: '24px',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('SMART_PRICING')}
            style={{
              padding: '12px 4px',
              fontSize: '13px',
              fontWeight: activeTab === 'SMART_PRICING' ? 700 : 500,
              color: activeTab === 'SMART_PRICING' ? 'var(--color-primary, #FF641F)' : 'var(--color-text-muted, #64748B)',
              borderBottom: activeTab === 'SMART_PRICING' ? '2.5px solid var(--color-primary, #FF641F)' : '2.5px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Tag size={15} />
            <span>Smart Pricing</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ONLINE_CHECK')}
            style={{
              padding: '12px 4px',
              fontSize: '13px',
              fontWeight: activeTab === 'ONLINE_CHECK' ? 700 : 500,
              color: activeTab === 'ONLINE_CHECK' ? 'var(--color-primary, #FF641F)' : 'var(--color-text-muted, #64748B)',
              borderBottom: activeTab === 'ONLINE_CHECK' ? '2.5px solid var(--color-primary, #FF641F)' : '2.5px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={15} />
            <span>Online Price Check</span>
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: 'rgba(255, 100, 31, 0.15)',
                color: 'var(--color-primary, #FF641F)',
                fontWeight: 700
              }}
            >
              {workingItems.filter((i) => i.onlineReference && i.onlineReference.referencePrice > 0).length} Matched
            </span>
          </button>
        </div>

        {/* Scrollable Stage Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {activeTab === 'SMART_PRICING' ? (
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
              {/* ── Main Left Area (~70%) ── */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Section 1: Pricing Method */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      1
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Pricing Method</h3>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>
                        Choose how you want to set the selling prices.
                      </p>
                    </div>
                  </div>

                  {/* 5 Selectable Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    {/* Card 1: Target Profit */}
                    <div
                      onClick={() => {
                        setPricingMethod('TARGET_PROFIT');
                        if (!desiredProfitInput || desiredProfitInput === '0') {
                          setDesiredProfitInput(String(Math.round(pricingResult.actualProfit || pricingResult.desiredProfit) || 1000));
                        }
                        setIsDirty(true);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '8px',
                        border:
                          pricingMethod === 'TARGET_PROFIT'
                            ? '1.5px solid var(--color-primary, #FF641F)'
                            : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor:
                          pricingMethod === 'TARGET_PROFIT' ? 'rgba(255, 100, 31, 0.05)' : 'var(--color-surface, #FFFFFF)',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {pricingMethod === 'TARGET_PROFIT' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #FF641F)'
                          }}
                        />
                      )}
                      <Coins size={18} color="var(--color-primary, #FF641F)" />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Target Profit</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.25 }}>
                        Enter total profit amount
                      </div>
                    </div>

                    {/* Card 2: Target Total */}
                    <div
                      onClick={() => {
                        setPricingMethod('TARGET_TOTAL');
                        const totalVal = gstMode === 'INCLUSIVE'
                          ? Math.round(pricingResult.actualFinalTotal)
                          : Math.round(pricingResult.actualSellingSubtotal);
                        if (totalVal > 0) {
                          setTargetTotalInput(String(totalVal));
                        }
                        setIsDirty(true);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '8px',
                        border:
                          pricingMethod === 'TARGET_TOTAL'
                            ? '1.5px solid var(--color-primary, #FF641F)'
                            : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor:
                          pricingMethod === 'TARGET_TOTAL' ? 'rgba(255, 100, 31, 0.05)' : 'var(--color-surface, #FFFFFF)',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {pricingMethod === 'TARGET_TOTAL' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #FF641F)'
                          }}
                        />
                      )}
                      <Receipt size={18} color="var(--color-primary, #FF641F)" />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Target Total</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.25 }}>
                        Enter final quotation amount
                      </div>
                    </div>

                    {/* Card 3: Markup % */}
                    <div
                      onClick={() => {
                        setPricingMethod('MARKUP_PERCENT');
                        if (pricingResult.effectiveMarkupPct > 0) {
                          setMarkupPctInput(pricingResult.effectiveMarkupPct.toFixed(2));
                        }
                        setIsDirty(true);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '8px',
                        border:
                          pricingMethod === 'MARKUP_PERCENT'
                            ? '1.5px solid var(--color-primary, #FF641F)'
                            : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor:
                          pricingMethod === 'MARKUP_PERCENT' ? 'rgba(255, 100, 31, 0.05)' : 'var(--color-surface, #FFFFFF)',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {pricingMethod === 'MARKUP_PERCENT' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #FF641F)'
                          }}
                        />
                      )}
                      <Percent size={18} color="var(--color-primary, #FF641F)" />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Markup %</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.25 }}>
                        Add markup percentage on cost
                      </div>
                    </div>

                    {/* Card 4: Gross Margin % */}
                    <div
                      onClick={() => {
                        setPricingMethod('GROSS_MARGIN_PERCENT');
                        if (pricingResult.effectiveGrossMarginPct > 0) {
                          setGrossMarginPctInput(pricingResult.effectiveGrossMarginPct.toFixed(2));
                        }
                        setIsDirty(true);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '8px',
                        border:
                          pricingMethod === 'GROSS_MARGIN_PERCENT'
                            ? '1.5px solid var(--color-primary, #FF641F)'
                            : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor:
                          pricingMethod === 'GROSS_MARGIN_PERCENT'
                            ? 'rgba(255, 100, 31, 0.05)'
                            : 'var(--color-surface, #FFFFFF)',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {pricingMethod === 'GROSS_MARGIN_PERCENT' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #FF641F)'
                          }}
                        />
                      )}
                      <BarChart3 size={18} color="var(--color-primary, #FF641F)" />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Gross Margin %</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.25 }}>
                        Set gross margin on selling price
                      </div>
                    </div>

                    {/* Card 5: Manual Pricing */}
                    <div
                      onClick={() => {
                        setPricingMethod('MANUAL');
                        setIsDirty(true);
                      }}
                      style={{
                        padding: '12px 10px',
                        borderRadius: '8px',
                        border:
                          pricingMethod === 'MANUAL'
                            ? '1.5px solid var(--color-primary, #FF641F)'
                            : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor:
                          pricingMethod === 'MANUAL' ? 'rgba(255, 100, 31, 0.05)' : 'var(--color-surface, #FFFFFF)',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      {pricingMethod === 'MANUAL' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary, #FF641F)'
                          }}
                        />
                      )}
                      <Edit3 size={18} color="var(--color-primary, #FF641F)" />
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>Manual Pricing</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.25 }}>
                        Set price for each item manually
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Global Settings */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      2
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Global Settings</h3>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>
                        {pricingMethod === 'TARGET_PROFIT' &&
                          'Enter total cost and desired profit. System will calculate item-wise selling prices.'}
                        {pricingMethod === 'TARGET_TOTAL' &&
                          'Enter target total amount. System will back-calculate pre-tax subtotal and item prices.'}
                        {pricingMethod === 'MARKUP_PERCENT' &&
                          'Enter markup percentage on cost. System will apply markup to item dealer costs.'}
                        {pricingMethod === 'GROSS_MARGIN_PERCENT' &&
                          'Enter gross margin percentage. System will calculate required selling prices.'}
                        {pricingMethod === 'MANUAL' &&
                          'Manual mode: Edit prices directly in the table below. Summary will update in real-time.'}
                      </p>
                    </div>
                  </div>

                  {/* Settings Inputs Row */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {/* Total Dealer Cost (Readonly) */}
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                        Total Dealer Cost (₹)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formatINR(pricingResult.totalDealerCost)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '13px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                          color: 'var(--color-text, #0F172A)',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Method-specific Target Input */}
                    {pricingMethod === 'TARGET_PROFIT' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                          Desired Profit (₹)
                        </label>
                        <input
                          type="number"
                          value={desiredProfitInput}
                          onChange={(e) => {
                            setDesiredProfitInput(e.target.value);
                            setIsDirty(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--color-primary, #FF641F)',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            color: 'var(--color-text, #0F172A)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}

                    {pricingMethod === 'TARGET_TOTAL' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                          Target {gstMode === 'INCLUSIVE' ? 'Quotation Total' : 'Selling Subtotal'} (₹)
                        </label>
                        <input
                          type="number"
                          value={targetTotalInput}
                          onChange={(e) => {
                            setTargetTotalInput(e.target.value);
                            setIsDirty(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--color-primary, #FF641F)',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            color: 'var(--color-text, #0F172A)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}

                    {pricingMethod === 'MARKUP_PERCENT' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                          Markup Percentage (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={markupPctInput}
                          onChange={(e) => {
                            setMarkupPctInput(e.target.value);
                            setIsDirty(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--color-primary, #FF641F)',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            color: 'var(--color-text, #0F172A)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}

                    {pricingMethod === 'GROSS_MARGIN_PERCENT' && (
                      <div style={{ flex: '1 1 140px' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                          Gross Margin (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          max="99.9"
                          value={grossMarginPctInput}
                          onChange={(e) => {
                            setGrossMarginPctInput(e.target.value);
                            setIsDirty(true);
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--color-primary, #FF641F)',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            color: 'var(--color-text, #0F172A)',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    )}

                    {/* Target Selling Subtotal Box */}
                    <div style={{ flex: '1 1 140px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                        Target Selling Subtotal
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={formatINR(pricingResult.targetSellingSubtotal)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '13px',
                          fontWeight: 800,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                          color: 'var(--color-text, #0F172A)',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    {/* Allocation Method Selector */}
                    <div style={{ flex: '1 1 170px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                        Allocation Method
                      </label>
                      <select
                        value={allocationMethod}
                        onChange={(e) => {
                          setAllocationMethod(e.target.value as AllocationMethod);
                          setIsDirty(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: 'var(--color-surface, #FFFFFF)',
                          color: 'var(--color-text, #0F172A)',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="PROPORTIONAL_COST">Proportional to Dealer Cost</option>
                        <option value="PROPORTIONAL_QTY">Proportional to Quantity</option>
                        <option value="EQUAL">Equal Allocation</option>
                      </select>
                    </div>

                    {/* Rounding Method Selector */}
                    <div style={{ flex: '1 1 120px' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted, #64748B)', marginBottom: '4px' }}>
                        Rounding
                      </label>
                      <select
                        id="smart-pricing-rounding-select"
                        value={roundingMethod}
                        onChange={(e) => {
                          setRoundingMethod(e.target.value as RoundingMethod);
                          setIsDirty(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: 'var(--color-surface, #FFFFFF)',
                          color: 'var(--color-text, #0F172A)',
                          boxSizing: 'border-box'
                        }}
                      >
                        <option value="EXACT_2_DECIMALS">Exact ₹0.01</option>
                        <option value="NEAREST_1">Nearest ₹1</option>
                        <option value="ROUND_5">Nearest ₹5</option>
                        <option value="ROUND_10">Nearest ₹10</option>
                        <option value="ROUND_50">Nearest ₹50</option>
                        <option value="ROUND_100">Nearest ₹100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Item-wise Pricing Preview */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: '#EFF6FF',
                          color: '#2563EB',
                          fontSize: '12px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        3
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Item-wise Pricing Preview</h3>
                        <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>
                          Calculated selling prices based on your settings. You can edit any price manually.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRecalculate}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                        color: 'var(--color-text, #0F172A)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      title="Reset manual overrides and recalculate"
                    >
                      <RotateCcw size={13} />
                      <span>Recalculate</span>
                    </button>
                  </div>

                  {/* Warnings Banner */}
                  {pricingResult.warnings && pricingResult.warnings.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#B45309',
                        fontSize: '12px',
                        fontWeight: 500,
                        marginBottom: '14px'
                      }}
                    >
                      <AlertTriangle size={16} color="#D97706" style={{ flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {pricingResult.warnings.map((w, i) => (
                          <div key={i}>{w}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pricing Preview Table */}
                  <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-secondary, #F8F7F4)', borderBottom: '1px solid var(--color-border, #E5E7EB)' }}>
                          <th style={{ padding: '8px 6px', textAlign: 'left', width: '28px', color: 'var(--color-text-muted, #64748B)' }}>#</th>
                          <th style={{ padding: '8px 6px', textAlign: 'left', minWidth: '170px', color: 'var(--color-text-muted, #64748B)' }}>Item Name & Description</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', width: '80px', color: 'var(--color-text-muted, #64748B)' }}>HSN/SAC</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', width: '45px', color: 'var(--color-text-muted, #64748B)' }}>Qty</th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', width: '105px', color: 'var(--color-text-muted, #64748B)' }}>
                            Dealer Cost (₹)<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>(Unit Cost)</span>
                          </th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', width: '90px', color: 'var(--color-text-muted, #64748B)' }}>
                            Allocated Profit (₹)
                          </th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', width: '95px', color: 'var(--color-text-muted, #64748B)' }}>
                            Suggested Price (₹)<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>({gstMode === 'INCLUSIVE' ? 'Incl. GST' : 'Excl. GST'})</span>
                          </th>
                          <th style={{ padding: '8px 6px', textAlign: 'right', width: '105px', color: 'var(--color-text-muted, #64748B)' }}>
                            Final Price (₹)<br /><span style={{ fontSize: '10px', fontWeight: 400 }}>({gstMode === 'INCLUSIVE' ? 'Incl. GST' : 'Excl. GST'})</span>
                          </th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', width: '75px', color: 'var(--color-text-muted, #64748B)' }}>Profit %</th>
                          <th style={{ padding: '8px 6px', textAlign: 'center', width: '38px', color: 'var(--color-text-muted, #64748B)' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingResult.items.map((row, idx) => (
                          <tr
                            key={row.id || idx}
                            style={{
                              borderBottom: '1px solid var(--color-border, #E5E7EB)',
                              backgroundColor: row.isManuallyOverridden ? 'rgba(255, 100, 31, 0.03)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '8px 6px', verticalAlign: 'middle', color: 'var(--color-text-muted, #64748B)' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '8px 6px', verticalAlign: 'middle' }}>
                              <div style={{ fontWeight: 600 }}>{row.name}</div>
                              {row.subtext && (
                                <div style={{ fontSize: '10.5px', color: 'var(--color-text-muted, #64748B)' }}>
                                  {row.subtext}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', color: 'var(--color-text-muted, #64748B)' }}>
                              {row.hsnSac || '—'}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle', fontWeight: 600 }}>
                              {row.quantity}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle' }}>
                              {row.costNotSet && (
                                <div style={{ marginBottom: '3px' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      fontSize: '9.5px',
                                      fontWeight: 700,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                      color: '#DC2626',
                                      border: '1px solid rgba(239, 68, 68, 0.2)'
                                    }}
                                  >
                                    Cost not set
                                  </span>
                                </div>
                              )}
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.costNotSet ? '' : (row.dealerCost === 0 ? '' : row.dealerCost)}
                                placeholder={row.costNotSet ? "Enter cost" : "0.00"}
                                onChange={(e) => handleUpdateDealerCost(idx, e.target.value)}
                                style={{
                                  width: '95px',
                                  padding: '4px 6px',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  border: row.costNotSet ? '1.5px dashed #EF4444' : '1px solid var(--color-border, #E5E7EB)',
                                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                                  color: 'var(--color-text, #0F172A)'
                                }}
                              />
                              <div style={{ fontSize: '10px', color: 'var(--color-text-muted, #64748B)', marginTop: '2px', fontFamily: 'monospace' }}>
                                Line: {formatINR(row.totalDealerCost)}
                              </div>
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle', fontFamily: 'monospace' }}>
                              {formatINR(row.allocatedProfit)}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle', fontFamily: 'monospace', color: 'var(--color-text-muted, #64748B)' }}>
                              {formatINR(row.suggestedPrice)}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={row.isManuallyOverridden ? (row.finalPrice === 0 ? '' : row.finalPrice) : row.suggestedPrice}
                                placeholder={String(row.suggestedPrice)}
                                onChange={(e) => handleUpdateFinalPrice(idx, e.target.value)}
                                style={{
                                  width: '95px',
                                  padding: '4px 6px',
                                  textAlign: 'right',
                                  fontSize: '12px',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  borderRadius: '4px',
                                  border: row.isManuallyOverridden
                                    ? '1.5px solid var(--color-primary, #FF641F)'
                                    : '1px solid var(--color-border, #E5E7EB)',
                                  backgroundColor: row.isManuallyOverridden ? 'rgba(255, 100, 31, 0.05)' : 'var(--color-surface, #FFFFFF)',
                                  color: 'var(--color-text, #0F172A)'
                                }}
                              />
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: '999px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: row.effectiveProfitPct >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                  color: row.effectiveProfitPct >= 0 ? '#10B981' : '#EF4444'
                                }}
                              >
                                {row.effectiveProfitPct.toFixed(2)}%
                              </span>
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('ONLINE_CHECK');
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--color-primary, #FF641F)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px'
                                }}
                                title="View online price check for this item"
                              >
                                <Search size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Reconcile Note and Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingTop: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--color-text-muted, #64748B)' }}>
                      <Info size={14} />
                      <span>
                        {pricingResult.targetAchieved
                          ? 'Final prices are rounded and adjusted to match the target total exactly.'
                          : pricingResult.hasManualOverrides
                          ? `Manual price overrides active (Discrepancy: ${formatINR(Math.abs(pricingResult.reconciliationDelta))}).`
                          : `Target differs by ${pricingResult.reconciliationDelta > 0 ? '+' : ''}${formatINR(pricingResult.reconciliationDelta)} due to ${
                              roundingMethod === 'ROUND_50' ? 'Nearest ₹50' :
                              roundingMethod === 'ROUND_100' ? 'Nearest ₹100' :
                              roundingMethod === 'ROUND_10' ? 'Nearest ₹10' :
                              roundingMethod === 'ROUND_5' ? 'Nearest ₹5' :
                              roundingMethod === 'EXACT_2_DECIMALS' ? 'Exact ₹0.01' : 'Nearest ₹1'
                            } rounding.`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        type="button"
                        onClick={handleResetManualPrices}
                        style={{
                          padding: '7px 14px',
                          fontSize: '12px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: '1px solid var(--color-border, #E5E7EB)',
                          backgroundColor: 'var(--color-surface, #FFFFFF)',
                          color: 'var(--color-text, #0F172A)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Reset Prices</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleApplyToQuotation}
                        style={{
                          padding: '8px 18px',
                          fontSize: '12.5px',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: 'none',
                          backgroundColor: 'var(--color-primary, #FF641F)',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 6px rgba(255, 100, 31, 0.35)'
                        }}
                      >
                        <Check size={14} />
                        <span>Apply to Quotation</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Right Column Sidebar (~30%) ── */}
              <div style={{ width: '310px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Card 1: Pricing Summary */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                    <Receipt size={16} color="var(--color-primary, #FF641F)" />
                    <span>Pricing Summary</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Total Dealer Cost</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.totalDealerCost)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Desired Profit</span>
                      <strong style={{ fontFamily: 'monospace', color: '#10B981' }}>{formatINR(pricingResult.desiredProfit)}</strong>
                    </div>

                    {Math.abs(pricingResult.actualProfit - pricingResult.desiredProfit) > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Actual Profit</span>
                        <strong style={{ fontFamily: 'monospace', color: pricingResult.actualProfit >= pricingResult.desiredProfit ? '#10B981' : '#F59E0B' }}>
                          {formatINR(pricingResult.actualProfit)}
                        </strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Target Selling Subtotal</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.targetSellingSubtotal)}</strong>
                    </div>

                    {Math.abs(pricingResult.actualSellingSubtotal - pricingResult.targetSellingSubtotal) > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Actual Selling Subtotal</span>
                        <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.actualSellingSubtotal)}</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>GST ({gstMode === 'INCLUSIVE' ? 'Included' : '18% Approx'})</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.actualGstTotal)}</strong>
                    </div>

                    {pricingResult.roundOff !== 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Round Off</span>
                        <strong style={{ fontFamily: 'monospace', color: pricingResult.roundOff < 0 ? '#EF4444' : '#10B981' }}>
                          {formatINR(pricingResult.roundOff)}
                        </strong>
                      </div>
                    )}

                    {Math.abs(pricingResult.reconciliationDelta) > 0.01 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '4px' }}>
                        <span style={{ color: '#B45309', fontWeight: 600 }}>Diff from Target</span>
                        <strong style={{ fontFamily: 'monospace', color: '#B45309' }}>
                          {pricingResult.reconciliationDelta > 0 ? '+' : ''}{formatINR(pricingResult.reconciliationDelta)}
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Highlighted Final Quotation Total Box */}
                  <div
                    style={{
                      backgroundColor: 'rgba(255, 100, 31, 0.08)',
                      border: '1px solid rgba(255, 100, 31, 0.25)',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary, #FF641F)', textTransform: 'uppercase' }}>
                        Final Quotation Total
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--color-primary, #FF641F)', fontFamily: 'monospace' }}>
                        {formatINR(pricingResult.actualFinalTotal)}
                      </div>
                    </div>
                  </div>

                  {/* Ratios */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', borderTop: '1px solid var(--color-border, #E5E7EB)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Markup on Cost</span>
                      <strong style={{ color: '#10B981' }}>{pricingResult.effectiveMarkupPct.toFixed(2)}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Gross Margin on Selling</span>
                      <strong style={{ color: '#10B981' }}>{pricingResult.effectiveGrossMarginPct.toFixed(2)}%</strong>
                    </div>
                  </div>
                </div>

                {/* Card 2: Quick Actions */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                    <Wand2 size={16} color="var(--color-primary, #FF641F)" />
                    <span>Quick Actions</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setAllocationMethod('PROPORTIONAL_COST');
                        handleResetManualPrices();
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: allocationMethod === 'PROPORTIONAL_COST' ? 700 : 500,
                        borderRadius: '6px',
                        border: allocationMethod === 'PROPORTIONAL_COST' ? '1.5px solid var(--color-primary, #FF641F)' : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor: allocationMethod === 'PROPORTIONAL_COST' ? 'rgba(255, 100, 31, 0.08)' : 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        lineHeight: 1.2
                      }}
                    >
                      Distribute by Cost
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAllocationMethod('PROPORTIONAL_QTY');
                        handleResetManualPrices();
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: allocationMethod === 'PROPORTIONAL_QTY' ? 700 : 500,
                        borderRadius: '6px',
                        border: allocationMethod === 'PROPORTIONAL_QTY' ? '1.5px solid var(--color-primary, #FF641F)' : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor: allocationMethod === 'PROPORTIONAL_QTY' ? 'rgba(255, 100, 31, 0.08)' : 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        lineHeight: 1.2
                      }}
                    >
                      Distribute by Qty
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAllocationMethod('EQUAL');
                        handleResetManualPrices();
                      }}
                      style={{
                        padding: '8px 4px',
                        fontSize: '11px',
                        fontWeight: allocationMethod === 'EQUAL' ? 700 : 500,
                        borderRadius: '6px',
                        border: allocationMethod === 'EQUAL' ? '1.5px solid var(--color-primary, #FF641F)' : '1px solid var(--color-border, #E5E7EB)',
                        backgroundColor: allocationMethod === 'EQUAL' ? 'rgba(255, 100, 31, 0.08)' : 'var(--color-surface, #FFFFFF)',
                        color: 'var(--color-text, #0F172A)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        lineHeight: 1.2
                      }}
                    >
                      Equal Allocation
                    </button>
                  </div>
                </div>

                {/* Card 3: Price Comparison (Total) */}
                <div
                  style={{
                    backgroundColor: 'var(--color-surface, #FFFFFF)',
                    border: '1px solid var(--color-border, #E5E7EB)',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px' }}>
                    <ShoppingCart size={16} color="var(--color-primary, #FF641F)" />
                    <span>Price Comparison (Total)</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Your Selling Total (Excl. GST)</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.onlineComparison.yourSellingTotal)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Online Reference Total</span>
                      <strong style={{ fontFamily: 'monospace' }}>{formatINR(pricingResult.onlineComparison.onlineReferenceTotal)}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Difference</span>
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          color: pricingResult.onlineComparison.difference <= 0 ? '#10B981' : '#EF4444'
                        }}
                      >
                        {pricingResult.onlineComparison.difference > 0 ? '+ ' : ''}
                        {formatINR(pricingResult.onlineComparison.difference)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                      <span style={{ color: 'var(--color-text-muted, #64748B)' }}>Status</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            pricingResult.onlineComparison.status === 'COMPETITIVE'
                              ? 'rgba(16, 185, 129, 0.12)'
                              : pricingResult.onlineComparison.status === 'MATCHING'
                              ? 'rgba(37, 99, 235, 0.12)'
                              : 'rgba(245, 158, 11, 0.12)',
                          color:
                            pricingResult.onlineComparison.status === 'COMPETITIVE'
                              ? '#10B981'
                              : pricingResult.onlineComparison.status === 'MATCHING'
                              ? '#2563EB'
                              : '#F59E0B'
                        }}
                      >
                        ● {pricingResult.onlineComparison.status === 'COMPETITIVE' ? 'Competitive' : pricingResult.onlineComparison.status}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>
                    Based on available online price references.
                  </p>

                  <button
                    type="button"
                    onClick={() => setActiveTab('ONLINE_CHECK')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid var(--color-border, #E5E7EB)',
                      backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                      color: 'var(--color-primary, #FF641F)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '4px'
                    }}
                  >
                    <span>View Item-wise Comparison</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ── Tab 2: Online Price Check Stage ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Overall Comparison Summary Banner */}
              <div
                style={{
                  backgroundColor: 'var(--color-surface, #FFFFFF)',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                    Online Market Price Verification
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--color-text-muted, #64748B)' }}>
                    Verify each quotation item against genuine Indian online retailers (Amazon, MDComputers, PrimeABGB, Nehru Place).
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Your Subtotal</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatINR(pricingResult.onlineComparison.yourSellingTotal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Market Online Total</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace' }}>
                      {formatINR(pricingResult.onlineComparison.onlineReferenceTotal)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Total Difference</div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        color: pricingResult.onlineComparison.difference <= 0 ? '#10B981' : '#EF4444'
                      }}
                    >
                      {pricingResult.onlineComparison.difference > 0 ? '+ ' : ''}
                      {formatINR(pricingResult.onlineComparison.difference)} ({pricingResult.onlineComparison.diffPct.toFixed(1)}%)
                    </div>
                  </div>

                  <span
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor:
                        pricingResult.onlineComparison.status === 'COMPETITIVE'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(37, 99, 235, 0.12)',
                      color:
                        pricingResult.onlineComparison.status === 'COMPETITIVE' ? '#10B981' : '#2563EB'
                    }}
                  >
                    ● {pricingResult.onlineComparison.status === 'COMPETITIVE' ? 'Competitive Advantage' : 'Market Standard'}
                  </span>
                </div>
              </div>

              {/* Item-wise Cards List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pricingResult.items.map((row, idx) => {
                  const ref = row.onlineReference;
                  return (
                    <div
                      key={row.id || idx}
                      style={{
                        backgroundColor: 'var(--color-surface, #FFFFFF)',
                        border: '1px solid var(--color-border, #E5E7EB)',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '20px',
                        flexWrap: 'wrap'
                      }}
                    >
                      {/* Left: Product identification */}
                      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted, #64748B)' }}>
                            #{idx + 1}
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 700 }}>{row.name}</span>
                          {ref?.matchQuality && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                backgroundColor:
                                  ref.matchQuality === 'EXACT_MATCH'
                                    ? 'rgba(16, 185, 129, 0.12)'
                                    : ref.matchQuality === 'SIMILAR_PRODUCT'
                                    ? 'rgba(37, 99, 235, 0.12)'
                                    : 'rgba(168, 85, 247, 0.12)',
                                color:
                                  ref.matchQuality === 'EXACT_MATCH'
                                    ? '#10B981'
                                    : ref.matchQuality === 'SIMILAR_PRODUCT'
                                    ? '#2563EB'
                                    : '#9333EA'
                              }}
                            >
                              {ref.matchQuality === 'EXACT_MATCH'
                                ? 'Exact Match'
                                : ref.matchQuality === 'SIMILAR_PRODUCT'
                                ? 'Similar Product'
                                : 'Manual Reference'}
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #64748B)', lineHeight: 1.4 }}>
                          {ref?.specs || row.subtext || 'Standard Component'}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>
                          <span>Retailer: <strong style={{ color: 'var(--color-text, #0F172A)' }}>{ref?.retailer || 'Unassigned'}</strong></span>
                          <span>Warranty: <strong style={{ color: 'var(--color-text, #0F172A)' }}>{ref?.warranty || '1 Year'}</strong></span>
                          <span>HSN/SAC: <strong style={{ fontFamily: 'monospace' }}>{row.hsnSac || '—'}</strong></span>
                        </div>
                      </div>

                      {/* Middle: Comparative Numbers */}
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Your Price</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace' }}>
                            {formatINR(row.finalPrice)}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Online Ref Price</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-muted, #64748B)' }}>
                            {ref?.referencePrice ? formatINR(ref.referencePrice) : '—'}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted, #64748B)' }}>Difference</div>
                          <div
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: row.onlineDifference !== undefined && row.onlineDifference <= 0 ? '#10B981' : '#EF4444'
                            }}
                          >
                            {row.onlineDifference !== undefined
                              ? `${row.onlineDifference > 0 ? '+ ' : ''}${formatINR(row.onlineDifference)}`
                              : '—'}
                          </div>
                        </div>

                        <div style={{ width: '85px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor:
                                row.onlineStatus === 'BELOW'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : row.onlineStatus === 'NEAR'
                                  ? 'rgba(37, 99, 235, 0.12)'
                                  : 'rgba(239, 68, 68, 0.12)',
                              color:
                                row.onlineStatus === 'BELOW'
                                  ? '#10B981'
                                  : row.onlineStatus === 'NEAR'
                                  ? '#2563EB'
                                  : '#EF4444'
                            }}
                          >
                            {row.onlineStatus === 'BELOW'
                              ? 'Competitive'
                              : row.onlineStatus === 'NEAR'
                              ? 'Near Market'
                              : 'Higher'}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {ref?.sourceUrl && (
                          <a
                            href={ref.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #E5E7EB)',
                              backgroundColor: 'var(--color-surface-secondary, #F8F7F4)',
                              color: 'var(--color-text, #0F172A)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'none'
                            }}
                            title="Open online listing in browser"
                          >
                            <span>Search</span>
                            <ExternalLink size={12} />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEditReference(idx)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid var(--color-border, #E5E7EB)',
                            backgroundColor: 'var(--color-surface, #FFFFFF)',
                            color: 'var(--color-text, #0F172A)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Enter or update manual reference price"
                        >
                          <Edit3 size={12} />
                          <span>Edit</span>
                        </button>

                        {ref?.referencePrice && ref.referencePrice > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAdoptOnlinePrice(idx)}
                            style={{
                              padding: '6px 10px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: 'var(--color-primary, #FF641F)',
                              color: '#FFFFFF',
                              cursor: 'pointer'
                            }}
                            title="Copy online reference price to quotation final selling price"
                          >
                            Adopt Price
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Bar */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--color-border, #E5E7EB)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted, #64748B)' }}>
            Internal calculation tool. Dealer costs & profits are strictly confidential and will never appear on customer documents.
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                if (isDirty) setShowConfirmClose(true);
                else onClose();
              }}
              style={{
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid var(--color-border, #E5E7EB)',
                backgroundColor: 'transparent',
                color: 'var(--color-text, #0F172A)',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApplyToQuotation}
              style={{
                padding: '8px 18px',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #FF641F)',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(255, 100, 31, 0.35)'
              }}
            >
              <Check size={14} />
              <span>Apply to Quotation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manual Reference Edit Sub-Modal */}
      {editingReferenceItemIdx !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }}
          onClick={() => setEditingReferenceItemIdx(null)}
        >
          <div
            style={{
              width: '420px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #E5E7EB)',
              padding: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                Edit Online Reference Price
              </h3>
              <button
                type="button"
                onClick={() => setEditingReferenceItemIdx(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted, #64748B)' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--color-text-muted, #64748B)' }}>
              Set genuine market reference price for <strong>{workingItems[editingReferenceItemIdx]?.name}</strong>.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Online Reference Price (₹)
              </label>
              <input
                type="number"
                value={refPriceInput}
                onChange={(e) => setRefPriceInput(e.target.value)}
                placeholder="e.g. 2450.00"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Retailer Name
              </label>
              <input
                type="text"
                value={refRetailerInput}
                onChange={(e) => setRefRetailerInput(e.target.value)}
                placeholder="e.g. Amazon India, MDComputers"
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Product Search / Listing URL
              </label>
              <input
                type="text"
                value={refUrlInput}
                onChange={(e) => setRefUrlInput(e.target.value)}
                placeholder="https://..."
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                Match Quality
              </label>
              <select
                value={refMatchQuality}
                onChange={(e) => setRefMatchQuality(e.target.value as MatchQuality)}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  boxSizing: 'border-box'
                }}
              >
                <option value="EXACT_MATCH">Exact Match</option>
                <option value="SIMILAR_PRODUCT">Similar Product</option>
                <option value="MANUAL_REFERENCE">Manual Reference Price</option>
                <option value="STALE_REFERENCE">Price Data Stale</option>
                <option value="LIVE_UNAVAILABLE">Live Verification Unavailable</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setEditingReferenceItemIdx(null)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReference}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--color-primary, #FF641F)',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                Save Reference
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Discard Modal */}
      {showConfirmClose && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100
          }}
          onClick={() => setShowConfirmClose(false)}
        >
          <div
            style={{
              width: '360px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text, #0F172A)',
              borderRadius: '8px',
              border: '1px solid var(--color-border, #E5E7EB)',
              padding: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
              <AlertTriangle size={20} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                Discard Pricing Changes?
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-text-muted, #64748B)' }}>
              You have unsaved pricing settings. Are you sure you want to close without applying prices to the quotation?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmClose(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--color-border, #E5E7EB)',
                  background: 'transparent',
                  cursor: 'pointer'
                }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmClose(false);
                  onClose();
                }}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  cursor: 'pointer'
                }}
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
