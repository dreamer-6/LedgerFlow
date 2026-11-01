import React, { useState, useEffect, useMemo } from 'react';
import { Company, FinancialYear } from '../api/client';
import {
  quotationStorage,
  QuotationRecord,
  QuotationLineItem
} from '../utils/quotationStorage';
import {
  ArrowLeft,
  FileText,
  User,
  Calendar,
  Clock,
  Printer,
  Edit2,
  Copy,
  Repeat,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MapPin,
  Phone,
  Mail,
  Building,
  Package,
  Layers,
  MessageSquare,
  Info,
  TrendingUp,
  MoreVertical,
  Type
} from 'lucide-react';
import { QuotationPrintModal } from './QuotationPrintModal';

export interface QuotationDetailsViewProps {
  quotationId: string | null;
  company: Company | null;
  activeFy: FinancialYear | null;
  onBack: () => void;
  onEdit: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onConvertToInvoice: (quotation: QuotationRecord) => void;
}

function formatINR(val: number): string {
  return '₹ ' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dStr?: string): string {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

function formatDateTime(dStr?: string): string {
  if (!dStr) return '-';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dStr;
  }
}

function numberToWordsINR(amount: number): string {
  if (amount <= 0 || isNaN(amount)) return 'Zero Rupees Only';
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

  const intPart = Math.floor(amount);
  const paise = Math.round((amount - intPart) * 100);

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

export const QuotationDetailsView: React.FC<QuotationDetailsViewProps> = ({
  quotationId,
  company,
  activeFy,
  onBack,
  onEdit,
  onDuplicate,
  onConvertToInvoice
}) => {
  const companyId = company?.company_id || 'comp_default';
  const [quotation, setQuotation] = useState<QuotationRecord | null>(null);
  const [viewTaxMode, setViewTaxMode] = useState<'INCLUSIVE' | 'EXCLUSIVE'>('INCLUSIVE');
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    if (quotationId && companyId) {
      const q = quotationStorage.getById(companyId, quotationId);
      setQuotation(q);
      if (q?.taxMode) {
        setViewTaxMode(q.taxMode);
      }
    }
  }, [quotationId, companyId]);

  if (!quotation) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted, #94A3B8)' }}>
        <p>Quotation not found.</p>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            backgroundColor: 'var(--color-primary, #F97316)',
            color: '#FFFFFF',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Return to Register
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: QuotationRecord['status']) => {
    switch (status) {
      case 'CONVERTED':
        return { label: 'Converted', bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
      case 'ACCEPTED':
        return { label: 'Accepted', bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'SENT':
        return { label: 'Sent', bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'DRAFT':
        return { label: 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
      case 'REJECTED':
        return { label: 'Rejected', bg: '#FEE2E2', text: '#DC2626', border: '#FECACA' };
      case 'EXPIRED':
        return { label: 'Expired', bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
      default:
        return { label: status || 'Draft', bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  const badge = getStatusBadge(quotation.status);

  // Calculate validity days remaining
  const validityInfo = () => {
    if (!quotation.validTill) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validDate = new Date(quotation.validTill);
    validDate.setHours(0, 0, 0, 0);
    const diffTime = validDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Expired', isExpired: true };
    } else if (diffDays === 0) {
      return { text: 'Expires Today', isExpired: false, isUrgent: true };
    } else {
      return { text: `${diffDays} Days`, isExpired: false, isUrgent: diffDays <= 3 };
    }
  };

  const valInfo = validityInfo();

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-text, #0F172A)' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '12.5px', color: 'var(--color-text-muted, #94A3B8)', marginBottom: '16px' }}>
        <span onClick={onBack} style={{ cursor: 'pointer' }}>Quotation</span> &gt;{' '}
        <span onClick={onBack} style={{ cursor: 'pointer' }}>Quotation Register</span> &gt;{' '}
        <span style={{ color: 'var(--color-text, #0F172A)', fontWeight: 600 }}>{quotation.quotationNumber}</span>
      </div>

      {/* Top Header Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          backgroundColor: 'var(--color-surface, #FFFFFF)',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid var(--color-border, #E2E8F0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {/* Left: Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#FFEDD5', color: '#EA580C' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--color-text, #0F172A)' }}>
                Quotation : {quotation.quotationNumber}
              </h1>
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  backgroundColor: badge.bg,
                  color: badge.text,
                  border: `1px solid ${badge.border}`
                }}
              >
                {badge.label}
              </span>
            </div>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: 'var(--color-text-secondary, #64748B)' }}>
              {quotation.subject || `Quotation for ${quotation.customerDetails?.name || 'Customer'}`}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #475569)',
              border: '1px solid var(--color-border, #CBD5E1)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={15} /> Back
          </button>

          {quotation.status !== 'CONVERTED' && (
            <button
              type="button"
              onClick={() => onEdit(quotation.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-surface, #FFFFFF)',
                color: 'var(--color-text-secondary, #475569)',
                border: '1px solid var(--color-border, #CBD5E1)',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <Edit2 size={15} /> Edit
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onDuplicate) onDuplicate(quotation.id);
              else {
                const copy = quotationStorage.duplicate(companyId, quotation.id);
                if (copy) onEdit(copy.id);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #475569)',
              border: '1px solid var(--color-border, #CBD5E1)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Copy size={15} /> Duplicate
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-surface, #FFFFFF)',
              color: 'var(--color-text-secondary, #475569)',
              border: '1px solid var(--color-border, #CBD5E1)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <Printer size={15} /> Print / PDF
          </button>

          {quotation.status !== 'CONVERTED' ? (
            <button
              type="button"
              onClick={() => onConvertToInvoice(quotation)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--color-primary, #F97316)',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(249, 115, 22, 0.28)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary-hover, #EA580C)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary, #F97316)')}
            >
              <Repeat size={15} /> Convert to Sales Invoice
            </button>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#DCFCE7',
                color: '#15803D',
                border: '1px solid #86EFAC',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={16} /> Converted to Sales Invoice
            </div>
          )}
        </div>
      </div>

      {/* Top 3 Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.6fr', gap: '20px', marginBottom: '24px' }}>
        {/* Card 1: Customer / Party */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#F97316' }}>
            <User size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Customer / Party</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--color-text, #0F172A)' }}>
              {quotation.customerDetails?.name || '-'}
              {quotation.customerDetails?.code && (
                <span style={{ fontWeight: 500, color: 'var(--color-text-secondary, #64748B)', marginLeft: '6px' }}>
                  ({quotation.customerDetails.code})
                </span>
              )}
            </div>

            {quotation.customerDetails?.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
                <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-text-muted, #94A3B8)' }} />
                <span>{quotation.customerDetails.address}</span>
              </div>
            )}

            {quotation.customerDetails?.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
                <Phone size={15} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                <span>{quotation.customerDetails.phone}</span>
              </div>
            )}

            {quotation.customerDetails?.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
                <Mail size={15} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                <span>{quotation.customerDetails.email}</span>
              </div>
            )}

            {quotation.customerDetails?.gstin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary, #475569)' }}>
                <Building size={15} style={{ color: 'var(--color-text-muted, #94A3B8)' }} />
                <span>GSTIN: <strong>{quotation.customerDetails.gstin}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Quotation Details */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#F97316' }}>
            <Calendar size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Quotation Details</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Quotation No.</span>
              <strong style={{ fontFamily: 'monospace', color: '#EA580C' }}>{quotation.quotationNumber}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Quotation Date</span>
              <strong>{formatDate(quotation.quotationDate)}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Valid Until</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong>{formatDate(quotation.validTill)}</strong>
                {valInfo && (
                  <span
                    style={{
                      padding: '2px 7px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: valInfo.isExpired ? '#FEE2E2' : valInfo.isUrgent ? '#FFEDD5' : '#E0F2FE',
                      color: valInfo.isExpired ? '#DC2626' : valInfo.isUrgent ? '#EA580C' : '#0284C7'
                    }}
                  >
                    {valInfo.text}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Sales Person</span>
              <span>{quotation.salesPerson || 'John Doe'}</span>
            </div>

            {quotation.referenceNumber && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Reference No.</span>
                <span>{quotation.referenceNumber}</span>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Status & Timeline */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#F97316' }}>
            <TrendingUp size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Status &amp; Timeline</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', paddingLeft: '8px' }}>
            {/* Timeline Item 1: Draft Created */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ marginTop: '2px', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>Draft Created</div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94A3B8)' }}>{formatDateTime(quotation.createdAt)}</div>
              </div>
            </div>

            {/* Timeline Item 2: Sent to Customer */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ marginTop: '2px', color: quotation.status !== 'DRAFT' ? '#16A34A' : '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {quotation.status !== 'DRAFT' ? <CheckCircle2 size={16} /> : <Clock size={16} />}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: quotation.status !== 'DRAFT' ? 'var(--color-text, #0F172A)' : 'var(--color-text-muted, #94A3B8)' }}>
                  Sent to Customer
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94A3B8)' }}>
                  {quotation.status !== 'DRAFT' ? formatDateTime(quotation.updatedAt || quotation.createdAt) : 'Pending send'}
                </div>
              </div>
            </div>

            {/* Timeline Item 3: Awaiting / Converted */}
            {quotation.status === 'CONVERTED' ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '2px', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#15803D' }}>Converted to Sales Invoice</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary, #64748B)' }}>
                    Invoice: {quotation.convertedInvoiceNumber || 'Created'}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '2px', color: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#EA580C' }}>
                    {quotation.status === 'ACCEPTED' ? 'Accepted by Customer' : quotation.status === 'EXPIRED' ? 'Validity Expired' : 'Awaiting Response'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--color-text-muted, #94A3B8)' }}>
                    Valid till {formatDate(quotation.validTill)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle Row: Item Details & Amount Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Item Details */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F97316' }}>
              <Package size={18} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Item Details</span>
            </div>

            {/* Tax Mode Toggle */}
            <div style={{ display: 'flex', backgroundColor: 'var(--color-background, #F8F7F4)', padding: '3px', borderRadius: '8px', border: '1px solid var(--color-border, #E2E8F0)' }}>
              <button
                type="button"
                onClick={() => setViewTaxMode('INCLUSIVE')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewTaxMode === 'INCLUSIVE' ? '#F97316' : 'transparent',
                  color: viewTaxMode === 'INCLUSIVE' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Tax Inclusive
              </button>
              <button
                type="button"
                onClick={() => setViewTaxMode('EXCLUSIVE')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewTaxMode === 'EXCLUSIVE' ? '#F97316' : 'transparent',
                  color: viewTaxMode === 'EXCLUSIVE' ? '#FFFFFF' : 'var(--color-text-secondary, #64748B)'
                }}
              >
                Tax Exclusive
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border, #E2E8F0)', color: 'var(--color-text-secondary, #64748B)' }}>
                  <th style={{ padding: '8px 10px', width: '30px' }}>#</th>
                  <th style={{ padding: '8px 10px' }}>Item Name &amp; Description</th>
                  <th style={{ padding: '8px 10px', width: '80px' }}>HSN/SAC</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: '50px' }}>Unit</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>
                    Rate (₹) {viewTaxMode === 'INCLUSIVE' ? '(Incl. Tax)' : '(Excl. Tax)'}
                  </th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Tax %</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>
                    Amount (₹) {viewTaxMode === 'INCLUSIVE' ? '(Incl. Tax)' : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {quotation.items.map((it, idx) => {
                  const qty = it.quantity || 1;
                  const gst = it.gstRate || 0;
                  const inclRate = quotation.taxMode === 'INCLUSIVE' ? it.rate : it.rate * (1 + gst / 100);
                  const exclRate = quotation.taxMode === 'EXCLUSIVE' ? it.rate : it.rate / (1 + gst / 100);
                  const displayRate = viewTaxMode === 'INCLUSIVE' ? inclRate : exclRate;
                  const lineTotal = viewTaxMode === 'INCLUSIVE' ? it.totalAmount : it.taxableAmount;

                  return (
                    <tr key={it.id || idx} style={{ borderBottom: '1px solid var(--color-border, #F1F5F9)' }}>
                      <td style={{ padding: '10px', color: 'var(--color-text-muted, #94A3B8)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text, #0F172A)' }}>{it.description}</div>
                        {it.subtext && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary, #64748B)' }}>
                            {it.subtext}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: 'var(--color-text-secondary, #64748B)' }}>{it.hsnSac || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600 }}>{qty}</td>
                      <td style={{ padding: '10px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>{it.unit || 'NOS'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>
                        {displayRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', color: 'var(--color-text-secondary, #64748B)' }}>{gst}%</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>
                        {lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Amount Summary */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: '#F97316' }}>
              <Layers size={18} />
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Amount Summary</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Sub Total</span>
                <span style={{ fontWeight: 600 }}>{formatINR(quotation.subtotal)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Taxable Amount</span>
                <span style={{ fontWeight: 600 }}>{formatINR(quotation.subtotal)}</span>
              </div>

              {quotation.cgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>CGST</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(quotation.cgstAmount)}</span>
                </div>
              )}

              {quotation.sgstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>SGST</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(quotation.sgstAmount)}</span>
                </div>
              )}

              {quotation.igstAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>IGST</span>
                  <span style={{ fontWeight: 600 }}>{formatINR(quotation.igstAmount)}</span>
                </div>
              )}

              {quotation.roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Round Off</span>
                  <span style={{ fontWeight: 600 }}>{quotation.roundOff > 0 ? `+${quotation.roundOff.toFixed(2)}` : quotation.roundOff.toFixed(2)}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '2px solid var(--color-border, #E2E8F0)',
                  marginTop: '4px'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Grand Total</span>
                <span style={{ fontSize: '24px', fontWeight: 800, color: '#EA580C' }}>
                  {formatINR(quotation.grandTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px dashed var(--color-border, #E2E8F0)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-muted, #94A3B8)', marginBottom: '4px' }}>
              <Type size={13} />
              <span>Amount in Words</span>
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', fontStyle: 'italic', lineHeight: 1.4 }}>
              {numberToWordsINR(quotation.grandTotal)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.2fr 1fr', gap: '20px' }}>
        {/* Card 1: Terms and Conditions */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#F97316' }}>
            <FileText size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Terms and Conditions</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {quotation.termsConditions || '1. Prices are valid for 7 days from the quotation date.\n2. Payment terms as agreed.\n3. Goods once sold will not be taken back.'}
          </div>
        </div>

        {/* Card 2: Notes */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#F97316' }}>
            <MessageSquare size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Notes</span>
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary, #475569)', lineHeight: 1.6 }}>
            {quotation.notes || 'No additional notes specified for this quotation.'}
          </div>
        </div>

        {/* Card 3: Other Information */}
        <div
          style={{
            backgroundColor: 'var(--color-surface, #FFFFFF)',
            borderRadius: '12px',
            border: '1px solid var(--color-border, #E2E8F0)',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#F97316' }}>
            <Info size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text, #0F172A)' }}>Other Information</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Place of Supply</span>
              <strong>{quotation.placeOfSupply || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Delivery Period</span>
              <span>{quotation.deliveryPeriod || 'Within 5-7 Working Days'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Transport Mode</span>
              <span>{quotation.transportMode || 'By Road'}</span>
            </div>

            {quotation.vehicleNo && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-secondary, #64748B)' }}>Vehicle No.</span>
                <span>{quotation.vehicleNo}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <QuotationPrintModal
          quotation={quotation}
          company={company}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};
