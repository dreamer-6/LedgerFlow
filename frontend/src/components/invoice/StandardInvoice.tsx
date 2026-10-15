import React, { useMemo } from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  formatCurrency
} from './InvoiceAdapter';
import { Phone, Mail, Globe } from 'lucide-react';
import {
  paginateItems,
  estimateItemRowHeight,
  DEFAULT_A4_PAGINATION_CONFIG
} from '../../utils/printPagination';

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

  // Content-aware A4 pagination
  const pages = useMemo(() => {
    if (!data.lines || data.lines.length === 0) {
      return [
        {
          pageIndex: 0,
          totalPages: 1,
          items: [],
          isFirstPage: true,
          isLastPage: true,
          hasFooter: true
        }
      ];
    }
    return paginateItems(
      data.lines,
      (item) =>
        estimateItemRowHeight({
          itemName: item.itemName,
          description: item.description,
          serialNumber: item.serialNumber
        }),
      DEFAULT_A4_PAGINATION_CONFIG
    );
  }, [data.lines]);

  // Section 1: Full Company Header + TAX INVOICE Metadata Grid (Page 1)
  const renderHeader = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.45fr 1fr',
        gap: '24px',
        alignItems: 'start',
        marginBottom: '20px'
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
                maxHeight: '52px',
                maxWidth: '120px',
                objectFit: 'contain'
              }}
            />
          )}
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.4px',
              margin: 0,
              lineHeight: 1.15
            }}
          >
            {data.companyName}
          </h1>
        </div>

        {showCompanyDetails && (
          <>
            {data.companyAddress && (
              <div style={{ color: '#475569', fontSize: '11px', marginBottom: '8px', whiteSpace: 'pre-line' }}>
                {data.companyAddress}
              </div>
            )}

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
                      <Phone size={11} color="#EA580C" />
                      <span>{data.companyPhone}</span>
                    </div>
                  )}
                  {data.companyEmail && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={11} color="#EA580C" />
                      <span>{data.companyEmail}</span>
                    </div>
                  )}
                  {data.companyWebsite && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Globe size={11} color="#EA580C" />
                      <span>{data.companyWebsite}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Statutory: GSTIN, PAN, State */}
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
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 10px 1fr' }}>
                      <span style={{ color: '#64748B' }}>GSTIN</span>
                      <span>:</span>
                      <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                        {data.companyGstin}
                      </strong>
                    </div>
                  )}
                  {hasPan && (
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 10px 1fr' }}>
                      <span style={{ color: '#64748B' }}>PAN</span>
                      <span>:</span>
                      <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                        {data.companyPan}
                      </strong>
                    </div>
                  )}
                  {hasState && (
                    <div style={{ display: 'grid', gridTemplateColumns: '48px 10px 1fr' }}>
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
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '26px',
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
            fontSize: '11px',
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
        {showLogo && data.companyLogo && (
          <img
            src={data.companyLogo}
            alt=""
            style={{ height: '22px', maxWidth: '80px', objectFit: 'contain' }}
          />
        )}
        <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '13px' }}>
          {data.companyName}
        </span>
        <span style={{ color: '#94A3B8', fontSize: '11px' }}>•</span>
        <span style={{ color: '#EA580C', fontWeight: 800, fontSize: '12px', letterSpacing: '0.02em' }}>
          {data.voucherType === 'PURCHASE' ? 'PURCHASE VOUCHER' : 'TAX INVOICE'} (Continuation)
        </span>
      </div>
      <div style={{ fontSize: '11px', color: '#475569' }}>
        <span>Invoice No: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{data.voucherNumber}</strong></span>
        <span style={{ margin: '0 8px', color: '#CBD5E1' }}>|</span>
        <span>Date: <strong style={{ color: '#0F172A' }}>{data.voucherDate}</strong></span>
      </div>
    </div>
  );

  // Section 2: Bill To & Ship To Cards
  const renderParties = () => (
    <div
      style={{
        borderTop: '1px solid #F1F5F9',
        borderBottom: '1px solid #F1F5F9',
        paddingTop: '12px',
        paddingBottom: '14px',
        marginBottom: '18px',
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
  );

  // Section 3: Line Items Table (Headers repeated on each page)
  const renderItemsTable = (items: typeof data.lines) => (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '18px',
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
        {items.length > 0 ? (
          items.map((item, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: '1px solid #F1F5F9',
                verticalAlign: 'top'
              }}
            >
              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>
                {item.index}
              </td>
              <td style={{ padding: '8px 10px' }}>
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
                <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#475569' }}>
                  {item.hsnSac || '—'}
                </td>
              )}
              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>
                {item.quantity}
              </td>
              {showUnit && (
                <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>
                  {item.unit}
                </td>
              )}
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                {formatCurrency(item.rate)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569' }}>
                {item.taxPercent}%
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
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
  );

  // Section 4: Amount in Words & Totals Summary
  const renderTotals = () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1.25fr 1fr',
        gap: '24px',
        alignItems: 'start',
        marginBottom: '24px'
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
  );

  // Section 5: Terms, Bank Details, Signatory
  const renderFooter = () => (
    <div
      style={{
        borderTop: '1px solid #E2E8F0',
        paddingTop: '16px',
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

      {/* Column 2: Bank Details (Strictly if configured) */}
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

      {/* Column 3: Authorized Signatory */}
      {showSignature && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ height: '44px', width: '100%' }} />
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
  );

  return (
    <div
      id={id}
      className="standard-invoice-container"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        backgroundColor: 'transparent',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @media print {
          .a4-page-sheet {
            page-break-after: always;
            break-after: page;
            min-height: 297mm;
            box-sizing: border-box;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 14mm 16mm !important;
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

      {pages.map((page) => (
        <div
          key={page.pageIndex}
          className="a4-page-sheet"
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: '12px',
            lineHeight: 1.45,
            padding: '36px 40px',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
            margin: '0 auto 24px auto',
            minHeight: '1060px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            {page.isFirstPage ? (
              <>
                {renderHeader()}
                {renderParties()}
              </>
            ) : (
              renderContinuationHeader(page.pageIndex + 1, page.totalPages)
            )}

            {renderItemsTable(page.items)}

            {page.hasFooter && (
              <>
                {renderTotals()}
                {renderFooter()}

                {showLedgerflowWordmark && (
                  <div
                    className="invoice-wordmark-footer"
                    style={{
                      marginTop: '18px',
                      paddingTop: '8px',
                      borderTop: '1px solid #F1F5F9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '10px',
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
              </>
            )}
          </div>

          {/* Bottom Page Numbering Bar */}
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
            <span>{data.companyName} • {data.voucherNumber}</span>
            <span style={{ fontWeight: 600, color: '#475569' }}>
              Page {page.pageIndex + 1} of {page.totalPages}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
