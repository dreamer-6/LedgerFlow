export interface InvoiceLineItem {
  index: number;
  itemName: string;
  description?: string;
  serialNumber?: string;
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
  shipToName?: string;
  shipToAddress?: string;

  // Items
  lines: InvoiceLineItem[];
  
  // Totals & Taxes
  subTotal: number;
  taxTotal: number;
  taxBreakdowns: InvoiceTaxBreakdown[];
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

export interface InvoiceVisibilityOptions {
  showLogo?: boolean;
  showCompanyDetails?: boolean;
  showCustomerContact?: boolean;
  showHsn?: boolean;
  showUnit?: boolean;
  showTaxBreakdown?: boolean;
  showAmtWords?: boolean;
  showBankDetails?: boolean;
  showTerms?: boolean;
  showSignature?: boolean;
  showLedgerflowWordmark?: boolean;
  pageSize?: 'A4' | 'A5_LANDSCAPE' | 'A5_PORTRAIT' | 'THERMAL';
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
  const compAddrParts = [
    company?.address_line1,
    company?.address_line2,
    company?.city,
    company?.state ? (company?.pincode ? `${company.state} - ${company.pincode}` : company.state) : company?.pincode,
    company?.country
  ].filter(Boolean);
  const compAddressStr = compAddrParts.join(', ');

  // Buyer / Party address formatting
  const partyAddrParts = [
    v.address_line1,
    v.address_line2,
    v.city,
    v.state ? (v.pincode ? `${v.state} - ${v.pincode}` : v.state) : v.pincode,
    v.country
  ].filter(Boolean);
  const partyAddressStr = partyAddrParts.join(', ');

  // Shipping address
  const shipAddrParts = [
    v.shipping_address_line1 || v.shipping_address,
    v.shipping_city,
    v.shipping_state ? (v.shipping_pincode ? `${v.shipping_state} - ${v.shipping_pincode}` : v.shipping_state) : v.shipping_pincode
  ].filter(Boolean);
  const shipAddressStr = shipAddrParts.join(', ');
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
    const taxRate = Number(line.tax_rate ?? line.tax_percent ?? line.tax_pct ?? 0);
    const lineTotalPaise = Number(
      line.total_amount_paise ?? line.amount_paise ?? (taxablePaise + Math.round((taxablePaise * taxRate) / 100))
    );

    const cgstPaise = Number(line.cgst_amount_paise || 0);
    const sgstPaise = Number(line.sgst_amount_paise || 0);
    const igstPaise = Number(line.igst_amount_paise || 0);

    totalTaxablePaise += taxablePaise;
    totalCgstPaise += cgstPaise;
    totalSgstPaise += sgstPaise;
    totalIgstPaise += igstPaise;

    // Unit fallback: actual configured unit, or "—" fallback (never invent unit)
    const rawUnit = (line.unit_symbol || line.unit_name || line.unit || '').trim();
    const unitDisplay = rawUnit ? rawUnit : '—';

    return {
      index: idx + 1,
      itemName: line.item_name || line.description || 'Item / Service',
      description: line.item_name && line.description && line.description !== line.item_name ? line.description : undefined,
      serialNumber: line.serial_number || undefined,
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
    shipToName: v.shipping_party_name || v.party_name,
    shipToAddress: shipAddressStr || partyAddressStr,

    lines,
    subTotal,
    taxTotal,
    taxBreakdowns,
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
