import React from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  formatCurrency
} from './InvoiceAdapter';

interface SimpleInvoiceProps {
  data: NormalizedInvoiceData;
  options?: InvoiceVisibilityOptions;
  id?: string;
}

export const SimpleInvoice: React.FC<SimpleInvoiceProps> = ({
  data,
  options = {},
  id = 'printable-tax-invoice'
}) => {
  const {
    showLogo = true,
    showCompanyDetails = true,
    showHsn = true,
    showUnit = true,
    showTaxBreakdown = true,
    showAmtWords = true,
    showBankDetails = true,
    showTerms = true,
    showSignature = true
  } = options;

  return (
    <div
      id={id}
      className="simple-invoice-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#1E293B',
        fontFamily: "'Inter', system-ui, sans-serif",
        fontSize: '11.5px',
        lineHeight: 1.4,
        padding: '28px 32px',
        boxSizing: 'border-box'
      }}
    >
      {/* ─── COMPACT HEADER ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '2px solid #0F172A',
          paddingBottom: '14px',
          marginBottom: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {showLogo && data.companyLogo && (
              <img
                src={data.companyLogo}
                alt={data.companyName}
                style={{ maxHeight: '42px', maxWidth: '100px', objectFit: 'contain' }}
              />
            )}
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', margin: 0 }}>
              {data.companyName}
            </h1>
          </div>
          {showCompanyDetails && (
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '4px' }}>
              {data.companyAddress && <div>{data.companyAddress}</div>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '2px', flexWrap: 'wrap' }}>
                {data.companyPhone && <span>Phone: {data.companyPhone}</span>}
                {data.companyEmail && <span>Email: {data.companyEmail}</span>}
                {data.companyGstin && <span>GSTIN: <strong>{data.companyGstin}</strong></span>}
                {data.companyPan && <span>PAN: <strong>{data.companyPan}</strong></span>}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', letterSpacing: '0.5px' }}>
            {data.voucherType === 'PURCHASE' ? 'PURCHASE VOUCHER' : 'TAX INVOICE'}
          </div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#EA580C', fontFamily: 'monospace', marginTop: '2px' }}>
            #{data.voucherNumber}
          </div>
          <div style={{ color: '#64748B', fontSize: '10.5px', marginTop: '4px' }}>
            Date: <strong style={{ color: '#1E293B' }}>{data.voucherDate}</strong>
          </div>
          {data.dueDate && (
            <div style={{ color: '#64748B', fontSize: '10.5px' }}>
              Due: <strong style={{ color: '#1E293B' }}>{data.dueDate}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ─── BILL TO & DETAILS ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: '20px',
          backgroundColor: '#F8FAFC',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '16px'
        }}
      >
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>
            Billed To
          </div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
            {data.partyName}
          </div>
          {data.partyAddress && (
            <div style={{ color: '#475569', fontSize: '11px', marginTop: '2px' }}>
              {data.partyAddress}
            </div>
          )}
          {data.partyGstin && (
            <div style={{ fontSize: '10.5px', marginTop: '2px' }}>
              GSTIN: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{data.partyGstin}</span>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div>Payment Terms: <strong>{data.paymentTerms}</strong></div>
          {data.placeOfSupply && <div>Place of Supply: <strong>{data.placeOfSupply}</strong></div>}
          {data.referenceNumber && <div>Ref: <span style={{ fontFamily: 'monospace' }}>{data.referenceNumber}</span></div>}
        </div>
      </div>

      {/* ─── ITEMS TABLE ─── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
            <th style={{ padding: '6px 8px', width: '24px', textAlign: 'center' }}>#</th>
            <th style={{ padding: '6px 8px' }}>Item Description</th>
            {showHsn && <th style={{ padding: '6px 8px', width: '60px', textAlign: 'center' }}>HSN</th>}
            <th style={{ padding: '6px 8px', width: '40px', textAlign: 'center' }}>Qty</th>
            {showUnit && <th style={{ padding: '6px 8px', width: '45px', textAlign: 'center' }}>Unit</th>}
            <th style={{ padding: '6px 8px', width: '70px', textAlign: 'right' }}>Rate (₹)</th>
            <th style={{ padding: '6px 8px', width: '45px', textAlign: 'center' }}>Tax %</th>
            <th style={{ padding: '6px 8px', width: '80px', textAlign: 'right' }}>Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '7px 8px', textAlign: 'center', color: '#94A3B8' }}>{l.index}</td>
              <td style={{ padding: '7px 8px' }}>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{l.itemName}</span>
                {l.serialNumber && <span style={{ color: '#64748B', fontSize: '10px' }}> (S/N: {l.serialNumber})</span>}
                {l.description && <div style={{ color: '#64748B', fontSize: '10px' }}>{l.description}</div>}
              </td>
              {showHsn && <td style={{ padding: '7px 8px', textAlign: 'center', fontFamily: 'monospace' }}>{l.hsnSac || '—'}</td>}
              <td style={{ padding: '7px 8px', textAlign: 'center', fontWeight: 600 }}>{l.quantity}</td>
              {showUnit && <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748B' }}>{l.unit}</td>}
              <td style={{ padding: '7px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(l.rate)}</td>
              <td style={{ padding: '7px 8px', textAlign: 'center' }}>{l.taxPercent}%</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>{formatCurrency(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ─── SUMMARY & TOTALS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          {showAmtWords && (
            <div style={{ fontSize: '10.5px', color: '#475569', fontStyle: 'italic', marginBottom: '12px' }}>
              <strong>In Words:</strong> {data.amountInWords}
            </div>
          )}

          {showBankDetails && data.hasBankDetails && (
            <div style={{ fontSize: '10px', color: '#475569', backgroundColor: '#F8FAFC', padding: '8px 10px', borderRadius: '4px' }}>
              <div style={{ fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>Bank Information</div>
              <div>{data.bankName} • A/C: {data.bankAccountNo} • IFSC: {data.bankIfsc}</div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#475569' }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: 'monospace' }}>₹ {formatCurrency(data.subTotal)}</span>
          </div>
          {showTaxBreakdown && data.taxBreakdowns.map((tb, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#475569' }}>
              <span>{tb.label}</span>
              <span style={{ fontFamily: 'monospace' }}>₹ {formatCurrency(tb.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #0F172A', marginTop: '6px', fontSize: '13px', fontWeight: 800 }}>
            <span style={{ color: '#0F172A' }}>Total</span>
            <span style={{ fontFamily: 'monospace', color: '#EA580C' }}>₹ {formatCurrency(data.grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ─── */}
      <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: '10px', color: '#64748B' }}>
        {showTerms && data.termsAndConditions ? (
          <div style={{ maxWidth: '60%' }}>
            <div style={{ fontWeight: 700, color: '#475569' }}>Terms:</div>
            <div style={{ whiteSpace: 'pre-line' }}>{data.termsAndConditions}</div>
          </div>
        ) : <div />}

        {showSignature && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ borderBottom: '1px solid #94A3B8', width: '130px', marginBottom: '4px', height: '24px' }} />
            <div>Authorized Signatory</div>
          </div>
        )}
      </div>
    </div>
  );
};
