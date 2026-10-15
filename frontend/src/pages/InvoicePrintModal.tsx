import React, { useEffect, useState } from 'react';
import { api, Company } from '../api/client';
import {
  Printer,
  X,
  Download,
  FileText,
  Receipt,
  Trash2,
  AlertCircle,
  Sliders,
  Check,
  ChevronDown
} from 'lucide-react';
import {
  normalizeInvoiceData,
  NormalizedInvoiceData,
  InvoiceVisibilityOptions
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
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat = 'A4' | 'A4_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  voucherId,
  liveVoucherData,
  company,
  onClose
}) => {
  const [data, setData] = useState<any>(liveVoucherData || null);
  const [loading, setLoading] = useState<boolean>(!liveVoucherData && !!voucherId);

  // Layout & Paper settings
  const [layout, setLayout] = useState<InvoiceLayoutType>('Standard');
  const [format, setFormat] = useState<PaperFormat>('A4');
  const [showPreferences, setShowPreferences] = useState<boolean>(false);

  // Visibility options initialized from company.invoice_settings
  const [visibility, setVisibility] = useState<InvoiceVisibilityOptions>(() => {
    let saved: any = null;
    try {
      if (company?.invoice_settings) {
        saved = JSON.parse(company.invoice_settings);
      }
    } catch {}
    return {
      showLogo: saved?.headerToggles?.showLogo ?? true,
      showCompanyDetails: saved?.headerToggles?.showAddress ?? true,
      showCustomerContact: true,
      showHsn: saved?.dispToggles?.showHsn ?? true,
      showUnit: saved?.dispToggles?.showUnit ?? true,
      showTaxBreakdown: saved?.dispToggles?.showTaxBreakup ?? true,
      showAmtWords: saved?.dispToggles?.showAmtWords ?? true,
      showBankDetails: saved?.dispToggles?.showBank ?? true,
      showTerms: saved?.dispToggles?.showTerms ?? true,
      showSignature: saved?.dispToggles?.showSignature ?? true,
      showLedgerflowWordmark: saved?.showLedgerflowWordmark ?? false
    };
  });

  // Cancel / Delete Voucher Modal
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>('Cancelled by user');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load voucher data
  useEffect(() => {
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
  }, [voucherId, liveVoucherData]);

  // Automatically adjust paper format when layout switches
  const handleLayoutChange = (newLayout: InvoiceLayoutType) => {
    setLayout(newLayout);
    if (newLayout === 'Thermal') {
      setFormat('THERMAL');
    } else if (format === 'THERMAL') {
      setFormat('A4');
    }
  };

  const handleCancelOrDeleteVoucher = async () => {
    if (!data?.voucher) return;
    const v = data.voucher;
    try {
      setIsCancelling(true);
      setCancelError(null);
      if (v.status === 'DRAFT') {
        await api.deleteVoucher(v.voucher_id);
        setToastMessage(`Draft voucher ${v.voucher_number || ''} deleted successfully.`);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      } else {
        await api.cancelVoucher(v.voucher_id, cancelReason.trim() || 'Cancelled by user');
        setToastMessage(`Voucher ${v.voucher_number || ''} cancelled successfully.`);
        setData((prev: any) => prev ? { ...prev, voucher: { ...prev.voucher, status: 'CANCELLED' } } : prev);
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1000);
      }
      setShowCancelModal(false);
    } catch (err: any) {
      console.error('Failed to cancel/delete voucher:', err);
      setCancelError(err.message || 'Operation failed');
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleVisibility = (key: keyof InvoiceVisibilityOptions) => {
    setVisibility((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        let curSettings: any = {};
        if (company?.invoice_settings) {
          curSettings = JSON.parse(company.invoice_settings);
        }
        const updated = {
          ...curSettings,
          showLedgerflowWordmark: next.showLedgerflowWordmark,
          dispToggles: {
            ...curSettings.dispToggles,
            showHsn: next.showHsn,
            showUnit: next.showUnit,
            showTaxBreakup: next.showTaxBreakdown,
            showAmtWords: next.showAmtWords,
            showBank: next.showBankDetails,
            showTerms: next.showTerms,
            showSignature: next.showSignature
          },
          headerToggles: {
            ...curSettings.headerToggles,
            showLogo: next.showLogo,
            showAddress: next.showCompanyDetails
          }
        };
        api.updateCurrentCompany({ invoice_settings: JSON.stringify(updated) }).catch(() => {});
      } catch {}
      return next;
    });
  };

  if (loading || !data) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 5, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          color: '#FFFFFF',
          fontFamily: 'var(--font-sans, system-ui)'
        }}
      >
        <div style={{ background: 'var(--surface, #1E293B)', color: 'var(--text-primary, #FFFFFF)', padding: '24px 32px', borderRadius: '8px', border: '1px solid var(--border, #334155)' }}>
          Rendering Invoice Print Preview...
        </div>
      </div>
    );
  }

  const normalized: NormalizedInvoiceData = normalizeInvoiceData(data, company);

  const getContainerWidth = () => {
    if (layout === 'Thermal' || format === 'THERMAL') return '360px';
    if (format === 'A4_LANDSCAPE') return '920px';
    if (format === 'A5_PORTRAIT') return '580px';
    return '820px';
  };

  const handlePrint = () => {
    const printTarget = document.getElementById('printable-tax-invoice');
    if (!printTarget) return;

    const pageSize =
      format === 'A4' ? 'A4 portrait'
      : format === 'A4_LANDSCAPE' ? 'A4 landscape'
      : format === 'A5_PORTRAIT' ? 'A5 portrait'
      : '80mm auto';
    const pageMargin = format === 'THERMAL' ? '2mm' : '8mm';
    const isThermal = format === 'THERMAL' || layout === 'Thermal';

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
  <title>Invoice — ${normalized.voucherNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'JetBrains Mono','Courier New',monospace" : "'Inter',system-ui,sans-serif"};
      font-size: ${isThermal ? '11px' : '12px'};
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
    .a4-page-sheet {
      page-break-after: always;
      break-after: page;
      min-height: 297mm;
      box-sizing: border-box;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      padding: ${isThermal ? '4px' : '14mm 16mm'} !important;
      box-shadow: none !important;
      border: none !important;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .a4-page-sheet:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 6px 8px; }
  </style>
</head>
<body>
${printTarget.outerHTML}
</body>
</html>`);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1500);
      }
    }, 400);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 5, 5, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 110,
        padding: '16px 12px'
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            backgroundColor: '#10B981',
            color: '#FFFFFF',
            padding: '10px 20px',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 120,
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Viewport-Constrained Modal Container */}
      <div
        style={{
          width: '100%',
          maxWidth: getContainerWidth(),
          maxHeight: 'calc(100vh - 32px)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          backgroundColor: '#0F172A'
        }}
      >
        {/* Top Action Toolbar */}
        <div
          className="no-print"
          style={{
            flexShrink: 0,
            width: '100%',
            height: '52px',
            minHeight: '52px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#1E293B',
            padding: '0 16px',
            borderBottom: '1px solid #334155',
            color: '#F8FAFC',
            boxSizing: 'border-box'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#0F172A',
                border: '1px solid #334155',
                borderRadius: '6px',
                padding: '4px 10px',
                height: '32px',
                boxSizing: 'border-box'
              }}
            >
              <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 600 }}>Voucher</span>
              <strong style={{ color: '#F97316', fontFamily: 'monospace', fontSize: '12.5px' }}>
                {normalized.voucherNumber}
              </strong>
            </div>

            {/* Layout Selector */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                background: '#0F172A',
                padding: '3px',
                borderRadius: '6px',
                border: '1px solid #334155',
                height: '32px',
                boxSizing: 'border-box'
              }}
            >
              {(['Standard', 'Simple', 'Thermal'] as InvoiceLayoutType[]).map((tmpl) => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => handleLayoutChange(tmpl)}
                  style={{
                    height: '24px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: layout === tmpl ? 700 : 500,
                    borderRadius: '4px',
                    background: layout === tmpl ? '#EA580C' : 'transparent',
                    color: layout === tmpl ? '#FFFFFF' : '#94A3B8',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tmpl === 'Standard' ? 'Standard A4' : tmpl === 'Simple' ? 'Simple' : 'Thermal POS'}
                </button>
              ))}
            </div>

            {/* Paper Format (if not thermal) */}
            {layout !== 'Thermal' && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: '#0F172A',
                  padding: '3px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  height: '32px',
                  boxSizing: 'border-box'
                }}
              >
                {[
                  { id: 'A4', label: 'A4 Portrait' },
                  { id: 'A4_LANDSCAPE', label: 'A4 Landscape' },
                  { id: 'A5_PORTRAIT', label: 'A5' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setFormat(fmt.id as PaperFormat)}
                    style={{
                      height: '24px',
                      padding: '0 8px',
                      fontSize: '10.5px',
                      fontWeight: format === fmt.id ? 700 : 500,
                      borderRadius: '4px',
                      background: format === fmt.id ? '#334155' : 'transparent',
                      color: format === fmt.id ? '#FFFFFF' : '#94A3B8',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Preferences Toggle Button */}
            <button
              type="button"
              onClick={() => setShowPreferences((p) => !p)}
              style={{
                height: '32px',
                padding: '0 10px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '5px',
                background: showPreferences ? '#334155' : '#0F172A',
                color: showPreferences ? '#F97316' : '#94A3B8',
                border: '1px solid #334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Sliders size={13} />
              <span>Options</span>
            </button>
          </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {normalized.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              style={{
                height: '32px',
                padding: '0 10px',
                color: '#EF4444',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
              title={normalized.status === 'DRAFT' ? 'Delete draft voucher' : 'Cancel voucher'}
            >
              <Trash2 size={13} />
              <span>{normalized.status === 'DRAFT' ? 'Delete Draft' : 'Cancel'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handlePrint}
            style={{
              height: '32px',
              padding: '0 14px',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Printer size={14} />
            <span>Print Invoice</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              height: '32px',
              padding: '0 12px',
              backgroundColor: '#0F172A',
              color: '#F8FAFC',
              border: '1px solid #334155',
              borderRadius: '5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Download PDF via browser print dialog"
          >
            <Download size={13} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              height: '32px',
              padding: '0 10px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: '5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Close Preview (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Preferences Drawer */}
      {showPreferences && (
        <div
          className="no-print"
          style={{
            width: getContainerWidth(),
            maxWidth: '100%',
            backgroundColor: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '6px',
            padding: '12px 16px',
            marginBottom: '14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px 14px',
            fontSize: '11px',
            color: '#CBD5E1'
          }}
        >
          {[
            { key: 'showLogo', label: 'Company Logo' },
            { key: 'showCompanyDetails', label: 'Company Details' },
            { key: 'showCustomerContact', label: 'Customer Contact' },
            { key: 'showHsn', label: 'HSN/SAC Code' },
            { key: 'showUnit', label: 'Unit Column' },
            { key: 'showTaxBreakdown', label: 'Tax Breakdown' },
            { key: 'showAmtWords', label: 'Amount in Words' },
            { key: 'showBankDetails', label: 'Bank Details' },
            { key: 'showTerms', label: 'Terms & Conditions' },
            { key: 'showSignature', label: 'Signatory Block' },
            { key: 'showLedgerflowWordmark', label: 'Show LedgerFlow Wordmark' }
          ].map((item) => {
            const isChecked = Boolean((visibility as any)[item.key]);
            return (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleVisibility(item.key as keyof InvoiceVisibilityOptions)}
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      )}

        {/* Scrollable Document Stage */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'auto',
            width: '100%',
            padding: '20px 12px 32px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            backgroundColor: '#0F172A'
          }}
        >
          {/* Rendered Invoice Sheet */}
          <div
            style={{
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
              borderRadius: '4px',
              overflow: 'hidden',
              maxWidth: '100%'
            }}
          >
            <InvoiceRenderer
              data={normalized}
              layout={layout}
              options={visibility}
              id="printable-tax-invoice"
            />
          </div>
        </div>
      </div>

      {/* Cancel / Delete Voucher Confirmation Modal */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 130
          }}
        >
          <div
            style={{
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '20px 24px',
              width: '420px',
              maxWidth: '90%',
              color: '#F8FAFC'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <AlertCircle size={22} />
              <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                {normalized.status === 'DRAFT' ? 'Delete Draft Voucher?' : 'Cancel Posted Voucher?'}
              </h4>
            </div>

            <p style={{ fontSize: '12px', color: '#CBD5E1', marginBottom: '14px', lineHeight: 1.4 }}>
              {normalized.status === 'DRAFT'
                ? `This will permanently delete draft ${normalized.voucherNumber}. This action cannot be undone.`
                : `Cancelling ${normalized.voucherNumber} will preserve the audit trail and create reversal accounting entries. Enter a cancellation reason below:`}
            </p>

            {normalized.status !== 'DRAFT' && (
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '5px',
                  border: '1px solid #475569',
                  backgroundColor: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  marginBottom: '14px',
                  boxSizing: 'border-box'
                }}
              />
            )}

            {cancelError && (
              <div style={{ color: '#EF4444', fontSize: '11px', marginBottom: '10px' }}>
                {cancelError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  border: '1px solid #475569',
                  backgroundColor: '#334155',
                  color: '#F8FAFC',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleCancelOrDeleteVoucher}
                disabled={isCancelling}
                style={{
                  padding: '6px 14px',
                  borderRadius: '5px',
                  border: 'none',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isCancelling ? 'Processing...' : normalized.status === 'DRAFT' ? 'Confirm Delete' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
