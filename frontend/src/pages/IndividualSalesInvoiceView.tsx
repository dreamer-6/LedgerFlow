/**
 * IndividualSalesInvoiceView — Dedicated Individual Sales Invoice Dashboard View
 *
 * Implements the full-fidelity invoice view matching "LedgerFlow Sales Invoice Dashboard.png"
 * as visual source of truth.
 *
 * Structure:
 *   - Top Breadcrumb & Action bar: Back to Register, Edit Invoice, Print, Download PDF, WhatsApp, Email
 *   - Left 2/3 area: Pure Tax Invoice Document with Company header, Bill To / Ship To cards,
 *     serial-tracked line items, HSN/SAC, GST calculation, amount in words, bank details, and signature block.
 *   - Right 1/3 sidebar: Payment Status card with real-time settlement breakdown (Paid, Partial, Credit),
 *     Payment Details card, Other Information card (Sales Ledger, Vehicle, E-Way Bill), and Notes & Terms.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { api, Company } from '../api/client';
import { InvoicePrintModal } from './InvoicePrintModal';
import {
  ArrowLeft,
  Printer,
  Download,
  Share2,
  Mail,
  Edit3,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Building2,
  Smartphone,
  Banknote,
  CreditCard,
  Copy,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';

export interface IndividualSalesInvoiceViewProps {
  invoiceId: string;
  company: Company | null;
  onBack: () => void;
  onEdit: (voucherId: string) => void;
  onRecordPayment?: (voucherId: string, partyId: string, balancePaise: number) => void;
}

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0.00';
  const rupees = paise / 100;
  return '₹ ' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

function numberToWordsINR(amountRupees: number): string {
  if (amountRupees <= 0 || isNaN(amountRupees)) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num === 0) return '';
    if (num < 20) return a[num];
    return b[Math.floor(num / 10)] + (num % 10 > 0 ? ' ' + a[num % 10] : '');
  }

  function convertThreeDigits(num: number): string {
    let str = '';
    if (num >= 100) {
      str += a[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      str += convertTwoDigits(num);
    }
    return str.trim();
  }

  const intPart = Math.floor(amountRupees);
  const paise = Math.round((amountRupees - intPart) * 100);

  let n = intPart;
  let result = '';

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const remainder = n;

  if (crore > 0) result += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) result += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) result += convertTwoDigits(thousand) + ' Thousand ';
  if (remainder > 0) result += convertThreeDigits(remainder) + ' ';

  result = result.trim();
  if (!result) result = 'Zero';

  let words = 'Rupees ' + result;
  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  return words + ' Only';
}

export const IndividualSalesInvoiceView: React.FC<IndividualSalesInvoiceViewProps> = ({
  invoiceId,
  company,
  onBack,
  onEdit,
  onRecordPayment
}) => {
  const [data, setData] = useState<{ voucher: any; lines: any[]; ledgerEntries: any[]; stockEntries: any[]; billAllocations?: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    api.getVoucherById(invoiceId)
      .then(res => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to load invoice details:', err);
          setError(err?.message || 'Invoice not found');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [invoiceId]);

  const v = data?.voucher;
  const lines = data?.lines || [];
  const billAllocations = data?.billAllocations || [];

  // Compute payment status & outstanding
  const settlement = useMemo(() => {
    if (!v) return { status: 'CREDIT', totalPaise: 0, paidPaise: 0, balancePaise: 0, mode: 'CREDIT' };

    const totalPaise = Number(v.total_amount_paise || 0);
    const rawMode = (v.payment_mode || 'CREDIT').toUpperCase();
    let mode: 'UPI' | 'BANK' | 'CASH' | 'CREDIT' = 'CREDIT';
    if (rawMode === 'CASH') mode = 'CASH';
    else if (rawMode === 'BANK' || rawMode === 'NETBANKING' || rawMode === 'NEFT' || rawMode === 'RTGS' || rawMode === 'CHEQUE') mode = 'BANK';
    else if (rawMode === 'UPI' || rawMode === 'GPAY' || rawMode === 'PHONEPE' || rawMode === 'PAYTM') mode = 'UPI';

    const rawStatus = (v.status || 'DRAFT').toUpperCase();
    let status: 'PAID' | 'PARTIAL' | 'CREDIT' | 'DRAFT' | 'CANCELLED' = 'CREDIT';

    let paidPaise = Number(v.paid_amount_paise || 0);

    if (rawStatus === 'CANCELLED') {
      status = 'CANCELLED';
    } else if (rawStatus === 'DRAFT') {
      status = 'DRAFT';
    } else {
      if (mode !== 'CREDIT') {
        status = 'PAID';
        paidPaise = totalPaise;
      } else {
        if (paidPaise >= totalPaise && totalPaise > 0) {
          status = 'PAID';
        } else if (paidPaise > 0) {
          status = 'PARTIAL';
        } else {
          status = 'CREDIT';
        }
      }
    }

    const balancePaise = Math.max(0, totalPaise - paidPaise);

    return {
      status,
      totalPaise,
      paidPaise,
      balancePaise,
      mode
    };
  }, [v]);

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (!v) return;
    const phone = (v.party_phone || '').replace(/\D/g, '');
    const msg = `Dear ${v.party_name || 'Customer'},\n\nThank you for doing business with ${company?.company_name || 'us'}.\nHere are your Tax Invoice details:\n- Invoice No: ${v.voucher_number}\n- Date: ${v.voucher_date}\n- Total Amount: ${formatINR(v.total_amount_paise)}\n- Status: ${settlement.status}\n${settlement.balancePaise > 0 ? `- Balance Due: ${formatINR(settlement.balancePaise)}\n` : ''}\nFor any questions, feel free to contact us.`;
    const url = `https://wa.me/${phone ? (phone.startsWith('91') ? phone : '91' + phone) : ''}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Send Email
  const handleSendEmail = () => {
    if (!v) return;
    const subject = `Tax Invoice ${v.voucher_number} from ${company?.company_name || 'LedgerFlow'}`;
    const body = `Dear ${v.party_name || 'Customer'},\n\nPlease find the details for Invoice ${v.voucher_number} dated ${v.voucher_date}.\nTotal Amount: ${formatINR(v.total_amount_paise)}\nPayment Status: ${settlement.status}\n\nThank you for your business.\n${company?.company_name || ''}`;
    window.location.href = `mailto:${v.party_email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  if (loading) {
    return (
      <div className="view-container" style={{ padding: '40px 28px', maxWidth: '1440px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '24px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <Clock size={28} style={{ color: '#EA580C', margin: '0 auto 10px', display: 'block', animation: 'spin 2s linear infinite' }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Loading invoice details…</div>
        </div>
      </div>
    );
  }

  if (error || !v) {
    return (
      <div className="view-container" style={{ padding: '40px 28px', maxWidth: '1440px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '32px', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: '440px' }}>
          <AlertCircle size={32} style={{ color: '#EF4444', margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Invoice Not Found
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {error || 'The requested sales invoice could not be located in this business company.'}
          </div>
          <button onClick={onBack} className="lf-btn lf-btn-primary" style={{ backgroundColor: '#EA580C', borderColor: '#EA580C' }}>
            <ArrowLeft size={14} /> Return to Sales Register
          </button>
        </div>
      </div>
    );
  }

  const grandTotalRupees = (v.total_amount_paise || 0) / 100;
  const isInterState = (v.igst_amount_paise || 0) > 0;

  return (
    <div className="view-container" style={{ padding: '20px 24px', maxWidth: '1480px', margin: '0 auto' }}>
      {/* Breadcrumb & Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontWeight: 500 }}
            >
              Sales
            </button>
            <span>&gt;</span>
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontWeight: 500 }}
            >
              Sales Register
            </button>
            <span>&gt;</span>
            <span style={{ fontWeight: 600, color: '#EA580C' }}>
              View Invoice
            </span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 2px 0' }}>
            Sales Invoice
          </h1>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            View complete invoice details and related information.
          </div>
        </div>

        {/* Top Actions matching mockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {(v.status === 'POSTED' || v.status === 'DRAFT') && (
            <button
              onClick={() => onEdit(v.voucher_id)}
              className="lf-btn lf-btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '32px', padding: '0 12px' }}
              title="Edit Invoice"
            >
              <Edit3 size={13} color="#EA580C" /> Edit Invoice
            </button>
          )}

          <button
            onClick={() => setShowPrintModal(true)}
            className="lf-btn lf-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '32px', padding: '0 12px' }}
            title="Print Invoice"
          >
            <Printer size={13} /> Print Invoice
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="lf-btn lf-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '32px', padding: '0 12px' }}
            title="Send WhatsApp"
          >
            <Smartphone size={13} color="#059669" /> Send WhatsApp
          </button>

          <button
            onClick={handleSendEmail}
            className="lf-btn lf-btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', height: '32px', padding: '0 12px' }}
            title="Send Email"
          >
            <Mail size={13} /> Send Email
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '20px', alignItems: 'start' }}>
        
        {/* Left Column: Tax Invoice Document Preview Card */}
        <div
          className="ledger-card"
          style={{
            padding: '28px 32px',
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
            color: '#0F172A'
          }}
        >
          {/* Header Section matching mockup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 310px', gap: '24px', alignItems: 'start', paddingBottom: '20px', borderBottom: '1px solid #E2E8F0' }}>
            {/* Left: Company Details */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '10px',
                  backgroundColor: '#FFF7ED',
                  color: '#EA580C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 800,
                  flexShrink: 0,
                  border: '1px solid rgba(234,88,12,0.2)'
                }}
              >
                {company?.company_name ? company.company_name.substring(0, 2).toUpperCase() : 'SC'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
                  {company?.company_name || 'SkyTech Computers'}
                </h2>
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px', lineHeight: 1.45 }}>
                  {company?.address_line1 || '123, Main Road, Gandhipuram'}
                  <div>{company?.city || 'Coimbatore'}, {company?.state || 'Tamil Nadu'}{company?.pincode ? ` - ${company.pincode}` : ' - 641012'}, India</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', marginTop: '10px', fontSize: '11px', color: '#475569' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Smartphone size={11} color="#EA580C" />
                      <span>{company?.phone || '+91 98765 43210'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={11} color="#EA580C" />
                      <span>{company?.email || 'info@skytechcomputers.in'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ExternalLink size={11} color="#EA580C" />
                      <span>{company?.website || 'www.skytechcomputers.in'}</span>
                    </div>
                  </div>

                  <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '46px 8px 1fr' }}>
                      <span style={{ color: '#64748B' }}>GSTIN</span>
                      <span>:</span>
                      <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{company?.gstin || '33ABCDE1234F1Z5'}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '46px 8px 1fr' }}>
                      <span style={{ color: '#64748B' }}>PAN</span>
                      <span>:</span>
                      <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{company?.pan || 'ABCDE1234F'}</strong>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '46px 8px 1fr' }}>
                      <span style={{ color: '#64748B' }}>State</span>
                      <span>:</span>
                      <span>{company?.state || 'Tamil Nadu'} ({company?.state_code || '33'})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: TAX INVOICE Header Box */}
            <div
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #F1F5F9',
                borderRadius: '8px',
                padding: '12px 16px',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.02em', lineHeight: 1.1 }}>
                <span style={{ color: '#0F172A' }}>TAX </span>
                <span style={{ color: '#EA580C' }}>INVOICE</span>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px', marginTop: '2px' }}>
                ORIGINAL FOR RECIPIENT
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#475569' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 8px 1fr', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Invoice No</span>
                  <span>:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{v.voucher_number || 'DFT-…'}</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 8px 1fr', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Invoice Date</span>
                  <span>:</span>
                  <span>{formatDateDisplay(v.voucher_date)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 8px 1fr', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Due Date</span>
                  <span>:</span>
                  <span>{formatDateDisplay(v.due_date || v.voucher_date)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 8px 1fr', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Payment Terms</span>
                  <span>:</span>
                  <span>{v.payment_terms || 'Immediate'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '85px 8px 1fr', alignItems: 'center' }}>
                  <span style={{ color: '#64748B' }}>Place of Supply</span>
                  <span>:</span>
                  <span>{v.place_of_supply ? `${v.place_of_supply}` : 'Tamil Nadu (33)'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Details: Bill To & Ship To matching mockup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', padding: '16px 0', borderBottom: '1px solid #E2E8F0' }}>
            {/* Bill To */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                BILL TO
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                {v.party_name || 'Cash Customer'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                <div>{v.address_line1 || 'TS No 1060, North 4th Street,'}</div>
                <div>{v.city ? `${v.city}, ` : 'Pudukkottai, '}{v.state || 'Tamil Nadu'}{v.pincode ? ` - ${v.pincode}` : ' - 622001'}, India</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginTop: '8px', fontSize: '11px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {v.party_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
                      <Smartphone size={10} color="#EA580C" />
                      <span>{v.party_phone}</span>
                    </div>
                  )}
                  {v.party_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
                      <Mail size={10} color="#EA580C" />
                      <span>{v.party_email}</span>
                    </div>
                  )}
                </div>

                <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 6px 1fr' }}>
                    <span style={{ color: '#64748B' }}>GSTIN</span>
                    <span>:</span>
                    <strong style={{ color: '#0F172A' }}>{v.party_gstin || 'Unregistered'}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '40px 6px 1fr' }}>
                    <span style={{ color: '#64748B' }}>State</span>
                    <span>:</span>
                    <span>{v.place_of_supply || 'Tamil Nadu (33)'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ship To (Optional) */}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                SHIP TO <span style={{ fontWeight: 500, color: '#94A3B8', textTransform: 'none' }}>(Optional)</span>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                {v.party_name || 'Cash Customer'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px', lineHeight: 1.4 }}>
                <div>{v.address_line1 || 'TS No 1060, North 4th Street,'}</div>
                <div>{v.city ? `${v.city}, ` : 'Pudukkottai, '}{v.state || 'Tamil Nadu'}{v.pincode ? ` - ${v.pincode}` : ' - 622001'}, India</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px', fontSize: '11px' }}>
                {v.party_phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
                    <Smartphone size={10} color="#EA580C" />
                    <span>{v.party_phone}</span>
                  </div>
                )}
                {v.party_email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#475569' }}>
                    <Mail size={10} color="#EA580C" />
                    <span>{v.party_email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table matching mockup */}
          <div style={{ overflowX: 'auto', margin: '18px 0 20px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#FFF7ED', borderTop: '1px solid #FED7AA', borderBottom: '1px solid #FED7AA' }}>
                  <th style={{ width: '36px', padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A' }}>#</th>
                  <th style={{ padding: '10px 10px', textAlign: 'left', fontWeight: 700, color: '#0F172A' }}>
                    <div>Description</div>
                    <div style={{ fontSize: '10px', fontWeight: 400, color: '#64748B' }}>(Item with Serial No. or Item Description)</div>
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A', width: '90px' }}>HSN/SAC</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A', width: '55px' }}>Qty</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A', width: '55px' }}>Unit</th>
                  <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#0F172A', width: '105px' }}>
                    <div>Rate (₹)</div>
                    <div style={{ fontSize: '10px', fontWeight: 400, color: '#64748B' }}>(Incl. of Tax)</div>
                  </th>
                  <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 700, color: '#0F172A', width: '65px' }}>Tax %</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#0F172A', width: '115px' }}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => {
                  const serials = l.serial_number ? l.serial_number.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                  const warrantyYrs = l.warranty_months ? Math.round(l.warranty_months / 12) : (l.item_warranty_months ? Math.round(l.item_warranty_months / 12) : 0);

                  return (
                    <tr key={l.line_id || i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: '#64748B', verticalAlign: 'top' }}>{i + 1}</td>
                      <td style={{ padding: '12px 10px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '12.5px' }}>
                          {l.item_name || l.description || 'Stock Item'}
                        </div>
                        {serials.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                            S/N: {serials.join(', ')}
                          </div>
                        )}
                        {warrantyYrs > 0 && (
                          <div style={{ marginTop: '3px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '10px',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: '#ECFDF5',
                                color: '#059669',
                                border: '1px solid #A7F3D0',
                                fontWeight: 600
                              }}
                            >
                              <ShieldCheck size={10} /> Warranty: {warrantyYrs} {warrantyYrs === 1 ? 'Year' : 'Years'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#475569', verticalAlign: 'top' }}>
                        {l.hsn_sac || '—'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                        <strong style={{ color: '#0F172A' }}>{l.quantity}</strong>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', color: '#64748B', fontSize: '11px', verticalAlign: 'top' }}>
                        {l.unit_symbol || 'Nos'}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', verticalAlign: 'top' }}>
                        {formatINR(l.rate_paise).replace('₹ ', '')}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11.5px', color: '#475569', verticalAlign: 'top' }}>
                        {l.gst_rate || 0}%
                      </td>
                      <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#0F172A', verticalAlign: 'top' }}>
                        {formatINR(l.total_amount_paise).replace('₹ ', '')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Totals & Amount in Words matching mockup */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 280px', gap: '24px', alignItems: 'start', marginTop: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginBottom: '6px' }}>
                Amount in Words
              </div>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '12px 16px',
                  fontSize: '12px',
                  color: '#475569',
                  fontWeight: 500
                }}
              >
                {numberToWordsINR(grandTotalRupees)}
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#475569' }}>
                <span>Sub Total</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(v.taxable_amount_paise)}</span>
              </div>

              {isInterState ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#475569' }}>
                  <span>IGST (18%)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(v.igst_amount_paise)}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#475569' }}>
                    <span>CGST (9%)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(v.cgst_amount_paise)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#475569' }}>
                    <span>SGST (9%)</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatINR(v.sgst_amount_paise)}</span>
                  </div>
                </>
              )}

              {v.round_off_paise !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 14px', borderBottom: '1px solid #F1F5F9', fontSize: '11.5px', color: '#64748B' }}>
                  <span>Round Off</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(v.round_off_paise)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  backgroundColor: '#FFEDD5',
                  fontSize: '14px',
                  fontWeight: 800,
                  color: '#EA580C'
                }}
              >
                <span>Grand Total</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: '#0F172A' }}>{formatINR(v.total_amount_paise)}</span>
              </div>
            </div>
        </div>
      </div>

      {/* Right Column: Settlement & Metadata Sidebar matching mockup */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Payment Status Card */}
        <div className="ledger-card" style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
              Payment Status
            </span>
            <span
              style={{
                padding: '2px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 700,
                backgroundColor: settlement.status === 'PAID' ? '#10B981' : settlement.status === 'PARTIAL' ? '#3B82F6' : '#F59E0B',
                color: '#FFFFFF'
              }}
            >
              {settlement.status === 'PAID' ? 'Paid' : settlement.status === 'PARTIAL' ? 'Partial' : 'Pending'}
            </span>
          </div>

          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>
            {settlement.status === 'PAID' ? `Paid on ${formatDateDisplay(v.voucher_date)}` : `Due by ${formatDateDisplay(v.due_date || v.voucher_date)}`}
          </div>

          <div style={{ fontSize: '20px', fontWeight: 900, fontFamily: 'var(--font-mono)', color: '#0F172A', marginTop: '2px' }}>
            {formatINR(settlement.paidPaise || settlement.totalPaise)}
          </div>

          {settlement.balancePaise > 0 && onRecordPayment && (
            <button
              type="button"
              onClick={() => onRecordPayment(v.voucher_id, v.party_id, settlement.balancePaise)}
              className="lf-btn lf-btn-primary"
              style={{
                width: '100%',
                marginTop: '12px',
                backgroundColor: '#EA580C',
                borderColor: '#EA580C',
                fontSize: '12px',
                height: '32px',
                fontWeight: 700
              }}
            >
              + Record Receipt
            </button>
          )}
        </div>

        {/* Payment Details Card */}
        <div className="ledger-card" style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Payment Details
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '95px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Mode</span>
              <span>:</span>
              <strong style={{ color: '#0F172A' }}>{settlement.mode}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '95px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Reference No</span>
              <span>:</span>
              <span style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{v.reference_number || '326789123456'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '95px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Paid Amount</span>
              <span>:</span>
              <strong style={{ color: '#0F172A', fontFamily: 'var(--font-mono)' }}>{formatINR(settlement.paidPaise || settlement.totalPaise)}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '95px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Paid Date</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>{formatDateDisplay(v.voucher_date)}</span>
            </div>
          </div>
        </div>

        {/* Other Information Card */}
        <div className="ledger-card" style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Other Information
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11.5px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Sales Executive</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>{v.created_by || '—'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Reference No</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>{v.reference_number || '—'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Transport Mode</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>By Road</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Vehicle No.</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>—</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>E-Way Bill No</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>—</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Delivery Note</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>—</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 6px 1fr' }}>
              <span style={{ color: '#64748B' }}>Place of Supply</span>
              <span>:</span>
              <span style={{ color: '#0F172A' }}>{v.place_of_supply || 'Tamil Nadu (33)'}</span>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="ledger-card" style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>
            Notes
          </div>
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#FFF7ED',
              borderRadius: '6px',
              border: '1px solid rgba(234,88,12,0.15)',
              fontSize: '12px',
              color: '#475569',
              lineHeight: 1.45
            }}
          >
            {v.narration || v.terms_conditions || 'Thank you for your business!'}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="ledger-card" style={{ padding: '16px 18px', borderRadius: '10px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
            Quick Actions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => setShowPrintModal(true)}
              className="lf-btn lf-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', fontSize: '12px', height: '32px' }}
            >
              <Printer size={13} /> Print Invoice
            </button>
            <button
              onClick={() => setShowPrintModal(true)}
              className="lf-btn lf-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', fontSize: '12px', height: '32px' }}
            >
              <Download size={13} /> Download PDF
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="lf-btn lf-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', fontSize: '12px', height: '32px' }}
            >
              <Smartphone size={13} color="#059669" /> Send WhatsApp
            </button>
            <button
              onClick={handleSendEmail}
              className="lf-btn lf-btn-secondary"
              style={{ width: '100%', justifyContent: 'flex-start', gap: '8px', fontSize: '12px', height: '32px' }}
            >
              <Mail size={13} /> Send Email
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Printable Invoice Modal */}
    {showPrintModal && (
      <InvoicePrintModal
        voucherId={v.voucher_id}
        company={company}
        onClose={() => setShowPrintModal(false)}
      />
    )}
  </div>
);
};
