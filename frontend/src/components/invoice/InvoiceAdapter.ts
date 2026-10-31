export interface InvoiceLineItem {
  index: number;
  itemName: string;
  description?: string;
  serialNumber?: string;
  warrantyMonths?: number;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
  amount: number;
  taxableAmount: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
}

export interface InvoiceTaxBreakdown {
  label: string;
  percent: number;
  amount: number;
}

export interface NormalizedInvoiceData {
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  referenceNumber?: string;
  referenceDate?: string;
  voucherType: string;
  status: string;
  dueDate: string;
  paymentTerms: string;
  placeOfSupply: string;
  
  // Company (Seller / Supplier)
  companyName: string;
  companyAddress: string;
  companyCity?: string;
  companyState?: string;
  companyStateCode?: string;
  companyPincode?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyGstin?: string;
  companyPan?: string;
  companyLogo?: string;
  
  // Buyer / Bill To
  partyName: string;
  partyAddress: string;
  partyCity?: string;
  partyState?: string;
  partyStateCode?: string;
  partyPincode?: string;
  partyPhone?: string;
  partyEmail?: string;
  partyGstin?: string;
  partyPan?: string;
  
  // Ship To (Optional)
  hasShippingAddress: boolean;
  actualShippingAddress?: string;
  actualShipToName?: string;
  shipToName?: string;
  shipToAddress?: string;

  // Items
  lines: InvoiceLineItem[];
  
  // Totals & Taxes
  subTotal: number;
  taxTotal: number;
  taxBreakdowns: InvoiceTaxBreakdown[];
  roundOff?: number;
  grandTotal: number;
  amountInWords: string;
  
  // Bank Details (only when configured)
  hasBankDetails: boolean;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  bankBranch?: string;
  
  // Terms & Conditions
  termsAndConditions?: string;
}

export type ShipToDisplayMode = 'SHOW' | 'SAME_AS_BILLING' | 'HIDE';

export interface InvoiceVisibilityOptions {
  showLogo?: boolean;
  showCompanyDetails?: boolean;
  showCustomerContact?: boolean;
  showBillTo?: boolean;
  showShipTo?: boolean;
  shipToMode?: ShipToDisplayMode;
  showHsn?: boolean;
  showUnit?: boolean;
  showTaxBreakdown?: boolean;
  showAmtWords?: boolean;
  showBankDetails?: boolean;
  showTerms?: boolean;
  showSignature?: boolean;
  showSerial?: boolean;
  showGridLines?: boolean;
  showLedgerflowWordmark?: boolean;
  warrantyDisplayFormat?: 'Years' | 'Months' | 'Both';
  pageSize?: 'A4' | 'A4_LANDSCAPE' | 'A5' | 'A5_PORTRAIT' | 'A5_LANDSCAPE' | 'LETTER' | 'LETTER_LANDSCAPE' | 'THERMAL' | 'THERMAL_80' | 'THERMAL_58';
  orientation?: 'PORTRAIT' | 'LANDSCAPE';
  paperMargin?: 'compact' | 'normal' | 'spacious';
}

/**
 * Format warranty months into readable format (Years, Months, Both)
 * e.g. 12m -> 1 Year, 24m -> 2 Years, 18m -> 1.5 Years
 */
export function formatWarrantyDisplay(
  months?: number | string | null,
  format: 'Years' | 'Months' | 'Both' = 'Years'
): string | null {
  if (months == null) return null;
  const num = typeof months === 'string' ? parseInt(months, 10) : months;
  if (isNaN(num) || num <= 0) return null;

  const isExactYears = num % 12 === 0;
  const yearsVal = num / 12;
  const yearsStr = isExactYears
    ? `${yearsVal} ${yearsVal === 1 ? 'Year' : 'Years'}`
    : `${yearsVal.toFixed(1).replace(/\.0$/, '')} Years`;
  const monthsStr = `${num} ${num === 1 ? 'Month' : 'Months'}`;

  if (format === 'Months') {
    return monthsStr;
  }
  if (format === 'Both') {
    return isExactYears ? `${yearsStr} (${monthsStr})` : `${yearsStr} (${monthsStr})`;
  }
  // format === 'Years'
  return num >= 12 ? yearsStr : monthsStr;
}

export function numberToIndianWords(paiseAmount: number): string {
  const num = Math.round(paiseAmount);
  if (num === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10] + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + ' Crore ' + inWords(n % 10000000);
  };

  const rupees = Math.floor(num / 100);
  const paise = num % 100;
  
  let str = 'Rupees ' + inWords(rupees).trim();
  if (paise > 0) {
    str += ' and ' + inWords(paise).trim() + ' Paise';
  }
  return str + ' Only';
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function normalizeInvoiceData(rawVoucherData: any, company: any): NormalizedInvoiceData {
  const v = rawVoucherData?.voucher || rawVoucherData || {};
  const rawLines: any[] = rawVoucherData?.lines || v.lines || [];

  const isPurchase = v.voucher_type === 'PURCHASE';

  // Company address formatting
  // Company address formatting (wrapped across natural lines)
  const compLine1 = [company?.address_line1, company?.address_line2].filter(Boolean).join(', ');
  const compLine2 = [
    company?.city,
    company?.state ? (company?.pincode ? `${company.state} - ${company.pincode}` : company.state) : company?.pincode,
    company?.country
  ].filter(Boolean).join(', ');
  const compAddressStr = [compLine1, compLine2].filter(Boolean).join('\n') || company?.address || '';

  // Buyer / Party address formatting (wrapped across natural lines)
  const partyLine1 = [v.address_line1, v.address_line2].filter(Boolean).join(', ');
  const partyLine2 = [
    v.city,
    v.state ? (v.pincode ? `${v.state} - ${v.pincode}` : v.state) : v.pincode,
    v.country
  ].filter(Boolean).join(', ');
  const partyAddressStr = [partyLine1, partyLine2].filter(Boolean).join('\n') || v.party_address || '';

  // Shipping address formatting
  const shipLine1 = [v.shipping_address_line1 || v.shipping_address, v.shipping_address_line2].filter(Boolean).join(', ');
  const shipLine2 = [
    v.shipping_city,
    v.shipping_state ? (v.shipping_pincode ? `${v.shipping_state} - ${v.shipping_pincode}` : v.shipping_state) : v.shipping_pincode,
    v.shipping_country
  ].filter(Boolean).join(', ');
  const shipAddressStr = [shipLine1, shipLine2].filter(Boolean).join('\n');
  const hasShipping = Boolean(shipAddressStr.trim() || v.shipping_party_name);

  // Normalize line items
  let totalTaxablePaise = 0;
  let totalCgstPaise = 0;
  let totalSgstPaise = 0;
  let totalIgstPaise = 0;

  const lines: InvoiceLineItem[] = rawLines.map((line: any, idx: number) => {
    const qty = Number(line.quantity || 1);
    const ratePaise = Number(line.rate_paise ?? Math.round((line.rate || 0) * 100));
    const taxablePaise = Number(
      line.taxable_amount_paise ?? (line.amount_paise ? line.amount_paise - (line.tax_amount_paise || 0) : qty * ratePaise)
    );

    const cgstPaise = Number(line.cgst_amount_paise || 0);
    const sgstPaise = Number(line.sgst_amount_paise || 0);
    const igstPaise = Number(line.igst_amount_paise || 0);

    // Accurate Tax Rate calculation: Inspect voucher_line gst_rate, item_gst_rate, or compute from taxes
    let taxRate = 0;
    if (line.gst_rate !== undefined && line.gst_rate !== null && line.gst_rate !== '') {
      taxRate = Number(line.gst_rate);
    } else if (line.tax_rate !== undefined && line.tax_rate !== null && line.tax_rate !== '') {
      taxRate = Number(line.tax_rate);
    } else if (line.tax_percent !== undefined && line.tax_percent !== null && line.tax_percent !== '') {
      taxRate = Number(line.tax_percent);
    } else if (line.tax_pct !== undefined && line.tax_pct !== null && line.tax_pct !== '') {
      taxRate = Number(line.tax_pct);
    } else if (line.item_gst_rate !== undefined && line.item_gst_rate !== null && line.item_gst_rate !== '') {
      taxRate = Number(line.item_gst_rate);
    } else if (taxablePaise > 0) {
      const lineTaxPaise = cgstPaise + sgstPaise + igstPaise;
      if (lineTaxPaise > 0) {
        taxRate = Math.round((lineTaxPaise / taxablePaise) * 100);
      }
    }

    const lineTotalPaise = Number(
      line.total_amount_paise ?? line.amount_paise ?? (taxablePaise + Math.round((taxablePaise * taxRate) / 100))
    );

    totalTaxablePaise += taxablePaise;
    totalCgstPaise += cgstPaise;
    totalSgstPaise += sgstPaise;
    totalIgstPaise += igstPaise;

    // Unit fallback: actual configured unit, or "—" fallback (never invent unit)
    const rawUnit = (line.unit_symbol || line.unit_name || line.unit || '').trim();
    const unitDisplay = rawUnit ? rawUnit : '—';

    // Warranty duration in authoritative unit (months)
    const rawWarranty = line.warranty_months ?? line.item_warranty_months ?? line.warrantyMonths;
    const warrantyMonths = rawWarranty ? Number(rawWarranty) : undefined;

    return {
      index: idx + 1,
      itemName: line.item_name || line.description || 'Item / Service',
      description: line.item_name && line.description && line.description !== line.item_name ? line.description : undefined,
      serialNumber: line.serial_number || undefined,
      warrantyMonths: warrantyMonths,
      hsnSac: line.hsn_sac || line.hsnSac || '',
      quantity: qty,
      unit: unitDisplay,
      rate: ratePaise / 100,
      taxPercent: taxRate,
      amount: lineTotalPaise / 100,
      taxableAmount: taxablePaise / 100,
      cgstAmount: cgstPaise / 100,
      sgstAmount: sgstPaise / 100,
      igstAmount: igstPaise / 100
    };
  });

  // Authoritative totals from voucher header
  const headerTotalPaise = Number(v.total_amount_paise ?? (v.amount ? Math.round(v.amount * 100) : 0));
  const subTotalPaise = totalTaxablePaise > 0 ? totalTaxablePaise : (headerTotalPaise - (Number(v.tax_amount_paise || 0)));
  const subTotal = subTotalPaise / 100;
  const grandTotal = headerTotalPaise > 0 ? headerTotalPaise / 100 : (subTotalPaise + totalCgstPaise + totalSgstPaise + totalIgstPaise) / 100;

  // Tax breakdowns
  const taxBreakdowns: InvoiceTaxBreakdown[] = [];
  if (totalCgstPaise > 0 || (v.cgst_amount_paise && v.cgst_amount_paise > 0)) {
    const cgstVal = (v.cgst_amount_paise || totalCgstPaise) / 100;
    const effPct = subTotal > 0 ? Math.round((cgstVal / subTotal) * 100 * 10) / 10 : 9;
    taxBreakdowns.push({ label: `CGST (${effPct}%)`, percent: effPct, amount: cgstVal });
  }
  if (totalSgstPaise > 0 || (v.sgst_amount_paise && v.sgst_amount_paise > 0)) {
    const sgstVal = (v.sgst_amount_paise || totalSgstPaise) / 100;
    const effPct = subTotal > 0 ? Math.round((sgstVal / subTotal) * 100 * 10) / 10 : 9;
    taxBreakdowns.push({ label: `SGST (${effPct}%)`, percent: effPct, amount: sgstVal });
  }
  if (totalIgstPaise > 0 || (v.igst_amount_paise && v.igst_amount_paise > 0)) {
    const igstVal = (v.igst_amount_paise || totalIgstPaise) / 100;
    const effPct = subTotal > 0 ? Math.round((igstVal / subTotal) * 100 * 10) / 10 : 18;
    taxBreakdowns.push({ label: `IGST (${effPct}%)`, percent: effPct, amount: igstVal });
  }

  // If no detailed taxes were logged but voucher has a total tax
  if (taxBreakdowns.length === 0 && Number(v.tax_amount_paise || 0) > 0) {
    const totalTaxVal = Number(v.tax_amount_paise) / 100;
    taxBreakdowns.push({ label: 'Tax', percent: 0, amount: totalTaxVal });
  }

  const taxTotal = taxBreakdowns.reduce((acc, curr) => acc + curr.amount, 0);

  // Bank details presence
  const hasBank = Boolean(company?.bank_name?.trim() || company?.bank_account_no?.trim());

  // Place of Supply
  const posState = v.state || company?.state;
  const posCode = v.state_code || company?.state_code;
  const posStr = posState ? (posCode ? `${posState} (${posCode})` : posState) : '';

  // Dates
  const vDate = v.reference_date || v.voucher_date || new Date().toISOString().split('T')[0];
  const formattedDate = formatDateDisplay(vDate);
  const formattedDueDate = formatDateDisplay(v.due_date || vDate);

  return {
    voucherId: v.voucher_id || '',
    voucherNumber: v.reference_number || v.voucher_number || 'INV-0001',
    voucherDate: formattedDate,
    referenceNumber: v.reference_number,
    referenceDate: v.reference_date ? formatDateDisplay(v.reference_date) : undefined,
    voucherType: v.voucher_type || 'SALES',
    status: v.status || 'POSTED',
    dueDate: formattedDueDate,
    paymentTerms: v.payment_terms || v.payment_mode || 'Immediate',
    placeOfSupply: posStr,

    companyName: !isPurchase ? (company?.company_name || 'Business Name') : (v.party_name || 'Supplier'),
    companyAddress: !isPurchase ? compAddressStr : partyAddressStr,
    companyCity: !isPurchase ? company?.city : v.city,
    companyState: !isPurchase ? company?.state : v.state,
    companyStateCode: !isPurchase ? company?.state_code : v.state_code,
    companyPincode: !isPurchase ? company?.pincode : v.pincode,
    companyPhone: !isPurchase ? company?.phone : v.phone,
    companyEmail: !isPurchase ? company?.email : v.email,
    companyWebsite: !isPurchase ? company?.website : undefined,
    companyGstin: !isPurchase ? company?.gstin : v.party_gstin,
    companyPan: !isPurchase ? company?.pan : v.party_pan,
    companyLogo: !isPurchase ? company?.logo_base64 : undefined,

    partyName: !isPurchase ? (v.party_name || 'Cash Customer') : (company?.company_name || 'Buyer'),
    partyAddress: !isPurchase ? partyAddressStr : compAddressStr,
    partyCity: !isPurchase ? v.city : company?.city,
    partyState: !isPurchase ? v.state : company?.state,
    partyStateCode: !isPurchase ? v.state_code : company?.state_code,
    partyPincode: !isPurchase ? v.pincode : company?.pincode,
    partyPhone: !isPurchase ? v.phone : company?.phone,
    partyEmail: !isPurchase ? v.email : company?.email,
    partyGstin: !isPurchase ? v.party_gstin : company?.gstin,
    partyPan: !isPurchase ? v.party_pan : company?.pan,

    hasShippingAddress: hasShipping,
    actualShippingAddress: shipAddressStr.trim() ? shipAddressStr : undefined,
    actualShipToName: v.shipping_party_name || undefined,
    shipToName: v.shipping_party_name || v.party_name,
    shipToAddress: shipAddressStr.trim() ? shipAddressStr : partyAddressStr,

    lines,
    subTotal,
    taxTotal,
    taxBreakdowns,
    roundOff: v.round_off_paise ? Number(v.round_off_paise) / 100 : undefined,
    grandTotal,
    amountInWords: numberToIndianWords(Math.round(grandTotal * 100)),

    hasBankDetails: hasBank,
    bankName: company?.bank_name,
    bankAccountName: company?.legal_name || company?.company_name,
    bankAccountNo: company?.bank_account_no,
    bankIfsc: company?.bank_ifsc,
    bankBranch: company?.bank_branch,

    termsAndConditions: company?.terms_and_conditions || `1. Goods once sold will not be taken back or exchanged.\n2. Warranty as per manufacturer terms.\n3. Payment to be made by cheque/NEFT/UPI.\n4. Subject to local jurisdiction only.`
  };
}

function formatDateDisplay(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Normalizes a QuotationRecord into NormalizedInvoiceData for full print preview parity.
 */
export function normalizeQuotationData(quotation: any, company: any): NormalizedInvoiceData {
  const q = quotation || {};
  const cust = q.customerDetails || {};
  const rawItems: any[] = q.items || [];

  // Company address
  const compLine1 = [company?.address_line1, company?.address_line2].filter(Boolean).join(', ');
  const compLine2 = [
    company?.city,
    company?.state ? (company?.pincode ? `${company.state} - ${company.pincode}` : company.state) : company?.pincode,
    company?.country
  ].filter(Boolean).join(', ');
  const compAddressStr = [compLine1, compLine2].filter(Boolean).join('\n') || company?.address || '';

  // Customer address
  const custLine1 = cust.address;
  const custLine2 = [
    cust.city,
    cust.state ? (cust.pincode ? `${cust.state} - ${cust.pincode}` : cust.state) : cust.pincode
  ].filter(Boolean).join(', ');
  const custAddressStr = [custLine1, custLine2].filter(Boolean).join('\n') || '';

  const hasBank = !!(company?.bank_name || company?.bank_account_no);

  const lines: InvoiceLineItem[] = rawItems.map((item, idx) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.unitPrice) || 0;
    const taxRate = Number(item.gstRate) || 0;
    const taxable = Number(item.taxableAmount) || (qty * rate);
    const amount = Number(item.totalAmount) || (taxable + (Number(item.taxAmount) || 0));

    return {
      index: idx + 1,
      itemName: item.description || `Item ${idx + 1}`,
      description: item.subtext,
      serialNumber: item.itemId && String(item.itemId).startsWith('SN') ? item.itemId : undefined,
      warrantyMonths: item.warrantyMonths,
      hsnSac: item.hsnSac || '',
      quantity: qty,
      unit: item.unit || 'Nos',
      rate,
      taxPercent: taxRate,
      amount,
      taxableAmount: taxable,
      cgstAmount: item.cgst,
      sgstAmount: item.sgst,
      igstAmount: item.igst
    };
  });

  const subTotal = Number(q.subtotal) || lines.reduce((acc, l) => acc + l.taxableAmount, 0);
  const taxTotal = Number(q.taxAmount) || 0;
  const grandTotal = Number(q.totalAmount) || (subTotal + taxTotal);

  // Group tax breakdowns
  const taxBreakdowns: InvoiceTaxBreakdown[] = [];
  if (taxTotal > 0) {
    const cgstTotal = rawItems.reduce((acc, i) => acc + (Number(i.cgst) || 0), 0);
    const sgstTotal = rawItems.reduce((acc, i) => acc + (Number(i.sgst) || 0), 0);
    const igstTotal = rawItems.reduce((acc, i) => acc + (Number(i.igst) || 0), 0);

    if (cgstTotal > 0 || sgstTotal > 0) {
      const effRate = rawItems.find(i => (i.gstRate || 0) > 0)?.gstRate || 18;
      taxBreakdowns.push({ label: `CGST (${(effRate / 2).toFixed(effRate % 2 === 0 ? 0 : 1)}%)`, percent: effRate / 2, amount: cgstTotal });
      taxBreakdowns.push({ label: `SGST (${(effRate / 2).toFixed(effRate % 2 === 0 ? 0 : 1)}%)`, percent: effRate / 2, amount: sgstTotal });
    } else if (igstTotal > 0) {
      const effRate = rawItems.find(i => (i.gstRate || 0) > 0)?.gstRate || 18;
      taxBreakdowns.push({ label: `IGST (${effRate}%)`, percent: effRate, amount: igstTotal });
    } else {
      taxBreakdowns.push({ label: 'GST', percent: 18, amount: taxTotal });
    }
  }

  return {
    voucherId: q.id || 'qtn-live',
    voucherNumber: q.quotationNumber || 'QTN-PREVIEW',
    voucherDate: formatDateDisplay(q.quotationDate),
    referenceNumber: q.referenceNumber,
    voucherType: 'QUOTATION',
    status: q.status || 'DRAFT',
    dueDate: formatDateDisplay(q.validTill),
    paymentTerms: q.validTill ? `Valid till ${formatDateDisplay(q.validTill)}` : 'As per quotation terms',
    placeOfSupply: q.placeOfSupply || company?.state || '',

    companyName: company?.company_name || 'Business Name',
    companyAddress: compAddressStr,
    companyCity: company?.city,
    companyState: company?.state,
    companyStateCode: company?.state_code,
    companyPincode: company?.pincode,
    companyPhone: company?.phone,
    companyEmail: company?.email,
    companyWebsite: company?.website,
    companyGstin: company?.gstin,
    companyPan: company?.pan,
    companyLogo: company?.logo_base64 || company?.logo_url,

    partyName: cust.name || 'Valued Customer',
    partyAddress: custAddressStr,
    partyCity: cust.city,
    partyState: cust.state,
    partyPincode: cust.pincode,
    partyPhone: cust.phone,
    partyEmail: cust.email,
    partyGstin: cust.gstin,

    hasShippingAddress: false,

    lines,
    subTotal,
    taxTotal,
    taxBreakdowns,
    roundOff: undefined,
    grandTotal,
    amountInWords: numberToIndianWords(Math.round(grandTotal * 100)),

    hasBankDetails: hasBank,
    bankName: company?.bank_name,
    bankAccountName: company?.legal_name || company?.company_name,
    bankAccountNo: company?.bank_account_no,
    bankIfsc: company?.bank_ifsc,
    bankBranch: company?.bank_branch,

    termsAndConditions: q.termsConditions || company?.terms_and_conditions || `1. Goods once sold will not be taken back or exchanged.\n2. Warranty as per manufacturer terms.\n3. Prices are valid until the date stated above.\n4. This quotation is not a tax invoice.`
  };
}
