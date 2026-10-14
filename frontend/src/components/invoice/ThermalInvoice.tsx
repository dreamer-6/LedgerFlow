import React from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  formatCurrency
} from './InvoiceAdapter';

interface ThermalInvoiceProps {
  data: NormalizedInvoiceData;
  options?: InvoiceVisibilityOptions;
  id?: string;
}

export const ThermalInvoice: React.FC<ThermalInvoiceProps> = ({
  data,
  options = {},
  id = 'printable-tax-invoice'
}) => {
  const {
    showLogo = false,
    showCompanyDetails = true,
    showCustomerContact = true,
    showTaxBreakdown = true,
    showAmtWords = true
  } = options;

  return (
    <div
      id={id}
      className="thermal-invoice-container"
      style={{
        width: '300px',
        maxWidth: '100%',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#000000',
        fontFamily: "'JetBrains Mono', 'Courier New', Courier, monospace",
        fontSize: '11px',
        lineHeight: 1.35,
        padding: '12px 10px',
        boxSizing: 'border-box'
      }}
    >
      {/* ─── HEADER ─── */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        {showLogo && data.companyLogo && (
          <div style={{ marginBottom: '6px' }}>
            <img
              src={data.companyLogo}
              alt={data.companyName}
              style={{ maxHeight: '36px', maxWidth: '100px', objectFit: 'contain' }}
            />
          </div>
        )}
        <div style={{ fontSize: '14px', fontWeight: 900, textTransform: 'uppercase' }}>
          {data.companyName}
        </div>
        {showCompanyDetails && (
          <>
            {data.companyAddress && <div style={{ fontSize: '10px' }}>{data.companyAddress}</div>}
            {data.companyPhone && <div style={{ fontSize: '10px' }}>PH: {data.companyPhone}</div>}
            {data.companyGstin && <div style={{ fontSize: '10px' }}>GSTIN: {data.companyGstin}</div>}
          </>
        )}
        <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />
        <div style={{ fontWeight: 800, fontSize: '12px' }}>
          {data.voucherType === 'PURCHASE' ? '*** PURCHASE VOUCHER ***' : '*** TAX INVOICE ***'}
        </div>
        <div style={{ fontSize: '10px' }}>
          {data.voucherType === 'PURCHASE' ? 'PURCHASE RECORD' : 'ORIGINAL FOR RECIPIENT'}
        </div>
      </div>

      {/* ─── METADATA ─── */}
      <div style={{ fontSize: '10.5px', marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Inv #: <strong>{data.voucherNumber}</strong></span>
          <span>{data.voucherDate}</span>
        </div>
        {data.partyName && (
          <div style={{ marginTop: '2px' }}>
            <span>Cust: <strong>{data.partyName}</strong></span>
            {showCustomerContact && data.partyPhone && (
              <span style={{ marginLeft: '6px' }}>({data.partyPhone})</span>
            )}
          </div>
        )}
        {data.placeOfSupply && <div>POS: {data.placeOfSupply}</div>}
      </div>

      <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />

      {/* ─── ITEMS LISTING ─── */}
      <div style={{ marginBottom: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '10px', marginBottom: '4px' }}>
          <span style={{ flex: 1 }}>ITEM</span>
          <span style={{ width: '45px', textAlign: 'center' }}>QTY</span>
          <span style={{ width: '55px', textAlign: 'right' }}>RATE</span>
          <span style={{ width: '65px', textAlign: 'right' }}>AMT</span>
        </div>
        <div style={{ borderBottom: '1px solid #000', marginBottom: '4px' }} />

        {data.lines.map((l, i) => (
          <div key={i} style={{ marginBottom: '4px', fontSize: '10.5px' }}>
            <div style={{ fontWeight: 700 }}>
              {i + 1}. {l.itemName}
            </div>
            {l.serialNumber && (
              <div style={{ fontSize: '9.5px', paddingLeft: '12px' }}>S/N: {l.serialNumber}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '12px', fontSize: '10px' }}>
              <span style={{ flex: 1, color: '#333' }}>
                {l.hsnSac ? `HSN:${l.hsnSac}` : ''} {l.taxPercent}%
              </span>
              <span style={{ width: '45px', textAlign: 'center' }}>
                {l.quantity} {l.unit !== '—' ? l.unit : ''}
              </span>
              <span style={{ width: '55px', textAlign: 'right' }}>{formatCurrency(l.rate)}</span>
              <span style={{ width: '65px', textAlign: 'right', fontWeight: 700 }}>{formatCurrency(l.amount)}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }} />

      {/* ─── TOTALS ─── */}
      <div style={{ fontSize: '10.5px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>SUB TOTAL:</span>
          <span>₹ {formatCurrency(data.subTotal)}</span>
        </div>
        {showTaxBreakdown && data.taxBreakdowns.map((tb, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
            <span>{tb.label}:</span>
            <span>₹ {formatCurrency(tb.amount)}</span>
          </div>
        ))}
        <div style={{ borderBottom: '1px solid #000', margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 900 }}>
          <span>TOTAL:</span>
          <span>₹ {formatCurrency(data.grandTotal)}</span>
        </div>
        <div style={{ borderBottom: '1px solid #000', margin: '4px 0' }} />
      </div>

      {/* ─── AMOUNT IN WORDS & FOOTER ─── */}
      {showAmtWords && (
        <div style={{ fontSize: '9.5px', fontStyle: 'italic', marginBottom: '8px', textAlign: 'center' }}>
          {data.amountInWords}
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: '9.5px', marginTop: '10px' }}>
        <div>Thank you for your business!</div>
        <div style={{ marginTop: '2px', fontSize: '8.5px', color: '#555' }}>
          Powered by LedgerFlow™
        </div>
      </div>
    </div>
  );
};
