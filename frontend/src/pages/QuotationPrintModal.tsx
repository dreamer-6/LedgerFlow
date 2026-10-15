import React, { useEffect, useMemo, useState } from 'react';
import { Company } from '../api/client';
import { QuotationRecord, QuotationLineItem } from '../utils/quotationStorage';
import { Printer, Download, X, Phone, Mail, Globe, Info } from 'lucide-react';
import {
  paginateItems,
  estimateItemRowHeight,
  DEFAULT_A4_PAGINATION_CONFIG
} from '../utils/printPagination';

export interface QuotationPrintModalProps {
  quotation: QuotationRecord | null;
  company: Company | null;
  onClose: () => void;
}

export type PaperFormat = 'A4' | 'A5_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';

const STATE_GST_CODES: Record<string, string> = {
  'Jammu & Kashmir': '01',
  'Himachal Pradesh': '02',
  'Punjab': '03',
  'Chandigarh': '04',
  'Uttarakhand': '05',
  'Haryana': '06',
  'Delhi': '07',
  'Rajasthan': '08',
  'Uttar Pradesh': '09',
  'Bihar': '10',
  'Sikkim': '11',
  'Arunachal Pradesh': '12',
  'Nagaland': '13',
  'Manipur': '14',
  'Mizoram': '15',
  'Tripura': '16',
  'Meghalaya': '17',
  'Assam': '18',
  'West Bengal': '19',
  'Jharkhand': '20',
  'Odisha': '21',
  'Chhattisgarh': '22',
  'Madhya Pradesh': '23',
  'Gujarat': '24',
  'Daman and Diu': '25',
  'Dadra and Nagar Haveli': '26',
  'Maharashtra': '27',
  'Andhra Pradesh': '28',
  'Karnataka': '29',
  'Goa': '30',
  'Lakshadweep': '31',
  'Kerala': '32',
  'Tamil Nadu': '33',
  'Puducherry': '34',
  'Andaman and Nicobar Islands': '35',
  'Telangana': '36',
  'Ladakh': '38'
};

function formatStateWithCode(stateName?: string): string {
  if (!stateName) return '';
  if (stateName.includes('(') && stateName.includes(')')) return stateName;
  const clean = stateName.trim();
  const code = STATE_GST_CODES[clean];
  if (code) return `${clean} (${code})`;
  return clean;
}

function formatDateDisplay(dStr?: string): string {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  } catch {}
  return dStr;
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

function formatNumberINR(val: number): string {
  return (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const QuotationPrintModal: React.FC<QuotationPrintModalProps> = ({
  quotation,
  company,
  onClose
}) => {
  const [format, setFormat] = useState<PaperFormat>('A4');

  // ONLY show provided business details, NEVER fake placeholder data
  const companyName = company?.company_name || 'Business Name';
  const companyLogo = company?.logo_base64 || (company as any)?.logo_url || null;

  // Address lines constructed strictly from provided fields
  const companyAddrLine1 = company?.address_line1 || '';
  const compAddrParts = [
    company?.address_line2,
    company?.city,
    company?.state ? (company?.pincode ? `${company.state} - ${company.pincode}` : company.state) : company?.pincode,
    company?.country
  ].filter(Boolean);
  const companyAddrLine2 = compAddrParts.join(', ');

  // Contact details strictly if provided
  const companyPhone = company?.phone?.trim() || null;
  const companyEmail = company?.email?.trim() || null;
  const companyWebsite = company?.website?.trim() || null;

  // Tax identifiers strictly if provided
  const companyGstin = company?.gstin?.trim() || null;
  const companyPan = company?.pan?.trim() || null;
  const companyState = company?.state ? formatStateWithCode(company.state) : null;

  const hasCompanyContact = !!(companyPhone || companyEmail || companyWebsite);
  const hasCompanyTax = !!(companyGstin || companyPan || companyState);

  // Customer Details strictly if provided
  const customerName = quotation?.customerDetails?.name || 'Customer';
  const custAddrParts = [
    quotation?.customerDetails?.address,
    quotation?.customerDetails?.city,
    quotation?.customerDetails?.state
      ? (quotation?.customerDetails?.pincode
          ? `${quotation.customerDetails.state} - ${quotation.customerDetails.pincode}`
          : quotation.customerDetails.state)
      : quotation?.customerDetails?.pincode
  ].filter(Boolean);
  const customerAddress = custAddrParts.join(', ');

  const customerPhone = quotation?.customerDetails?.phone?.trim() || null;
  const customerEmail = quotation?.customerDetails?.email?.trim() || null;
  const customerGstin = quotation?.customerDetails?.gstin?.trim() || null;

  // Quotation Meta
  const quotationNumber = quotation?.quotationNumber || 'QTN';
  const quotationDate = quotation?.quotationDate ? formatDateDisplay(quotation.quotationDate) : '';
  const validUntil = quotation?.validTill ? formatDateDisplay(quotation.validTill) : '';
  const referenceNumber = quotation?.referenceNumber?.trim() || null;
  const placeOfSupply = quotation?.placeOfSupply ? formatStateWithCode(quotation.placeOfSupply) : companyState;

  // Tax breakdown
  const isTaxInclusive = quotation?.taxMode !== 'EXCLUSIVE';
  const effectiveTaxRate = useMemo(() => quotation?.items.find(i => (i.gstRate || 0) > 0)?.gstRate || 18, [quotation?.items]);
  const halfTaxRate = effectiveTaxRate / 2;

  // Terms and Conditions strictly from quotation, with fallback only if empty
  const termsToDisplay = useMemo(() => {
    if (quotation?.termsConditions && quotation.termsConditions.trim()) {
      return quotation.termsConditions
        .split('\n')
        .map(t => t.trim().replace(/^\d+[\.\)]\s*/, ''))
        .filter(Boolean);
    }
    return [
      'Goods once sold will not be taken back or exchanged.',
      'Warranty as per manufacturer terms.',
      `Payment to be made in favor of "${companyName}".`,
      'Prices are valid until the date stated above.',
      'This quotation is not a tax invoice.'
    ];
  }, [quotation?.termsConditions, companyName]);

  // Bank details strictly if provided by company
  const hasBankDetails = !!(company?.bank_name || company?.bank_account_no);
  const bankName = company?.bank_name || '';
  const bankAccountName = company?.company_name || companyName;
  const bankAccountNo = company?.bank_account_no || '';
  const bankIfsc = company?.bank_ifsc || '';
  const bankBranch = company?.bank_branch || '';

  // Multi-page deterministic pagination for A4 format
  const a4Pages = useMemo(() => {
    if (!quotation?.items || quotation.items.length === 0) {
      return [
        {
          pageIndex: 0,
          totalPages: 1,
          items: [] as QuotationLineItem[],
          isFirstPage: true,
          isLastPage: true,
          hasFooter: true
        }
      ];
    }
    return paginateItems(
      quotation.items,
      (item) =>
        estimateItemRowHeight({
          description: item.description,
          subtext: item.subtext || (item.itemId ? `S/N: ${item.itemId}` : '')
        }),
      DEFAULT_A4_PAGINATION_CONFIG
    );
  }, [quotation?.items]);

  // Ultra-fast dedicated print engine using isolated hidden iframe
  const handlePrint = () => {
    const printTarget = document.getElementById('printable-quotation');
    if (!printTarget) {
      window.print();
      return;
    }

    const pageSize =
      format === 'A4'
        ? 'A4 portrait'
        : format === 'A5_LANDSCAPE'
        ? 'A5 landscape'
        : format === 'A5_PORTRAIT'
        ? 'A5 portrait'
        : '80mm auto';
    const pageMargin = format === 'THERMAL' ? '2mm' : '8mm';
    const isThermal = format === 'THERMAL';

    try {
      const oldIframe = document.getElementById('lf-quotation-print-frame');
      if (oldIframe) oldIframe.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'lf-quotation-print-frame';
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;visibility:hidden;';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        window.print();
        return;
      }

      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Quotation — ${quotationNumber}</title>
  <style>
    @page { size: ${pageSize}; margin: ${pageMargin}; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif;
      font-size: ${isThermal ? '10px' : '11.5px'};
      color: #0F172A;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    #printable-quotation {
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
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
    .no-print { display: none !important; }
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
        } catch (e) {
          console.warn('Iframe print error, falling back to window.print():', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 1500);
        }
      }, 50);
    } catch (err) {
      console.error('Print initialization failed:', err);
      window.print();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, format]);

  if (!quotation) return null;

  // Header Component (Page 1)
  const renderFirstPageHeader = () => (
    <div
      style={{
        display: format === 'THERMAL' ? 'block' : 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '24px',
        marginBottom: '20px'
      }}
    >
      {/* Left Column: Brand Identity */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: companyLogo ? '14px' : '0' }}>
          {companyLogo && (
            <img
              src={companyLogo}
              alt="Company Logo"
              style={{
                maxWidth: '120px',
                maxHeight: '52px',
                objectFit: 'contain',
                borderRadius: '4px',
                flexShrink: 0
              }}
            />
          )}
          <div>
            <div
              style={{
                fontSize: format === 'THERMAL' ? '16px' : '22px',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.02em',
                lineHeight: 1.15
              }}
            >
              {companyName}
            </div>
            {(companyAddrLine1 || companyAddrLine2) && (
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.35 }}>
                {companyAddrLine1 && <div>{companyAddrLine1}</div>}
                {companyAddrLine2 && <div>{companyAddrLine2}</div>}
              </div>
            )}
          </div>
        </div>

        {(hasCompanyContact || hasCompanyTax) && (
          <div
            style={{
              display: format === 'THERMAL' ? 'block' : 'flex',
              alignItems: 'center',
              gap: '16px',
              marginTop: '12px',
              fontSize: '11px'
            }}
          >
            {hasCompanyContact && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {companyPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                    <Phone size={12} style={{ color: '#EA580C', flexShrink: 0 }} />
                    <span>{companyPhone}</span>
                  </div>
                )}
                {companyEmail && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                    <Mail size={12} style={{ color: '#EA580C', flexShrink: 0 }} />
                    <span>{companyEmail}</span>
                  </div>
                )}
                {companyWebsite && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                    <Globe size={12} style={{ color: '#EA580C', flexShrink: 0 }} />
                    <span>{companyWebsite}</span>
                  </div>
                )}
              </div>
            )}

            {hasCompanyContact && hasCompanyTax && format !== 'THERMAL' && (
              <div style={{ width: '1px', alignSelf: 'stretch', backgroundColor: '#CBD5E1', margin: '0 4px' }} />
            )}

            {hasCompanyTax && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: format === 'THERMAL' ? '8px' : 0 }}>
                {companyGstin && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#64748B', width: '45px' }}>GSTIN</span>
                    <span style={{ color: '#64748B' }}>:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{companyGstin}</span>
                  </div>
                )}
                {companyPan && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#64748B', width: '45px' }}>PAN</span>
                    <span style={{ color: '#64748B' }}>:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A', fontFamily: 'monospace' }}>{companyPan}</span>
                  </div>
                )}
                {companyState && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <span style={{ color: '#64748B', width: '45px' }}>State</span>
                    <span style={{ color: '#64748B' }}>:</span>
                    <span style={{ fontWeight: 600, color: '#0F172A' }}>{companyState}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Split Title, Subtitle & Quotation Metadata Box */}
      <div
        style={{
          textAlign: format === 'THERMAL' ? 'left' : 'right',
          marginTop: format === 'THERMAL' ? '16px' : 0,
          flexShrink: 0
        }}
      >
        <div>
          <span style={{ color: '#0F172A', fontWeight: 900, fontSize: format === 'THERMAL' ? '24px' : '32px', letterSpacing: '0.5px' }}>
            QUOT
          </span>
          <span style={{ color: '#EA580C', fontWeight: 900, fontSize: format === 'THERMAL' ? '24px' : '32px', letterSpacing: '0.5px' }}>
            ATION
          </span>
        </div>
        <div
          style={{
            fontSize: '9.5px',
            fontWeight: 700,
            color: '#64748B',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            marginTop: '2px',
            marginBottom: '8px'
          }}
        >
          PRICE OFFER • ORIGINAL FOR CUSTOMER
        </div>

        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '8px 14px',
            minWidth: format === 'THERMAL' ? 'auto' : '260px',
            textAlign: 'left',
            display: 'inline-block'
          }}
        >
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px' }}>
            <tbody>
              <tr>
                <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Quotation No.</td>
                <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                <td style={{ fontWeight: 700, color: '#0F172A', padding: '2px 0', fontFamily: 'monospace' }}>{quotationNumber}</td>
              </tr>
              {quotationDate && (
                <tr>
                  <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Quotation Date</td>
                  <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '2px 0' }}>{quotationDate}</td>
                </tr>
              )}
              {validUntil && (
                <tr>
                  <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Valid Until</td>
                  <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '2px 0' }}>{validUntil}</td>
                </tr>
              )}
              <tr>
                <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Payment Terms</td>
                <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                <td style={{ fontWeight: 600, color: '#0F172A', padding: '2px 0' }}>Immediate</td>
              </tr>
              {referenceNumber && (
                <tr>
                  <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Reference No.</td>
                  <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '2px 0' }}>{referenceNumber}</td>
                </tr>
              )}
              {placeOfSupply && (
                <tr>
                  <td style={{ color: '#334155', padding: '2px 0', whiteSpace: 'nowrap' }}>Place of Supply</td>
                  <td style={{ color: '#64748B', padding: '2px 8px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '2px 0' }}>{placeOfSupply}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Compact Continuation Header (Page 2..N)
  const renderContinuationHeader = (pageNum: number, totalPages: number) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1.5px solid #0F172A',
        paddingBottom: '8px',
        marginBottom: '14px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {companyLogo && (
          <img
            src={companyLogo}
            alt=""
            style={{ height: '22px', maxWidth: '80px', objectFit: 'contain' }}
          />
        )}
        <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
          {companyName}
        </span>
        <span style={{ color: '#94A3B8', fontSize: '11px' }}>•</span>
        <span style={{ color: '#EA580C', fontWeight: 800, fontSize: '12px', letterSpacing: '0.02em' }}>
          QUOTATION (Continuation)
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#475569' }}>
        <span>Quotation No: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{quotationNumber}</strong></span>
        {quotationDate && (
          <>
            <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
            <span>Date: <strong style={{ color: '#0F172A' }}>{quotationDate}</strong></span>
          </>
        )}
      </div>
    </div>
  );

  // Parties Card
  const renderPartiesCard = () => (
    <div
      style={{
        border: '1px solid #E2E8F0',
        borderRadius: '8px',
        padding: '12px 18px',
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: format === 'THERMAL' ? '1fr' : '1fr 1fr',
        gap: '20px'
      }}
    >
      {/* BILL TO */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', letterSpacing: '0.05em' }}>
          BILL TO
        </div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
          {customerName}
        </div>
        {customerAddress && (
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
            {customerAddress}
          </div>
        )}
        {customerPhone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155', marginTop: '6px' }}>
            <Phone size={11} style={{ color: '#EA580C' }} />
            <span>{customerPhone}</span>
          </div>
        )}
        {customerEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155', marginTop: '2px' }}>
            <Mail size={11} style={{ color: '#EA580C' }} />
            <span>{customerEmail}</span>
          </div>
        )}
        {customerGstin && (
          <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '3px' }}>
            GSTIN: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{customerGstin}</strong>
          </div>
        )}
      </div>

      {/* SHIP TO (Optional) */}
      <div
        style={{
          borderLeft: format === 'THERMAL' ? 'none' : '1px solid #E2E8F0',
          paddingLeft: format === 'THERMAL' ? 0 : '20px',
          borderTop: format === 'THERMAL' ? '1px solid #E2E8F0' : 'none',
          paddingTop: format === 'THERMAL' ? '12px' : 0
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 800, color: '#EA580C', letterSpacing: '0.05em' }}>
          SHIP TO <span style={{ fontWeight: 500, color: '#64748B', fontSize: '10px' }}>(Optional)</span>
        </div>
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
          {customerName}
        </div>
        {customerAddress && (
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.4 }}>
            {customerAddress}
          </div>
        )}
        {customerPhone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155', marginTop: '6px' }}>
            <Phone size={11} style={{ color: '#EA580C' }} />
            <span>{customerPhone}</span>
          </div>
        )}
        {customerEmail && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#334155', marginTop: '2px' }}>
            <Mail size={11} style={{ color: '#EA580C' }} />
            <span>{customerEmail}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Line Items Table
  const renderLineItemsTable = (items: QuotationLineItem[], pageIndex: number) => (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '20px',
        fontSize: format === 'THERMAL' ? '9.5px' : '11.5px'
      }}
    >
      <thead>
        <tr
          style={{
            backgroundColor: '#FFF7ED',
            borderTop: '1.5px solid #FED7AA',
            borderBottom: '1.5px solid #FED7AA'
          }}
        >
          <th style={{ padding: '8px 6px', textAlign: 'center', width: '32px', color: '#0F172A', fontWeight: 700 }}>#</th>
          <th style={{ padding: '8px 6px', textAlign: 'left', color: '#0F172A', fontWeight: 700 }}>
            <div>Description</div>
            <div style={{ fontSize: '9px', fontWeight: 500, color: '#64748B', marginTop: '1px' }}>
              (Item with Serial No. or Item Description)
            </div>
          </th>
          <th style={{ padding: '8px 6px', textAlign: 'center', width: '75px', color: '#0F172A', fontWeight: 700 }}>HSN/SAC</th>
          <th style={{ padding: '8px 6px', textAlign: 'center', width: '42px', color: '#0F172A', fontWeight: 700 }}>Qty</th>
          <th style={{ padding: '8px 6px', textAlign: 'center', width: '50px', color: '#0F172A', fontWeight: 700 }}>Unit</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', width: '95px', color: '#0F172A', fontWeight: 700 }}>
            <div>Rate</div>
            <div style={{ fontSize: '9px', fontWeight: 500, color: '#64748B', marginTop: '1px' }}>
              {isTaxInclusive ? '(₹, Incl. GST)' : '(₹)'}
            </div>
          </th>
          <th style={{ padding: '8px 6px', textAlign: 'center', width: '50px', color: '#0F172A', fontWeight: 700 }}>Tax %</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', width: '105px', color: '#0F172A', fontWeight: 700 }}>
            <div>Amount</div>
            <div style={{ fontSize: '9px', fontWeight: 500, color: '#64748B', marginTop: '1px' }}>
              {isTaxInclusive ? '(₹, Incl. GST)' : '(₹)'}
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, idx) => {
          const globalIdx = quotation.items.indexOf(item) >= 0 ? quotation.items.indexOf(item) + 1 : idx + 1;
          return (
            <tr key={item.id || idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', color: '#64748B' }}>
                {globalIdx}
              </td>
              <td style={{ padding: '8px 6px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.description}</div>
                {item.subtext ? (
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>{item.subtext}</div>
                ) : item.itemId ? (
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>
                    S/N: {item.itemId.slice(0, 8).toUpperCase()} (Optional)
                  </div>
                ) : null}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', color: '#475569', fontFamily: 'monospace' }}>
                {item.hsnSac || '—'}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', fontWeight: 600, color: '#0F172A' }}>
                {item.quantity}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', color: '#475569' }}>
                {item.unit || 'Nos'}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', fontFamily: 'monospace', color: '#0F172A' }}>
                {formatNumberINR(item.rate)}
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'center', verticalAlign: 'top', color: '#475569' }}>
                {item.gstRate || 0}%
              </td>
              <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', fontWeight: 600, fontFamily: 'monospace', color: '#0F172A' }}>
                {formatNumberINR(item.totalAmount)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // Totals & Words Section
  const renderTotalsAndWords = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: format === 'THERMAL' ? '1fr' : '1.3fr 1fr',
        gap: '24px',
        marginBottom: '24px',
        alignItems: 'start'
      }}
    >
      <div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
          Amount in Words
        </div>
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#1E293B',
            lineHeight: 1.4
          }}
        >
          {numberToWordsINR(quotation.grandTotal)}
        </div>

        {(quotation.transportMode || quotation.vehicleNo || quotation.deliveryPeriod) && (
          <div
            style={{
              marginTop: '8px',
              fontSize: '10.5px',
              color: '#64748B',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            {quotation.transportMode && <span>Transport: <strong style={{ color: '#0F172A' }}>{quotation.transportMode}</strong></span>}
            {quotation.vehicleNo && <span>Vehicle: <strong style={{ color: '#0F172A' }}>{quotation.vehicleNo}</strong></span>}
            {quotation.deliveryPeriod && <span>Delivery: <strong style={{ color: '#0F172A' }}>{quotation.deliveryPeriod}</strong></span>}
          </div>
        )}
      </div>

      <div style={{ width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '6px' }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 0', color: '#334155' }}>
                {isTaxInclusive ? 'Sub Total (Incl. GST)' : 'Sub Total'}
              </td>
              <td style={{ padding: '3px 6px', textAlign: 'right', color: '#334155', width: '20px' }}>₹</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', width: '90px' }}>
                {formatNumberINR(quotation.subtotal)}
              </td>
            </tr>

            {quotation.cgstAmount > 0 && (
              <tr>
                <td style={{ padding: '3px 0', color: '#334155' }}>
                  CGST @ {halfTaxRate}% {isTaxInclusive ? '(Included)' : ''}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: '#334155' }}>₹</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatNumberINR(quotation.cgstAmount)}
                </td>
              </tr>
            )}

            {quotation.sgstAmount > 0 && (
              <tr>
                <td style={{ padding: '3px 0', color: '#334155' }}>
                  SGST @ {halfTaxRate}% {isTaxInclusive ? '(Included)' : ''}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: '#334155' }}>₹</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatNumberINR(quotation.sgstAmount)}
                </td>
              </tr>
            )}

            {quotation.igstAmount > 0 && (
              <tr>
                <td style={{ padding: '3px 0', color: '#334155' }}>
                  IGST @ {effectiveTaxRate}% {isTaxInclusive ? '(Included)' : ''}
                </td>
                <td style={{ padding: '3px 6px', textAlign: 'right', color: '#334155' }}>₹</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatNumberINR(quotation.igstAmount)}
                </td>
              </tr>
            )}

            <tr>
              <td style={{ padding: '3px 0', color: '#334155' }}>Round Off</td>
              <td style={{ padding: '3px 6px', textAlign: 'right', color: '#334155' }}>₹</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace' }}>
                {formatNumberINR(quotation.roundOff || 0)}
              </td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            backgroundColor: '#FFF7ED',
            border: '1px solid #FED7AA',
            borderRadius: '6px',
            padding: '8px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px'
          }}
        >
          <span style={{ color: '#EA580C', fontWeight: 700, fontSize: '13.5px' }}>
            Quotation Total {isTaxInclusive ? '(Incl. GST)' : ''}
          </span>
          <span style={{ color: '#0F172A', fontWeight: 800, fontSize: '15.5px', fontFamily: 'monospace' }}>
            ₹ {formatNumberINR(quotation.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );

  // Terms, Bank Details & Signature
  const renderTermsBankSignature = () => (
    <div
      style={{
        borderTop: '1px solid #E2E8F0',
        paddingTop: '16px',
        display: 'grid',
        gridTemplateColumns: format === 'THERMAL' ? '1fr' : hasBankDetails ? '1.35fr 1.25fr 1fr' : '1.6fr 1fr',
        gap: '18px',
        alignItems: 'start'
      }}
    >
      <div>
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#EA580C', marginBottom: '6px' }}>
          Terms & Conditions
        </div>
        <ol
          style={{
            margin: 0,
            paddingLeft: '14px',
            fontSize: '10px',
            color: '#334155',
            lineHeight: 1.55
          }}
        >
          {termsToDisplay.map((term, i) => (
            <li key={i} style={{ marginBottom: '2px' }}>
              {term}
            </li>
          ))}
        </ol>
      </div>

      {hasBankDetails && (
        <div
          style={{
            borderLeft: format === 'THERMAL' ? 'none' : '1px solid #E2E8F0',
            paddingLeft: format === 'THERMAL' ? 0 : '16px',
            borderTop: format === 'THERMAL' ? '1px solid #E2E8F0' : 'none',
            paddingTop: format === 'THERMAL' ? '12px' : 0
          }}
        >
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#EA580C', marginBottom: '6px' }}>
            Bank Details <span style={{ fontWeight: 500, color: '#64748B', fontSize: '10px' }}>(Optional)</span>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10.5px' }}>
            <tbody>
              {bankName && (
                <tr>
                  <td style={{ color: '#475569', padding: '1.5px 0', whiteSpace: 'nowrap' }}>Bank Name</td>
                  <td style={{ color: '#94A3B8', padding: '1.5px 6px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '1.5px 0' }}>{bankName}</td>
                </tr>
              )}
              {bankAccountName && (
                <tr>
                  <td style={{ color: '#475569', padding: '1.5px 0', whiteSpace: 'nowrap' }}>Account Name</td>
                  <td style={{ color: '#94A3B8', padding: '1.5px 6px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '1.5px 0' }}>{bankAccountName}</td>
                </tr>
              )}
              {bankAccountNo && (
                <tr>
                  <td style={{ color: '#475569', padding: '1.5px 0', whiteSpace: 'nowrap' }}>Account No.</td>
                  <td style={{ color: '#94A3B8', padding: '1.5px 6px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '1.5px 0', fontFamily: 'monospace' }}>{bankAccountNo}</td>
                </tr>
              )}
              {bankIfsc && (
                <tr>
                  <td style={{ color: '#475569', padding: '1.5px 0', whiteSpace: 'nowrap' }}>IFSC Code</td>
                  <td style={{ color: '#94A3B8', padding: '1.5px 6px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '1.5px 0', fontFamily: 'monospace' }}>{bankIfsc}</td>
                </tr>
              )}
              {bankBranch && (
                <tr>
                  <td style={{ color: '#475569', padding: '1.5px 0', whiteSpace: 'nowrap' }}>Branch</td>
                  <td style={{ color: '#94A3B8', padding: '1.5px 6px' }}>:</td>
                  <td style={{ fontWeight: 600, color: '#0F172A', padding: '1.5px 0' }}>{bankBranch}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          borderLeft: format === 'THERMAL' ? 'none' : '1px solid #E2E8F0',
          paddingLeft: format === 'THERMAL' ? 0 : '16px',
          borderTop: format === 'THERMAL' ? '1px solid #E2E8F0' : 'none',
          paddingTop: format === 'THERMAL' ? '16px' : 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          minHeight: format === 'THERMAL' ? 'auto' : '110px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            borderBottom: '1px dotted #94A3B8',
            marginBottom: '6px',
            width: '85%',
            margin: '0 auto 6px auto'
          }}
        />
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>
          Authorized Signature
        </div>
        <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
          For {companyName}
        </div>
      </div>
    </div>
  );

  // Bottom info strip
  const renderBottomInfoStrip = () => (
    <div
      style={{
        marginTop: '20px',
        padding: '6px 12px',
        backgroundColor: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontSize: '10px',
        color: '#475569'
      }}
    >
      <Info size={13} style={{ color: '#475569', flexShrink: 0 }} />
      <span>Prices are valid until the date stated above. This quotation is not a tax invoice.</span>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#090D16',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @media print {
          html, body {
            background: #FFFFFF !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: ${
              format === 'A4'
                ? 'A4 portrait'
                : format === 'A5_LANDSCAPE'
                ? 'A5 landscape'
                : format === 'A5_PORTRAIT'
                ? 'A5 portrait'
                : '80mm auto'
            };
            margin: ${format === 'THERMAL' ? '2mm' : '8mm'};
          }
          #printable-quotation {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .a4-page-sheet {
            page-break-after: always;
            break-after: page;
            min-height: 297mm;
            box-sizing: border-box;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: ${format === 'THERMAL' ? '4px' : '14mm 16mm'} !important;
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
        }
      `}</style>

      {/* FULL-WIDTH FIXED TOP WORKSPACE TOOLBAR — PERFECT 32PX BASELINE ALIGNMENT */}
      <div
        className="no-print"
        style={{
          width: '100%',
          height: '52px',
          minHeight: '52px',
          backgroundColor: '#1E293B',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxSizing: 'border-box',
          flexShrink: 0,
          zIndex: 1000
        }}
      >
        {/* Left Section: Document Badge + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0F172A',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '4px 10px'
            }}
          >
            <span style={{ color: '#94A3B8', fontSize: '11px', fontWeight: 600 }}>Quotation</span>
            <span style={{ fontFamily: 'monospace', color: '#EA580C', fontWeight: 800, fontSize: '12.5px' }}>
              {quotationNumber}
            </span>
          </div>
          <span style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '14px' }}>
            Quotation Preview
          </span>
        </div>

        {/* Center Section: Paper Format Picker (Segmented pill, height 32px) */}
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
            boxSizing: 'border-box',
            flexShrink: 0
          }}
        >
          {[
            { id: 'A4', label: 'A4 Standard' },
            { id: 'A5_LANDSCAPE', label: 'A5 Landscape' },
            { id: 'A5_PORTRAIT', label: 'A5 Portrait' },
            { id: 'THERMAL', label: 'Thermal POS' }
          ].map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setFormat(fmt.id as PaperFormat)}
              style={{
                height: '24px',
                padding: '0 10px',
                fontSize: '11px',
                fontWeight: format === fmt.id ? 700 : 500,
                borderRadius: '4px',
                background: format === fmt.id ? '#1E293B' : 'transparent',
                color: format === fmt.id ? '#F8FAFC' : '#94A3B8',
                border: format === fmt.id ? '1px solid #475569' : '1px solid transparent',
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

        {/* Right Section: Action Buttons - Unified 32px Height Baseline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handlePrint}
            title="Print Quotation (Ctrl+P / Cmd+P)"
            style={{
              height: '32px',
              padding: '0 16px',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12.5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(234, 88, 12, 0.35)'
            }}
          >
            <Printer size={14} />
            <span>Print Quotation</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            title="Download PDF via browser print dialog"
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
          >
            <Download size={14} />
            <span>PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            style={{
              height: '32px',
              padding: '0 12px',
              backgroundColor: '#334155',
              color: '#F8FAFC',
              border: 'none',
              borderRadius: '5px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <X size={14} />
            <span>Close</span>
          </button>
        </div>
      </div>

      {/* FULL-SCREEN DOCUMENT STAGE */}
      <div
        style={{
          flex: 1,
          height: 'calc(100vh - 52px)',
          overflowY: 'auto',
          overflowX: 'auto',
          padding: '24px 16px 40px 16px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#090D16'
        }}
      >
        <div
          id="printable-quotation"
          style={{
            width: format === 'A4' ? '820px' : format === 'A5_PORTRAIT' ? '580px' : format === 'THERMAL' ? '330px' : '820px',
            maxWidth: '100%',
            backgroundColor: 'transparent',
            margin: '0 auto',
            boxSizing: 'border-box'
          }}
        >
          {format === 'A4' ? (
            // A4 Multi-Page Rendering Engine
            a4Pages.map((page) => (
              <div
                key={page.pageIndex}
                className="a4-page-sheet"
                style={{
                  width: '820px',
                  maxWidth: '100%',
                  minHeight: '1060px',
                  backgroundColor: '#FFFFFF',
                  color: '#0F172A',
                  borderRadius: '4px',
                  padding: '36px 40px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                  fontSize: '11.5px',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif',
                  lineHeight: 1.45,
                  margin: '0 auto 24px auto',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  {page.isFirstPage ? (
                    <>
                      {renderFirstPageHeader()}
                      {renderPartiesCard()}
                    </>
                  ) : (
                    renderContinuationHeader(page.pageIndex + 1, page.totalPages)
                  )}

                  {renderLineItemsTable(page.items, page.pageIndex)}

                  {page.hasFooter && (
                    <>
                      {renderTotalsAndWords()}
                      {renderTermsBankSignature()}
                      {renderBottomInfoStrip()}
                    </>
                  )}
                </div>

                {/* Page Numbering Bar */}
                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid #F1F5F9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '10px',
                    color: '#94A3B8'
                  }}
                >
                  <span>{companyName} • {quotationNumber}</span>
                  <span style={{ fontWeight: 600, color: '#475569' }}>
                    Page {page.pageIndex + 1} of {page.totalPages}
                  </span>
                </div>
              </div>
            ))
          ) : (
            // Non-A4 Single Continuous Canvas (Thermal POS, A5)
            <div
              className="a4-page-sheet"
              style={{
                width: '100%',
                backgroundColor: '#FFFFFF',
                color: '#0F172A',
                borderRadius: '4px',
                padding: format === 'THERMAL' ? '12px 10px' : '20px 24px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                fontSize: format === 'THERMAL' ? '10px' : '11.5px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif',
                lineHeight: 1.45,
                margin: '0 auto',
                boxSizing: 'border-box'
              }}
            >
              {renderFirstPageHeader()}
              {renderPartiesCard()}
              {renderLineItemsTable(quotation.items, 0)}
              {renderTotalsAndWords()}
              {renderTermsBankSignature()}
              {renderBottomInfoStrip()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
