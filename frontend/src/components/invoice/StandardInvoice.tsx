import React from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  formatCurrency
} from './InvoiceAdapter';
import { Phone, Mail, Globe } from 'lucide-react';

interface StandardInvoiceProps {
  data: NormalizedInvoiceData;
  options?: InvoiceVisibilityOptions;
  id?: string;
}

export const StandardInvoice: React.FC<StandardInvoiceProps> = ({
  data,
  options = {},
  id = 'printable-tax-invoice'
}) => {
  const {
    showLogo = true,
    showCompanyDetails = true,
    showCustomerContact = true,
    showHsn = true,
    showUnit = true,
    showTaxBreakdown = true,
    showAmtWords = true,
    showBankDetails = true,
    showTerms = true,
    showSignature = true,
    showLedgerflowWordmark = false
  } = options;

  const hasGstin = Boolean(data.companyGstin && data.companyGstin.trim());
  const hasPan = Boolean(data.companyPan && data.companyPan.trim());
  const hasState = Boolean(data.placeOfSupply && data.placeOfSupply.trim());
  const hasContacts = Boolean(data.companyPhone || data.companyEmail || data.companyWebsite);

  return (
    <div
      id={id}
      className="standard-invoice-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: '#FFFFFF',
        color: '#0F172A',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: '12px',
        lineHeight: 1.45,
        padding: '36px 40px',
        boxSizing: 'border-box'
      }}
    >
      {/* ─── SECTION 1: HEADER (COMPANY INFO & TAX INVOICE METADATA) ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.45fr 1fr',
          gap: '24px',
          alignItems: 'start',
          marginBottom: '24px'
        }}
      >
        {/* Left: Company Identity */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            {showLogo && data.companyLogo && (
              <img
                src={data.companyLogo}
                alt={data.companyName}
                style={{
                  maxHeight: '56px',
                  maxWidth: '120px',
                  objectFit: 'contain'
                }}
              />
            )}
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#0F172A',
                letterSpacing: '-0.4px',
                margin: 0
              }}
            >
              {data.companyName}
            </h1>
          </div>

          {showCompanyDetails && (
            <>
              {data.companyAddress && (
                <div style={{ color: '#475569', fontSize: '11.5px', marginBottom: '10px', whiteSpace: 'pre-line' }}>
                  {data.companyAddress}
                </div>
              )}

              {/* Two columns: Contact Info & Statutory Tax Codes */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: hasContacts ? '1fr 1fr' : '1fr',
                  gap: '12px',
                  alignItems: 'start'
                }}
              >
                {/* Contacts */}
                {hasContacts && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#475569' }}>
                    {data.companyPhone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={12} color="#EA580C" />
                        <span>{data.companyPhone}</span>
                      </div>
                    )}
                    {data.companyEmail && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={12} color="#EA580C" />
                        <span>{data.companyEmail}</span>
                      </div>
                    )}
                    {data.companyWebsite && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={12} color="#EA580C" />
                        <span>{data.companyWebsite}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Statutory: GSTIN, PAN, State (displayed ONLY when configured) */}
                {(hasGstin || hasPan || hasState) && (
                  <div
                    style={{
                      borderLeft: hasContacts ? '1px solid #E2E8F0' : 'none',
                      paddingLeft: hasContacts ? '14px' : '0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      fontSize: '11px',
                      color: '#475569'
                    }}
                  >
                    {hasGstin && (
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px 1fr' }}>
                        <span style={{ color: '#64748B' }}>GSTIN</span>
                        <span>:</span>
                        <strong style={{ color: '#0F172A', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                          {data.companyGstin}
                        </strong>
                      </div>
                    )}
                    {hasPan && (
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px 1fr' }}>
                        <span style={{ color: '#64748B' }}>PAN</span>
                        <span>:</span>
                        <strong style={{ color: '#0F172A', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                          {data.companyPan}
                        </strong>
                      </div>
                    )}
                    {hasState && (
                      <div style={{ display: 'grid', gridTemplateColumns: '50px 10px 1fr' }}>
                        <span style={{ color: '#64748B' }}>State</span>
                        <span>:</span>
                        <span style={{ color: '#0F172A', fontWeight: 500 }}>
                          {data.placeOfSupply}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: TAX INVOICE Header & Metadata Grid */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '0.5px',
                lineHeight: 1.1
              }}
            >
              {data.voucherType === 'PURCHASE' ? (
                <>
                  <span style={{ color: '#0F172A' }}>PURCHASE </span>
                  <span style={{ color: '#EA580C' }}>VOUCHER</span>
                </>
              ) : (
                <>
                  <span style={{ color: '#0F172A' }}>TAX </span>
                  <span style={{ color: '#EA580C' }}>INVOICE</span>
                </>
              )}
            </div>
            <div
              style={{
                fontSize: '9.5px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                color: '#94A3B8',
                marginTop: '4px'
              }}
            >
              {data.voucherType === 'PURCHASE' ? 'PURCHASE INVOICE RECORD' : 'ORIGINAL FOR RECIPIENT'}
            </div>
          </div>

          {/* Metadata Table */}
          <div
            style={{
              display: 'inline-flex',
              flexDirection: 'column',
              gap: '4px',
              fontSize: '11.5px',
              textAlign: 'left'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '95px 12px 1fr', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Invoice No</span>
              <span style={{ color: '#64748B' }}>:</span>
              <strong style={{ color: '#0F172A', fontFamily: 'monospace', fontSize: '12px' }}>
                {data.voucherNumber}
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '95px 12px 1fr', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Invoice Date</span>
              <span style={{ color: '#64748B' }}>:</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>{data.voucherDate}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '95px 12px 1fr', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Due Date</span>
              <span style={{ color: '#64748B' }}>:</span>
              <span style={{ color: '#0F172A', fontWeight: 600 }}>{data.dueDate}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '95px 12px 1fr', alignItems: 'center' }}>
              <span style={{ color: '#475569' }}>Payment Terms</span>
              <span style={{ color: '#64748B' }}>:</span>
              <span style={{ color: '#0F172A', fontWeight: 500 }}>{data.paymentTerms}</span>
            </div>

            {data.placeOfSupply && (
              <div style={{ display: 'grid', gridTemplateColumns: '95px 12px 1fr', alignItems: 'center' }}>
                <span style={{ color: '#475569' }}>Place of Supply</span>
                <span style={{ color: '#64748B' }}>:</span>
                <strong style={{ color: '#0F172A' }}>{data.placeOfSupply}</strong>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: BILL TO & OPTIONAL SHIP TO CARDS ─── */}
      <div
        style={{
          borderTop: '1px solid #F1F5F9',
          borderBottom: '1px solid #F1F5F9',
          paddingTop: '14px',
          paddingBottom: '16px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: data.hasShippingAddress ? '1.1fr 1fr' : '1fr',
          gap: '24px'
        }}
      >
        {/* Bill To */}
        <div>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 800,
              color: '#EA580C',
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              marginBottom: '4px'
            }}
          >
            BILL TO
          </div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
            {data.partyName}
          </div>
          {data.partyAddress && (
            <div style={{ color: '#475569', fontSize: '11px', marginBottom: '6px', whiteSpace: 'pre-line' }}>
              {data.partyAddress}
            </div>
          )}
          {showCustomerContact && (data.partyPhone || data.partyEmail) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#475569' }}>
              {data.partyPhone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={11} color="#EA580C" />
                  <span>{data.partyPhone}</span>
                </div>
              )}
              {data.partyEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail size={11} color="#EA580C" />
                  <span>{data.partyEmail}</span>
                </div>
              )}
            </div>
          )}
          {data.partyGstin && (
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              <span style={{ color: '#64748B' }}>GSTIN: </span>
              <strong style={{ fontFamily: 'monospace' }}>{data.partyGstin}</strong>
            </div>
          )}
        </div>

        {/* Ship To (Optional) */}
        {data.hasShippingAddress && (
          <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '20px' }}>
            <div
              style={{
                fontSize: '10.5px',
                fontWeight: 800,
                color: '#EA580C',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              SHIP TO <span style={{ color: '#94A3B8', fontWeight: 500 }}>(Optional)</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '2px' }}>
              {data.shipToName || data.partyName}
            </div>
            <div style={{ color: '#475569', fontSize: '11px', whiteSpace: 'pre-line' }}>
              {data.shipToAddress || data.partyAddress}
            </div>
          </div>
        )}
      </div>

      {/* ─── SECTION 3: ITEMS TABLE ─── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '20px',
          fontSize: '11.5px'
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: '#FFF7ED',
              color: '#0F172A',
              borderTop: '1px solid #FED7AA',
              borderBottom: '1px solid #FED7AA',
              textAlign: 'left'
            }}
          >
            <th style={{ padding: '8px 10px', width: '28px', textAlign: 'center', fontWeight: 700 }}>#</th>
            <th style={{ padding: '8px 10px', fontWeight: 700 }}>
              Description
              <div style={{ fontSize: '9px', fontWeight: 400, color: '#9A3412', marginTop: '1px' }}>
                (Item with Serial No. or Item Description)
              </div>
            </th>
            {showHsn && (
              <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center', fontWeight: 700 }}>
                HSN
              </th>
            )}
            <th style={{ padding: '8px 10px', width: '42px', textAlign: 'center', fontWeight: 700 }}>Qty</th>
            {showUnit && (
              <th style={{ padding: '8px 10px', width: '48px', textAlign: 'center', fontWeight: 700 }}>Unit</th>
            )}
            <th style={{ padding: '8px 10px', width: '80px', textAlign: 'right', fontWeight: 700 }}>
              Rate (₹)
            </th>
            <th style={{ padding: '8px 10px', width: '56px', textAlign: 'center', fontWeight: 700 }}>Tax %</th>
            <th style={{ padding: '8px 10px', width: '90px', textAlign: 'right', fontWeight: 700 }}>
              Amount (₹)
            </th>
          </tr>
        </thead>
        <tbody>
          {data.lines.length > 0 ? (
            data.lines.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  verticalAlign: 'top'
                }}
              >
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748B' }}>
                  {item.index}
                </td>
                <td style={{ padding: '9px 10px' }}>
                  <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.itemName}</div>
                  {item.serialNumber && (
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                      S/N: {item.serialNumber}
                    </div>
                  )}
                  {item.description && (
                    <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px', whiteSpace: 'pre-line' }}>
                      {item.description}
                    </div>
                  )}
                </td>
                {showHsn && (
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                    {item.hsnSac || '—'}
                  </td>
                )}
                <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>
                  {item.quantity}
                </td>
                {showUnit && (
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748B' }}>
                    {item.unit}
                  </td>
                )}
                <td style={{ padding: '9px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatCurrency(item.rate)}
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'center', color: '#475569' }}>
                  {item.taxPercent}%
                </td>
                <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>
                No line items present.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ─── SECTION 4: AMOUNT IN WORDS & TOTALS SUMMARY ─── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          gap: '24px',
          alignItems: 'start',
          marginBottom: '28px'
        }}
      >
        {/* Left: Amount in Words */}
        <div>
          {showAmtWords && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>
                Amount in Words
              </div>
              <div
                style={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '11.5px',
                  fontWeight: 500,
                  color: '#334155'
                }}
              >
                {data.amountInWords}
              </div>
            </div>
          )}
        </div>

        {/* Right: Sub Total, Taxes, Grand Total Card */}
        <div>
          <div
            style={{
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              overflow: 'hidden',
              fontSize: '11.5px'
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 20px 1fr',
                padding: '6px 12px',
                borderBottom: '1px solid #F1F5F9',
                color: '#475569'
              }}
            >
              <span>Sub Total</span>
              <span style={{ textAlign: 'center' }}>₹</span>
              <span style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#0F172A' }}>
                {formatCurrency(data.subTotal)}
              </span>
            </div>

            {showTaxBreakdown &&
              data.taxBreakdowns.map((tb, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 20px 1fr',
                    padding: '5px 12px',
                    borderBottom: '1px solid #F1F5F9',
                    color: '#475569'
                  }}
                >
                  <span>{tb.label}</span>
                  <span style={{ textAlign: 'center' }}>₹</span>
                  <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                    {formatCurrency(tb.amount)}
                  </span>
                </div>
              ))}

            {/* Grand Total Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 20px 1fr',
                padding: '9px 12px',
                backgroundColor: '#FFEDD5',
                alignItems: 'center'
              }}
            >
              <strong style={{ fontSize: '13px', color: '#EA580C' }}>Grand Total</strong>
              <span style={{ textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>₹</span>
              <strong
                style={{
                  textAlign: 'right',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  color: '#0F172A'
                }}
              >
                {formatCurrency(data.grandTotal)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 5: FOOTER (TERMS, BANK DETAILS, SIGNATORY) ─── */}
      <div
        style={{
          borderTop: '1px solid #E2E8F0',
          paddingTop: '18px',
          display: 'grid',
          gridTemplateColumns: data.hasBankDetails && showBankDetails ? '1.2fr 1.1fr 1fr' : '1.5fr 1fr',
          gap: '20px',
          fontSize: '11px',
          alignItems: 'start'
        }}
      >
        {/* Column 1: Terms & Conditions */}
        {showTerms && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#EA580C',
                marginBottom: '6px'
              }}
            >
              Terms & Conditions
            </div>
            <div style={{ color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
              {data.termsAndConditions}
            </div>
          </div>
        )}

        {/* Column 2: Bank Details (displayed ONLY when configured) */}
        {showBankDetails && data.hasBankDetails && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#EA580C',
                marginBottom: '6px'
              }}
            >
              Bank Details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', color: '#475569' }}>
              {data.bankName && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 10px 1fr' }}>
                  <span style={{ color: '#64748B' }}>Bank Name</span>
                  <span>:</span>
                  <strong style={{ color: '#0F172A' }}>{data.bankName}</strong>
                </div>
              )}
              {data.bankAccountName && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 10px 1fr' }}>
                  <span style={{ color: '#64748B' }}>Account Name</span>
                  <span>:</span>
                  <span>{data.bankAccountName}</span>
                </div>
              )}
              {data.bankAccountNo && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 10px 1fr' }}>
                  <span style={{ color: '#64748B' }}>Account No</span>
                  <span>:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{data.bankAccountNo}</strong>
                </div>
              )}
              {data.bankIfsc && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 10px 1fr' }}>
                  <span style={{ color: '#64748B' }}>IFSC Code</span>
                  <span>:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{data.bankIfsc}</strong>
                </div>
              )}
              {data.bankBranch && (
                <div style={{ display: 'grid', gridTemplateColumns: '80px 10px 1fr' }}>
                  <span style={{ color: '#64748B' }}>Branch</span>
                  <span>:</span>
                  <span>{data.bankBranch}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Column 3: Authorized Signatory (Blank space for manual signing) */}
        {showSignature && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Blank signature space for authorized signatory to sign physically */}
            <div style={{ height: '48px', width: '100%' }} />
            <div
              style={{
                width: '160px',
                borderTop: '1px solid #94A3B8',
                paddingTop: '6px',
                fontSize: '10.5px',
                color: '#475569'
              }}
            >
              <div>Authorized Signatory</div>
              <div style={{ fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
                For {data.companyName}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── OPTIONAL LEDGERFLOW WORDMARK (BOTTOM-LEFT FOOTER) ─── */}
      {showLedgerflowWordmark && (
        <div
          className="invoice-wordmark-footer"
          style={{
            marginTop: '20px',
            paddingTop: '8px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10.5px',
            color: '#94A3B8',
            lineHeight: 1
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontWeight: 700, color: '#334155', letterSpacing: '-0.2px' }}>Ledger</span>
            <span style={{ fontWeight: 800, color: '#EA580C', letterSpacing: '-0.2px' }}>Flow</span>
            <span style={{ fontSize: '9px', color: '#94A3B8', marginLeft: '3px' }}>ERP</span>
          </div>
          <div style={{ fontSize: '9px', color: '#94A3B8' }}>
            Original for Recipient
          </div>
        </div>
      )}
    </div>
  );
};
