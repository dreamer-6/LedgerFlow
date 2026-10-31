import React, { useMemo } from 'react';
import {
  NormalizedInvoiceData,
  InvoiceVisibilityOptions,
  formatCurrency,
  formatWarrantyDisplay
} from './InvoiceAdapter';
import { Phone, Mail, Globe } from 'lucide-react';
import {
  paginateItems,
  estimateItemRowHeight,
  DEFAULT_A4_PAGINATION_CONFIG,
  getPaginationConfigForFormat
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
    showBillTo = true,
    showShipTo = true,
    shipToMode = 'SHOW',
    showHsn = true,
    showUnit = true,
    showTaxBreakdown = true,
    showAmtWords = true,
    showBankDetails = true,
    showTerms = true,
    showSignature = true,
    showSerial = true,
    showGridLines = true,
    showLedgerflowWordmark = false,
    warrantyDisplayFormat = 'Years',
    pageSize = 'A4',
    orientation = 'PORTRAIT',
    paperMargin = 'normal'
  } = options;

  const effectiveShipToMode = shipToMode || (showShipTo ? 'SHOW' : 'HIDE');
  const shouldShowShipTo = showShipTo !== false && effectiveShipToMode !== 'HIDE';

  const hasGstin = Boolean(data.companyGstin && data.companyGstin.trim());
  const hasPan = Boolean(data.companyPan && data.companyPan.trim());
  const compStateName = data.companyState || (data.placeOfSupply ? data.placeOfSupply.replace(/\s*\(\d+\)/, '') : '');
  const compStateCode = data.companyStateCode || (data.placeOfSupply && data.placeOfSupply.match(/\((\d+)\)/) ? data.placeOfSupply.match(/\((\d+)\)/)?.[1] : '');
  const companyStateDisplay = compStateName ? (compStateCode ? `${compStateName} (${compStateCode})` : compStateName) : data.placeOfSupply;
  const hasState = Boolean(companyStateDisplay && companyStateDisplay.trim());
  const hasContacts = Boolean(data.companyPhone || data.companyEmail || data.companyWebsite);

  // Paper & dimension calculations
  const isLandscape = orientation === 'LANDSCAPE' || pageSize === 'A4_LANDSCAPE' || pageSize === 'A5_LANDSCAPE' || pageSize === 'LETTER_LANDSCAPE';
  const isA5 = pageSize === 'A5' || pageSize === 'A5_PORTRAIT' || pageSize === 'A5_LANDSCAPE';
  const isLetter = pageSize === 'LETTER' || pageSize === 'LETTER_LANDSCAPE';

  let containerMaxWidth = '840px';
  let sheetMinHeight = '1080px';
  let printSheetMinHeight = '285mm';

  if (isLandscape) {
    containerMaxWidth = isA5 ? '800px' : isLetter ? '1100px' : '1120px';
    sheetMinHeight = isA5 ? '560px' : '760px';
    printSheetMinHeight = isA5 ? '140mm' : isLetter ? '205mm' : '200mm';
  } else if (isA5) {
    containerMaxWidth = '590px';
    sheetMinHeight = '820px';
    printSheetMinHeight = '200mm';
  } else if (isLetter) {
    containerMaxWidth = '850px';
    sheetMinHeight = '1050px';
    printSheetMinHeight = '270mm';
  }

  const printMarginCss = paperMargin === 'compact' ? '5mm 5mm' : paperMargin === 'spacious' ? '12mm 12mm' : '8mm 8mm';
  const printPageSizeCss = isA5
    ? (isLandscape ? 'A5 landscape' : 'A5 portrait')
    : isLetter
    ? (isLandscape ? 'letter landscape' : 'letter portrait')
    : (isLandscape ? 'A4 landscape' : 'A4 portrait');

  // Content-aware Multi-Page pagination
  const paginationConfig = useMemo(() => {
    return getPaginationConfigForFormat(pageSize, orientation);
  }, [pageSize, orientation]);

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
      paginationConfig
    );
  }, [data.lines, paginationConfig]);

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
              <div
                style={{
                  color: '#475569',
                  fontSize: '11px',
                  marginBottom: '8px',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere'
                }}
              >
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
                      <span style={{ color: '#0F172A', fontWeight: 600 }}>
                        {companyStateDisplay}
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
      <div
        style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #F1F5F9',
          borderRadius: '8px',
          padding: '14px 18px',
          textAlign: 'left'
        }}
      >
        <div style={{ marginBottom: '12px' }}>
          <div
            style={{
              fontSize: '25px',
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
              fontSize: '9px',
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
            display: 'flex',
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
  const renderParties = () => {
    if (!showBillTo && !shouldShowShipTo) return null;

    const isSameAsBilling = effectiveShipToMode === 'SAME_AS_BILLING';
    const shipName = isSameAsBilling ? data.partyName : (data.actualShipToName || data.shipToName || data.partyName);
    const shipAddress = isSameAsBilling ? data.partyAddress : (data.actualShippingAddress || data.shipToAddress || data.partyAddress);

    return (
      <div
        style={{
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: shouldShowShipTo ? '1.1fr 1fr' : '1fr',
          gap: '20px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #F1F5F9',
          borderRadius: '8px',
          padding: '12px 16px'
        }}
      >
        {/* Bill To */}
        {showBillTo && (
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#EA580C',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              BILL TO
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '2px' }}>
              {data.partyName}
            </div>
            {data.partyAddress && (
              <div
                style={{
                  color: '#475569',
                  fontSize: '11px',
                  marginBottom: '4px',
                  whiteSpace: 'pre-line',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                  lineHeight: 1.4
                }}
              >
                {data.partyAddress}
              </div>
            )}
            {showCustomerContact && (data.partyPhone || data.partyEmail) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: '#475569', marginTop: '4px' }}>
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
            {(data.partyState || data.partyStateCode) && (
              <div style={{ fontSize: '11px', marginTop: '2px', color: '#475569' }}>
                <span style={{ color: '#64748B' }}>State: </span>
                <span>
                  {data.partyState || ''} {data.partyStateCode ? `(${data.partyStateCode})` : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Ship To (Optional / Same as Billing) */}
        {shouldShowShipTo && (
          <div style={{ borderLeft: showBillTo ? '1px solid #E2E8F0' : 'none', paddingLeft: showBillTo ? '20px' : '0', minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#EA580C',
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>SHIP TO</span>
              <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: '10px', textTransform: 'none' }}>
                {isSameAsBilling ? '(Same as Billing)' : '(Optional)'}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginBottom: '2px' }}>
              {shipName}
            </div>
            <div
              style={{
                color: '#475569',
                fontSize: '11px',
                whiteSpace: 'pre-line',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                lineHeight: 1.4
              }}
            >
              {shipAddress}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Section 3: Line Items Table (Headers repeated on each page, Full-Height vertical column borders)
  const renderItemsTable = (items: typeof data.lines, minTableHeight: number = 280) => {
    const cellBorder = showGridLines ? '1px solid #E2E8F0' : undefined;

    return (
      <div
        className="invoice-table-wrapper"
        style={{
          width: '100%',
          flex: '1 1 auto',
          minHeight: `${minTableHeight}px`,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '16px'
        }}
      >
        <table
          style={{
            width: '100%',
            height: '100%',
            minHeight: `${minTableHeight}px`,
            borderCollapse: 'collapse',
            fontSize: '11.5px',
            borderTop: '1px solid #FED7AA',
            borderBottom: '1.5px solid #CBD5E1',
            borderLeft: cellBorder,
            borderRight: cellBorder,
            tableLayout: 'fixed'
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#FFF7ED',
                color: '#0F172A',
                borderBottom: '1px solid #FED7AA',
                textAlign: 'left'
              }}
            >
              <th style={{ padding: '8px 10px', width: '32px', textAlign: 'center', fontWeight: 700, borderRight: cellBorder }}>#</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, borderRight: cellBorder }}>
                Description
                <div style={{ fontSize: '9px', fontWeight: 400, color: '#9A3412', marginTop: '1px' }}>
                  (Item with Serial No. or Details)
                </div>
              </th>
              {showHsn && (
                <th style={{ padding: '8px 10px', width: '75px', textAlign: 'center', fontWeight: 700, borderRight: cellBorder }}>
                  HSN/SAC
                </th>
              )}
              <th style={{ padding: '8px 10px', width: '45px', textAlign: 'center', fontWeight: 700, borderRight: cellBorder }}>Qty</th>
              {showUnit && (
                <th style={{ padding: '8px 10px', width: '48px', textAlign: 'center', fontWeight: 700, borderRight: cellBorder }}>Unit</th>
              )}
              <th style={{ padding: '8px 10px', width: '85px', textAlign: 'right', fontWeight: 700, borderRight: cellBorder }}>
                Rate (₹)
              </th>
              <th style={{ padding: '8px 10px', width: '56px', textAlign: 'center', fontWeight: 700, borderRight: cellBorder }}>Tax %</th>
              <th style={{ padding: '8px 10px', width: '95px', textAlign: 'right', fontWeight: 700 }}>
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
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B', borderRight: cellBorder }}>
                    {item.index}
                  </td>
                  <td style={{ padding: '8px 10px', borderRight: cellBorder }}>
                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.itemName}</div>
                    {showSerial && item.serialNumber && (
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
                        S/N: {item.serialNumber}
                      </div>
                    )}
                    {showSerial && Boolean(item.warrantyMonths) && (
                      <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px', fontWeight: 500 }}>
                        Warranty: {formatWarrantyDisplay(item.warrantyMonths, warrantyDisplayFormat)}
                      </div>
                    )}
                    {item.description && (
                      <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px', whiteSpace: 'pre-line' }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  {showHsn && (
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontFamily: 'monospace', color: '#475569', borderRight: cellBorder }}>
                      {item.hsnSac || '—'}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, borderRight: cellBorder }}>
                    {item.quantity}
                  </td>
                  {showUnit && (
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B', borderRight: cellBorder }}>
                      {item.unit}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace', borderRight: cellBorder }}>
                    {formatCurrency(item.rate)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: '#475569', borderRight: cellBorder }}>
                    {item.taxPercent}%
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                    {formatCurrency(item.amount)}
                  </td>
                </tr>
              ))
            ) : null}

            {/* Continuous vertical column borders stretching through available height */}
            <tr
              className="table-filler-row"
              style={{
                height: '100%',
                borderBottom: 'none'
              }}
            >
              <td style={{ padding: '0 10px', borderRight: cellBorder }}>&nbsp;</td>
              <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>
              {showHsn && <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>}
              <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>
              {showUnit && <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>}
              <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>
              <td style={{ padding: '0 10px', borderRight: cellBorder }}></td>
              <td style={{ padding: '0 10px' }}></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

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

          {data.roundOff !== undefined && Math.abs(data.roundOff) >= 0.005 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 20px 1fr',
                padding: '5px 12px',
                borderBottom: '1px solid #F1F5F9',
                color: '#475569'
              }}
            >
              <span>Round Off</span>
              <span style={{ textAlign: 'center' }}>₹</span>
              <span style={{ textAlign: 'right', fontFamily: 'monospace', color: '#0F172A' }}>
                {formatCurrency(data.roundOff)}
              </span>
            </div>
          )}

          {/* Grand Total Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 20px 1fr',
              padding: '10px 12px',
              backgroundColor: '#FFEDD5',
              alignItems: 'center'
            }}
          >
            <strong style={{ fontSize: '13.5px', color: '#EA580C' }}>Grand Total</strong>
            <span style={{ textAlign: 'center', fontWeight: 800, color: '#0F172A' }}>₹</span>
            <strong
              style={{
                textAlign: 'right',
                fontFamily: 'monospace',
                fontSize: '15px',
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

  // Section 5: Terms, Bank Details, Signatory (Bottom Aligned)
  const renderFooter = () => (
    <div
      style={{
        borderTop: '1px solid #E2E8F0',
        paddingTop: '16px',
        display: 'grid',
        gridTemplateColumns: data.hasBankDetails && showBankDetails ? '1.2fr 1.1fr 1fr' : '1.5fr 1fr',
        gap: '20px',
        fontSize: '11px',
        alignItems: 'end'
      }}
    >
      {/* Column 1: Terms & Conditions */}
      {showTerms && (
        <div style={{ alignSelf: 'end' }}>
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
          <div style={{ color: '#475569', whiteSpace: 'pre-line', lineHeight: 1.5, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
            {data.termsAndConditions}
          </div>
        </div>
      )}

      {/* Column 2: Bank Details (Strictly if configured) */}
      {showBankDetails && data.hasBankDetails && (
        <div style={{ alignSelf: 'end' }}>
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

      {/* Column 3: Authorized Signatory (Aligned to bottom portion of footer) */}
      {showSignature && (
        <div
          style={{
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            alignSelf: 'end',
            paddingTop: '20px'
          }}
        >
          <div style={{ minHeight: '48px', width: '100%' }} />
          <div
            style={{
              width: '180px',
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

  const getMinTableHeight = (page: (typeof pages)[0]) => {
    if (isLandscape) {
      if (isA5) {
        return page.hasFooter ? (page.isFirstPage ? 140 : 200) : (page.isFirstPage ? 220 : 300);
      }
      return page.hasFooter ? (page.isFirstPage ? 220 : 360) : (page.isFirstPage ? 360 : 500);
    }
    if (isA5) {
      return page.hasFooter ? (page.isFirstPage ? 240 : 380) : (page.isFirstPage ? 380 : 540);
    }
    // A4 / Letter portrait
    if (page.hasFooter) {
      return page.isFirstPage ? (shouldShowShipTo ? 440 : 490) : 660;
    } else {
      return page.isFirstPage ? 720 : 920;
    }
  };

  return (
    <div
      id={id}
      className="standard-invoice-container"
      style={{
        width: '100%',
        maxWidth: containerMaxWidth,
        margin: '0 auto',
        backgroundColor: 'transparent',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @page {
          size: ${printPageSizeCss};
          margin: ${printMarginCss};
        }
        @media print {
          body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .standard-invoice-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-page-sheet {
            page-break-after: always;
            break-after: page;
            min-height: ${printSheetMinHeight};
            box-sizing: border-box;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
            border: none !important;
            display: flex;
            flex-direction: column;
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
          id={`page-sheet-${page.pageIndex}`}
          className="a4-page-sheet"
          style={{
            width: '100%',
            backgroundColor: '#FFFFFF',
            color: '#0F172A',
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: '12px',
            lineHeight: 1.45,
            padding: '24px 28px',
            borderRadius: '4px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            margin: '0 auto 24px auto',
            minHeight: sheetMinHeight,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Top Header Region (First page or Continuation) */}
          <div style={{ flexShrink: 0 }}>
            {page.isFirstPage ? (
              <>
                {renderHeader()}
                {renderParties()}
              </>
            ) : (
              renderContinuationHeader(page.pageIndex + 1, page.totalPages)
            )}
          </div>

          {/* Full-Height Line Items Table */}
          {renderItemsTable(page.items, getMinTableHeight(page))}

          {/* Bottom Region: Totals & Footer */}
          {page.hasFooter && (
            <div style={{ flexShrink: 0, marginTop: '8px' }}>
              {renderTotals()}
              {renderFooter()}

              {showLedgerflowWordmark && (
                <div
                  className="invoice-wordmark-footer"
                  style={{
                    marginTop: '16px',
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
            </div>
          )}

          {/* Bottom Page Numbering Bar */}
          <div
            style={{
              flexShrink: 0,
              marginTop: 'auto',
              paddingTop: '10px',
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
