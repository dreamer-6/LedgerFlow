import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, Company } from '../api/client';
import {
  Printer,
  X,
  Download,
  FileText,
  Eye,
  Sliders,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Check,
  ChevronDown,
  Smartphone,
  Layout,
  AlignLeft
} from 'lucide-react';
import {
  normalizeInvoiceData,
  normalizeQuotationData,
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  ShipToDisplayMode
} from '../components/invoice/InvoiceAdapter';
import {
  InvoiceRenderer,
  InvoiceLayoutType
} from '../components/invoice/InvoiceRenderer';

export interface InvoicePrintModalProps {
  voucherId?: string | null;
  liveVoucherData?: {
    voucher: any;
    lines: any[];
  } | null;
  quotation?: any;
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat =
  | 'A4'
  | 'A4_LANDSCAPE'
  | 'A5_PORTRAIT'
  | 'A5_LANDSCAPE'
  | 'LETTER'
  | 'LETTER_LANDSCAPE'
  | 'THERMAL_80'
  | 'THERMAL_58';

/**
 * Accessible, compact iOS-style orange toggle switch matching the LedgerFlow UI mockup
 */
const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (val: boolean) => void;
  id?: string;
  label?: string;
}> = ({ checked, onChange, id, label }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    style={{
      width: '32px',
      height: '18px',
      borderRadius: '9px',
      backgroundColor: checked ? '#EA580C' : '#CBD5E1',
      position: 'relative',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      transition: 'background-color 0.15s ease',
      flexShrink: 0,
      outline: 'none'
    }}
  >
    <span
      style={{
        display: 'block',
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
        position: 'absolute',
        top: '2px',
        left: checked ? '16px' : '2px',
        transition: 'left 0.15s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
      }}
    />
  </button>
);

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  voucherId,
  liveVoucherData,
  quotation,
  company,
  onClose
}) => {
  const [data, setData] = useState<any>(liveVoucherData || null);
  const [loading, setLoading] = useState<boolean>(!liveVoucherData && !quotation && !!voucherId);

  // Layout, Paper & Orientation
  const [layout, setLayout] = useState<InvoiceLayoutType>('Standard');
  const [format, setFormat] = useState<PaperFormat>('A4');
  const [orientation, setOrientation] = useState<'PORTRAIT' | 'LANDSCAPE'>('PORTRAIT');
  const [paperMargin, setPaperMargin] = useState<'compact' | 'normal' | 'spacious'>('normal');

  // Zoom & Page Navigation
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [showZoomDropdown, setShowZoomDropdown] = useState<boolean>(false);

  // Canvas & Scroll container references
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const docContainerRef = useRef<HTMLDivElement>(null);

  // Visibility options
  const defaultVisibility: InvoiceVisibilityOptions = useMemo(() => ({
    showLogo: true,
    showCompanyDetails: true,
    showCustomerContact: true,
    showBillTo: true,
    showShipTo: true,
    shipToMode: 'SHOW',
    showHsn: true,
    showUnit: true,
    showTaxBreakdown: true,
    showAmtWords: true,
    showBankDetails: true,
    showTerms: true,
    showSignature: true,
    showSerial: true,
    showGridLines: false,
    showLedgerflowWordmark: false,
    warrantyDisplayFormat: 'Years',
    paperMargin: 'normal'
  }), []);

  const [visibility, setVisibility] = useState<InvoiceVisibilityOptions>(() => {
    let saved: any = null;
    try {
      if (company?.invoice_settings) {
        saved = JSON.parse(company.invoice_settings);
      }
    } catch {}

    const shipToModeVal = saved?.dispToggles?.shipToMode || (saved?.dispToggles?.showShipTo === false ? 'HIDE' : 'SHOW');
    return {
      showLogo: saved?.headerToggles?.showLogo ?? true,
      showCompanyDetails: saved?.headerToggles?.showAddress ?? true,
      showCustomerContact: true,
      showBillTo: true,
      showShipTo: shipToModeVal !== 'HIDE',
      shipToMode: shipToModeVal,
      showHsn: saved?.dispToggles?.showHsn ?? true,
      showUnit: saved?.dispToggles?.showUnit ?? true,
      showTaxBreakdown: saved?.dispToggles?.showTaxBreakup ?? true,
      showAmtWords: saved?.dispToggles?.showAmtWords ?? true,
      showBankDetails: saved?.dispToggles?.showBank ?? true,
      showTerms: saved?.dispToggles?.showTerms ?? true,
      showSignature: saved?.dispToggles?.showSignature ?? true,
      showSerial: saved?.dispToggles?.showSerial ?? true,
      showGridLines: saved?.dispToggles?.showGridLines ?? false,
      showLedgerflowWordmark: saved?.showLedgerflowWordmark ?? false,
      warrantyDisplayFormat: 'Years',
      paperMargin: saved?.paperMargin || 'normal'
    };
  });

  // Lock body / content scroll while preview is active, restore on unmount
  useEffect(() => {
    const contentEl = document.querySelector('.lf-shell-content');
    if (contentEl) {
      const prevScroll = contentEl.scrollTop;
      const prevOverflow = (contentEl as HTMLElement).style.overflow;
      (contentEl as HTMLElement).style.overflow = 'hidden';
      return () => {
        (contentEl as HTMLElement).style.overflow = prevOverflow;
        contentEl.scrollTop = prevScroll;
      };
    }
  }, []);

  // Keyboard shortcut listener (Escape to close, Ctrl+P to print)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, format, layout, visibility]);

  // Load voucher data if voucherId provided
  useEffect(() => {
    if (quotation) {
      setLoading(false);
      return;
    }
    if (liveVoucherData) {
      setData(liveVoucherData);
      setLoading(false);
      return;
    }
    if (voucherId) {
      setLoading(true);
      api.getVoucherById(voucherId)
        .then((res) => setData(res))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [voucherId, liveVoucherData, quotation]);

  // Handle format and orientation alignment
  // Settings Persistence Helper
  const persistSettings = (updates: any) => {
    try {
      let curSettings: any = {};
      if (company?.invoice_settings) {
        curSettings = JSON.parse(company.invoice_settings);
      }
      const updated = {
        ...curSettings,
        ...updates,
        dispToggles: {
          ...curSettings.dispToggles,
          ...(updates.dispToggles || {})
        },
        headerToggles: {
          ...curSettings.headerToggles,
          ...(updates.headerToggles || {})
        }
      };
      api.updateCurrentCompany({ invoice_settings: JSON.stringify(updated) }).catch(() => {});
    } catch {}
  };

  // Handle format and orientation alignment
  const handleTemplateChange = (newLayout: InvoiceLayoutType) => {
    setLayout(newLayout);
    if (newLayout === 'Thermal') {
      if (format !== 'THERMAL_58') {
        setFormat('THERMAL_80');
      }
      setOrientation('PORTRAIT');
    } else if (format === 'THERMAL_80' || format === 'THERMAL_58' || (format as string) === 'THERMAL') {
      setFormat('A4');
      setOrientation('PORTRAIT');
    }
  };

  const handlePaperSizeChange = (newFormat: PaperFormat) => {
    setFormat(newFormat);
    if (newFormat === 'A4_LANDSCAPE' || newFormat === 'A5_LANDSCAPE' || newFormat === 'LETTER_LANDSCAPE') {
      setOrientation('LANDSCAPE');
      if (layout === 'Thermal') setLayout('Standard');
    } else if (newFormat === 'THERMAL_80' || newFormat === 'THERMAL_58') {
      setLayout('Thermal');
      setOrientation('PORTRAIT');
    } else {
      setOrientation('PORTRAIT');
      if (layout === 'Thermal') setLayout('Standard');
    }
    persistSettings({ paperFormat: newFormat });
  };

  const handleOrientationToggle = (newOrientation: 'PORTRAIT' | 'LANDSCAPE') => {
    setOrientation(newOrientation);
    let nextFormat = format;
    if (newOrientation === 'LANDSCAPE') {
      if (format.startsWith('A5')) nextFormat = 'A5_LANDSCAPE';
      else if (format.startsWith('LETTER')) nextFormat = 'LETTER_LANDSCAPE';
      else nextFormat = 'A4_LANDSCAPE';
      if (layout === 'Thermal') setLayout('Standard');
    } else {
      if (format.startsWith('A5')) nextFormat = 'A5_PORTRAIT';
      else if (format.startsWith('LETTER')) nextFormat = 'LETTER';
      else if (!format.startsWith('THERMAL')) nextFormat = 'A4';
    }
    setFormat(nextFormat);
    persistSettings({ orientation: newOrientation, paperFormat: nextFormat });
  };

  const handlePaperMarginChange = (newMargin: 'compact' | 'normal' | 'spacious') => {
    setPaperMargin(newMargin);
    persistSettings({ paperMargin: newMargin });
  };

  const handleShipToModeChange = (mode: ShipToDisplayMode) => {
    setVisibility((prev) => {
      const next = {
        ...prev,
        shipToMode: mode,
        showShipTo: mode !== 'HIDE'
      };
      persistSettings({
        dispToggles: {
          shipToMode: mode,
          showShipTo: mode !== 'HIDE'
        }
      });
      return next;
    });
  };

  const handleShipToToggle = (checked: boolean) => {
    const nextMode: ShipToDisplayMode = checked ? 'SHOW' : 'HIDE';
    handleShipToModeChange(nextMode);
  };

  const toggleOption = (key: keyof InvoiceVisibilityOptions) => {
    setVisibility((prev) => {
      const updatedVal = !prev[key];
      const next = { ...prev, [key]: updatedVal };
      persistSettings({
        showLedgerflowWordmark: next.showLedgerflowWordmark,
        dispToggles: {
          showHsn: next.showHsn,
          showUnit: next.showUnit,
          showTaxBreakup: next.showTaxBreakdown,
          showAmtWords: next.showAmtWords,
          showBank: next.showBankDetails,
          showTerms: next.showTerms,
          showSignature: next.showSignature,
          showSerial: next.showSerial,
          showGridLines: next.showGridLines
        },
        headerToggles: {
          showLogo: next.showLogo,
          showAddress: next.showCompanyDetails
        }
      });
      return next;
    });
  };

  const resetToDefault = () => {
    setVisibility(defaultVisibility);
    setLayout('Standard');
    setFormat('A4');
    setOrientation('PORTRAIT');
    setPaperMargin('normal');
    setZoomMode('fit');
  };

  // Normalize document data
  const normalized: NormalizedInvoiceData | null = useMemo(() => {
    if (quotation) {
      return normalizeQuotationData(quotation, company);
    }
    if (data) {
      return normalizeInvoiceData(data, company);
    }
    return null;
  }, [quotation, data, company]);

  // Page tracking via DOM query
  useEffect(() => {
    const checkPages = () => {
      const sheets = document.querySelectorAll('.a4-page-sheet');
      if (sheets && sheets.length > 0) {
        setTotalPages(sheets.length);
      } else {
        setTotalPages(1);
      }
    };
    const t = setTimeout(checkPages, 100);
    return () => clearTimeout(t);
  }, [normalized, layout, format, orientation, visibility, paperMargin]);

  // Track scroll position to update current page indicator
  const handleCanvasScroll = () => {
    if (!canvasScrollRef.current) return;
    const sheets = canvasScrollRef.current.querySelectorAll('.a4-page-sheet');
    if (sheets.length <= 1) {
      setCurrentPage(1);
      return;
    }
    const containerTop = canvasScrollRef.current.getBoundingClientRect().top;
    let activeIdx = 0;
    sheets.forEach((sheet, idx) => {
      const rect = sheet.getBoundingClientRect();
      if (rect.top <= containerTop + 150) {
        activeIdx = idx;
      }
    });
    setCurrentPage(activeIdx + 1);
  };

  const scrollToPage = (pageIdx: number) => {
    const clamped = Math.max(1, Math.min(pageIdx, totalPages));
    setCurrentPage(clamped);
    const target = document.getElementById(`page-sheet-${clamped - 1}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Calculate zoom scale factor responsive to paper size & orientation
  const zoomScale = useMemo(() => {
    if (typeof zoomMode === 'number') {
      return zoomMode / 100;
    }
    // 'fit' mode: compute available height vs sheet height
    if (!canvasScrollRef.current) return 0.72;
    const containerHeight = canvasScrollRef.current.clientHeight || 750;
    let targetHeight = 1140;
    if (format === 'A5_LANDSCAPE') targetHeight = 600;
    else if (format === 'A5_PORTRAIT') targetHeight = 860;
    else if (format === 'A4_LANDSCAPE' || format === 'LETTER_LANDSCAPE' || orientation === 'LANDSCAPE') targetHeight = 820;
    else if (format === 'THERMAL_80' || format === 'THERMAL_58') targetHeight = 640;
    const fitFactor = (containerHeight - 64) / targetHeight;
    return Math.max(0.45, Math.min(1.0, Number(fitFactor.toFixed(2))));
  }, [zoomMode, orientation, format]);

  // Fast isolated iframe print engine
  const handlePrint = () => {
    const printTarget = document.getElementById('printable-tax-invoice');
    if (!printTarget) return;

    const isThermal = format === 'THERMAL_80' || format === 'THERMAL_58' || (format as string) === 'THERMAL' || layout === 'Thermal';
    const is58mm = format === 'THERMAL_58';

    let pageSizeCss = 'A4 portrait';
    if (format === 'A4_LANDSCAPE') pageSizeCss = 'A4 landscape';
    else if (format === 'A5_PORTRAIT') pageSizeCss = 'A5 portrait';
    else if (format === 'A5_LANDSCAPE') pageSizeCss = 'A5 landscape';
    else if (format === 'LETTER') pageSizeCss = 'letter portrait';
    else if (format === 'LETTER_LANDSCAPE') pageSizeCss = 'letter landscape';
    else if (isThermal) pageSizeCss = is58mm ? '58mm auto' : '80mm auto';

    const pageMarginCss = isThermal ? '2mm' : paperMargin === 'compact' ? '5mm' : paperMargin === 'spacious' ? '12mm' : '8mm';

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${normalized?.voucherType || 'Document'} — ${normalized?.voucherNumber || ''}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @page { size: ${pageSizeCss}; margin: ${pageMarginCss}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'JetBrains Mono','Courier New',monospace" : "'Inter',system-ui,sans-serif"};
      font-size: ${isThermal ? (is58mm ? '10px' : '11px') : '12px'};
      color: #0F172A;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #printable-tax-invoice {
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      border-radius: 0 !important;
    }
  </style>
</head>
<body>
  ${printTarget.outerHTML}
</body>
</html>`);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }, 250);
  };

  const handleDownloadPdf = () => {
    // Triggers browser print dialog where user can save as PDF with exact vector styles
    handlePrint();
  };

  if (loading || !normalized) {
    return (
      <div
        className="lf-print-preview-loading"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          backdropFilter: 'blur(3px)'
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface, #FFFFFF)',
            color: 'var(--color-text, #0F172A)',
            padding: '24px 32px',
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <div
            style={{
              width: '18px',
              height: '18px',
              border: '2px solid #EA580C',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}
          />
          <span>Loading Document Preview...</span>
        </div>
      </div>
    );
  }

  // Determine status badge colors
  const statusUpper = (normalized.status || 'ORIGINAL').toUpperCase();
  const isCancelled = statusUpper === 'CANCELLED';
  const isDraft = statusUpper === 'DRAFT';
  const badgeBg = isCancelled ? '#FEE2E2' : isDraft ? '#FEF3C7' : '#DCFCE7';
  const badgeColor = isCancelled ? '#991B1B' : isDraft ? '#92400E' : '#166534';
  const badgeText = isCancelled ? 'Cancelled' : isDraft ? 'Draft' : 'Original';

  return (
    <div
      className="lf-print-preview-workspace"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: 'var(--color-background, #F8F7F4)',
        overflow: 'hidden'
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          ZONE B: COMPACT SETTINGS PANEL (LEFT SIDEBAR, 320px)
         ───────────────────────────────────────────────────────────── */}
      <aside
        className="lf-print-settings-panel"
        style={{
          width: '320px',
          flexShrink: 0,
          height: '100%',
          overflowY: 'auto',
          backgroundColor: 'var(--surface, #FFFFFF)',
          borderRight: '1px solid var(--border-subtle, #E2E8F0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '18px 18px 24px 18px',
          boxSizing: 'border-box'
        }}
      >
        {/* Panel Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              backgroundColor: '#FFF7ED',
              border: '1px solid #FFEDD5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Printer size={20} color="#EA580C" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--color-text, #0F172A)', lineHeight: 1.2 }}>
              Print Preview
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)', marginTop: '2px', lineHeight: 1.35 }}>
              Review and print the document. Adjust settings if needed.
            </div>
          </div>
        </div>

        {/* ─── SECTION 1: DOCUMENT ─── */}
        <div
          style={{
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: '8px',
            padding: '12px 14px',
            backgroundColor: 'var(--surface, #FFFFFF)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={14} color="#EA580C" />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Document
            </span>
          </div>

          {/* Voucher Info Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <span style={{ color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>Voucher</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                {normalized.voucherNumber}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '12px',
                  backgroundColor: badgeBg,
                  color: badgeColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}
              >
                {badgeText}
              </span>
            </div>
          </div>

          {/* Template Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
              Template
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={layout}
                onChange={(e) => handleTemplateChange(e.target.value as InvoiceLayoutType)}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 28px 0 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text, #0F172A)',
                  backgroundColor: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '6px',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Standard">Standard A4</option>
                <option value="Simple">Simple</option>
                <option value="Thermal">Thermal POS</option>
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  pointerEvents: 'none',
                  color: '#94A3B8'
                }}
              />
            </div>
          </div>

          {/* Paper Size Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
              Paper Size
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={format}
                onChange={(e) => handlePaperSizeChange(e.target.value as PaperFormat)}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 28px 0 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text, #0F172A)',
                  backgroundColor: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '6px',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="A4">A4 Portrait (210 × 297 mm)</option>
                <option value="A4_LANDSCAPE">A4 Landscape (297 × 210 mm)</option>
                <option value="A5_PORTRAIT">A5 Portrait (148 × 210 mm)</option>
                <option value="A5_LANDSCAPE">A5 Landscape (210 × 148 mm)</option>
                <option value="LETTER">Letter Portrait (8.5 × 11 in)</option>
                <option value="LETTER_LANDSCAPE">Letter Landscape (11 × 8.5 in)</option>
                <option value="THERMAL_80">Thermal Receipt (80 mm)</option>
                <option value="THERMAL_58">Thermal Receipt (58 mm)</option>
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  pointerEvents: 'none',
                  color: '#94A3B8'
                }}
              />
            </div>
          </div>

          {/* Orientation Toggle Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
              Orientation
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleOrientationToggle('PORTRAIT')}
                style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: orientation === 'PORTRAIT' ? 700 : 500,
                  color: orientation === 'PORTRAIT' ? '#EA580C' : 'var(--color-text-secondary, #64748B)',
                  backgroundColor: orientation === 'PORTRAIT' ? '#FFF7ED' : 'var(--surface, #FFFFFF)',
                  border: orientation === 'PORTRAIT' ? '1px solid #EA580C' : '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Layout size={13} />
                <span>Portrait</span>
              </button>
              <button
                type="button"
                onClick={() => handleOrientationToggle('LANDSCAPE')}
                style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: orientation === 'LANDSCAPE' ? 700 : 500,
                  color: orientation === 'LANDSCAPE' ? '#EA580C' : 'var(--color-text-secondary, #64748B)',
                  backgroundColor: orientation === 'LANDSCAPE' ? '#FFF7ED' : 'var(--surface, #FFFFFF)',
                  border: orientation === 'LANDSCAPE' ? '1px solid #EA580C' : '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <AlignLeft size={13} style={{ transform: 'rotate(90deg)' }} />
                <span>Landscape</span>
              </button>
            </div>
          </div>

          {/* Page Margins Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)', fontWeight: 500 }}>
              Page Margins
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={paperMargin}
                onChange={(e) => handlePaperMarginChange(e.target.value as any)}
                style={{
                  width: '100%',
                  height: '32px',
                  padding: '0 28px 0 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text, #0F172A)',
                  backgroundColor: 'var(--surface, #FFFFFF)',
                  border: '1px solid var(--border-subtle, #E2E8F0)',
                  borderRadius: '6px',
                  appearance: 'none',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="compact">Compact (5 mm)</option>
                <option value="normal">Normal (8 mm)</option>
                <option value="spacious">Spacious (12 mm)</option>
              </select>
              <ChevronDown
                size={14}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '9px',
                  pointerEvents: 'none',
                  color: '#94A3B8'
                }}
              />
            </div>
          </div>
        </div>

        {/* ─── SECTION 2: DISPLAY OPTIONS ─── */}
        <div
          style={{
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: '8px',
            padding: '12px 14px',
            backgroundColor: 'var(--surface, #FFFFFF)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={14} color="#EA580C" />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Display Options
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Standard display toggles (Logo, Address, Bill To) */}
            {[
              { key: 'showLogo', label: 'Company Logo' },
              { key: 'showCompanyDetails', label: 'Company Address' },
              { key: 'showBillTo', label: 'Bill To Address' }
            ].map(({ key, label }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 0'
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--color-text, #334155)', fontWeight: 500 }}>
                  {label}
                </span>
                <ToggleSwitch
                  checked={Boolean(visibility[key as keyof InvoiceVisibilityOptions])}
                  onChange={() => toggleOption(key as keyof InvoiceVisibilityOptions)}
                  label={label}
                />
              </div>
            ))}

            {/* Configurable Ship To Controls */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                padding: '4px 0',
                borderTop: '1px dashed var(--border-subtle, #F1F5F9)',
                borderBottom: '1px dashed var(--border-subtle, #F1F5F9)',
                paddingTop: '6px',
                paddingBottom: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-text, #334155)', fontWeight: 500 }}>
                  Ship To Address
                </span>
                <ToggleSwitch
                  checked={visibility.shipToMode !== 'HIDE' && visibility.showShipTo !== false}
                  onChange={(val) => handleShipToToggle(val)}
                  label="Ship To Address Toggle"
                />
              </div>
              {(visibility.shipToMode !== 'HIDE' && visibility.showShipTo !== false) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '2px' }}>
                  <button
                    type="button"
                    onClick={() => handleShipToModeChange('SHOW')}
                    style={{
                      height: '26px',
                      fontSize: '10.5px',
                      fontWeight: (visibility.shipToMode || 'SHOW') === 'SHOW' ? 700 : 500,
                      color: (visibility.shipToMode || 'SHOW') === 'SHOW' ? '#EA580C' : 'var(--color-text-secondary, #64748B)',
                      backgroundColor: (visibility.shipToMode || 'SHOW') === 'SHOW' ? '#FFF7ED' : 'var(--surface, #FFFFFF)',
                      border: (visibility.shipToMode || 'SHOW') === 'SHOW' ? '1px solid #EA580C' : '1px solid var(--border-subtle, #CBD5E1)',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Separate Address
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShipToModeChange('SAME_AS_BILLING')}
                    style={{
                      height: '26px',
                      fontSize: '10.5px',
                      fontWeight: visibility.shipToMode === 'SAME_AS_BILLING' ? 700 : 500,
                      color: visibility.shipToMode === 'SAME_AS_BILLING' ? '#EA580C' : 'var(--color-text-secondary, #64748B)',
                      backgroundColor: visibility.shipToMode === 'SAME_AS_BILLING' ? '#FFF7ED' : 'var(--surface, #FFFFFF)',
                      border: visibility.shipToMode === 'SAME_AS_BILLING' ? '1px solid #EA580C' : '1px solid var(--border-subtle, #CBD5E1)',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Same as Billing
                  </button>
                </div>
              )}
            </div>

            {/* Remaining toggles (HSN, Taxes, Bank, Terms, Signature) */}
            {[
              { key: 'showHsn', label: 'Item HSN/SAC' },
              { key: 'showTaxBreakdown', label: 'Tax Breakdown' },
              { key: 'showBankDetails', label: 'Bank Details' },
              { key: 'showTerms', label: 'Terms & Conditions' },
              { key: 'showSignature', label: 'Signature' }
            ].map(({ key, label }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 0'
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--color-text, #334155)', fontWeight: 500 }}>
                  {label}
                </span>
                <ToggleSwitch
                  checked={Boolean(visibility[key as keyof InvoiceVisibilityOptions])}
                  onChange={() => toggleOption(key as keyof InvoiceVisibilityOptions)}
                  label={label}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 3: ADDITIONAL OPTIONS ─── */}
        <div
          style={{
            border: '1px solid var(--border-subtle, #E2E8F0)',
            borderRadius: '8px',
            padding: '12px 14px',
            backgroundColor: 'var(--surface, #FFFFFF)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={14} color="#EA580C" />
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
              Additional Options
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { key: 'showSerial', label: 'Show Serial Number / Details' },
              { key: 'showGridLines', label: 'Show Grid Lines' },
              { key: 'showAmtWords', label: 'Show Amount in Words' }
            ].map(({ key, label }) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '2px 0'
                }}
              >
                <span style={{ fontSize: '12px', color: 'var(--color-text, #334155)', fontWeight: 500 }}>
                  {label}
                </span>
                <ToggleSwitch
                  checked={Boolean(visibility[key as keyof InvoiceVisibilityOptions])}
                  onChange={() => toggleOption(key as keyof InvoiceVisibilityOptions)}
                  label={label}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ─── SECTION 4: ACTIONS ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', paddingTop: '8px' }}>
          <button
            type="button"
            onClick={resetToDefault}
            style={{
              width: '100%',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text-secondary, #475569)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border-subtle, #E2E8F0)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={13} />
            <span>Reset to Default</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              width: '100%',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#FFFFFF',
              backgroundColor: '#EA580C',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.35)',
              transition: 'background-color 0.15s ease'
            }}
          >
            <Printer size={15} />
            <span>Print Invoice</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            style={{
              width: '100%',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--color-text, #0F172A)',
              backgroundColor: 'var(--surface, #FFFFFF)',
              border: '1px solid var(--border-subtle, #CBD5E1)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} />
            <span>Download PDF</span>
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          ZONE C: DOCUMENT PREVIEW WORKSPACE (DARK CHARCOAL CANVAS)
         ───────────────────────────────────────────────────────────── */}
      <main
        className="lf-print-preview-canvas"
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#1F242D',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Top Control Toolbar */}
        <header
          style={{
            height: '48px',
            backgroundColor: '#181C24',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            zIndex: 10
          }}
        >
          {/* Left / Center: Navigation & Zoom Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Page Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button
                type="button"
                onClick={() => scrollToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                title="Previous Page"
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  color: currentPage <= 1 ? '#64748B' : '#E2E8F0',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={15} />
              </button>
              <div
                style={{
                  padding: '0 8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#F8FAFC',
                  minWidth: '48px',
                  textAlign: 'center'
                }}
              >
                {currentPage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => scrollToPage(currentPage + 1)}
                disabled={currentPage >= totalPages}
                title="Next Page"
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  color: currentPage >= totalPages ? '#64748B' : '#E2E8F0',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={15} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

            {/* Zoom dropdown & controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowZoomDropdown(!showZoomDropdown)}
                style={{
                  height: '28px',
                  padding: '0 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#F1F5F9',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                <span>{zoomMode === 'fit' ? 'Fit to Page' : `${zoomMode}%`}</span>
                <ChevronDown size={12} color="#94A3B8" />
              </button>

              {/* Zoom Dropdown Menu */}
              {showZoomDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '32px',
                    left: 0,
                    width: '120px',
                    backgroundColor: '#1E242B',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    padding: '4px 0',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                    zIndex: 20
                  }}
                >
                  {[
                    { label: 'Fit to Page', val: 'fit' },
                    { label: '50%', val: 50 },
                    { label: '75%', val: 75 },
                    { label: '100%', val: 100 },
                    { label: '125%', val: 125 },
                    { label: '150%', val: 150 }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setZoomMode(opt.val as any);
                        setShowZoomDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        textAlign: 'left',
                        fontSize: '11.5px',
                        fontWeight: zoomMode === opt.val ? 700 : 500,
                        color: zoomMode === opt.val ? '#EA580C' : '#E2E8F0',
                        backgroundColor: zoomMode === opt.val ? 'rgba(234, 88, 12, 0.12)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>{opt.label}</span>
                      {zoomMode === opt.val && <Check size={12} color="#EA580C" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Zoom Out Button */}
              <button
                type="button"
                onClick={() => {
                  const cur = typeof zoomMode === 'number' ? zoomMode : Math.round(zoomScale * 100);
                  setZoomMode(Math.max(40, cur - 15));
                }}
                title="Zoom Out"
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  color: '#E2E8F0',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                -
              </button>

              {/* Zoom In Button */}
              <button
                type="button"
                onClick={() => {
                  const cur = typeof zoomMode === 'number' ? zoomMode : Math.round(zoomScale * 100);
                  setZoomMode(Math.min(200, cur + 15));
                }}
                title="Zoom In"
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '4px',
                  color: '#E2E8F0',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setZoomMode('fit')}
              title="Fit to Page"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#CBD5E1',
                cursor: 'pointer'
              }}
            >
              <Maximize2 size={14} />
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              title="Download PDF"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#CBD5E1',
                cursor: 'pointer'
              }}
            >
              <Download size={14} />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              title="Print Document"
              style={{
                height: '32px',
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#EA580C',
                border: 'none',
                borderRadius: '6px',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              title="Close Preview (Esc)"
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '6px',
                color: '#94A3B8',
                cursor: 'pointer',
                marginLeft: '4px'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable Document Canvas */}
        <div
          ref={canvasScrollRef}
          onScroll={handleCanvasScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            padding: '28px 24px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start'
          }}
        >
          {/* Zoom Wrapper */}
          <div
            ref={docContainerRef}
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.12s ease',
              marginBottom: '40px'
            }}
          >
            <InvoiceRenderer
              data={normalized}
              layout={layout}
              options={{
                ...visibility,
                pageSize: format,
                orientation
              }}
              id="printable-tax-invoice"
            />
          </div>
        </div>
      </main>
    </div>
  );
};
