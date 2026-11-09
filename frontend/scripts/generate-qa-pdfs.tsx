import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StandardInvoice } from '../components/invoice/StandardInvoice';
import { SimpleInvoice } from '../components/invoice/SimpleInvoice';
import { ThermalInvoice } from '../components/invoice/ThermalInvoice';
import { NormalizedInvoiceData, InvoiceLineItem } from '../components/invoice/InvoiceAdapter';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ARTIFACTS_DIR = 'G:/HTML/LedgerFlow/pdf-acceptance-artifacts';
const HTML_DIR = path.join(ARTIFACTS_DIR, 'html');
if (!fs.existsSync(HTML_DIR)) {
  fs.mkdirSync(HTML_DIR, { recursive: true });
}

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const baseCompany = {
  companyName: 'DREAM TECH SOLUTIONS',
  companyAddress: 'Plot 42, Electronics City Phase 1, Hosur Road',
  companyCity: 'Bengaluru',
  companyState: 'Karnataka',
  companyStateCode: '29',
  companyPincode: '560100',
  companyPhone: '+91 98765 43210',
  companyEmail: 'billing@dreamtechsolutions.in',
  companyWebsite: 'https://dreamtechsolutions.in',
  companyGstin: '29AABCT1332L1Z8',
  companyPan: 'AABCT1332L'
};

const baseCustomer = {
  partyName: 'KB ENTERPRISES PVT LTD',
  partyAddress: '34, MG Road, Ernakulam North',
  partyCity: 'Kochi',
  partyState: 'Kerala',
  partyStateCode: '32',
  partyPincode: '682016',
  partyPhone: '+91 98470 12345',
  partyEmail: 'accounts@kbenterprises.in',
  partyGstin: '32ABCDE1234F1Z5',
  partyPan: 'ABCDE1234F'
};

function createSampleLine(
  index: number,
  itemName: string,
  hsnSac: string,
  qty: number,
  rate: number,
  taxPercent: number,
  options?: {
    description?: string;
    serialNumber?: string;
    warrantyMonths?: number;
  }
): InvoiceLineItem {
  const taxable = qty * rate;
  const taxAmt = Math.round((taxable * taxPercent) / 100);
  const isInterState = true; // Karnataka -> Kerala: 18% IGST
  return {
    index,
    itemName,
    hsnSac,
    quantity: qty,
    unit: 'NOS',
    rate,
    taxPercent,
    taxableAmount: taxable,
    igstAmount: isInterState ? taxAmt : undefined,
    cgstAmount: !isInterState ? taxAmt / 2 : undefined,
    sgstAmount: !isInterState ? taxAmt / 2 : undefined,
    amount: taxable + taxAmt,
    description: options?.description,
    serialNumber: options?.serialNumber,
    warrantyMonths: options?.warrantyMonths
  };
}

function calculateInvoiceTotals(lines: InvoiceLineItem[]) {
  const subTotal = lines.reduce((acc, l) => acc + l.taxableAmount, 0);
  const taxTotal = lines.reduce((acc, l) => acc + (l.igstAmount || ((l.cgstAmount || 0) + (l.sgstAmount || 0))), 0);
  const grandTotal = subTotal + taxTotal;
  return {
    subTotal,
    taxTotal,
    grandTotal,
    taxBreakdowns: [
      {
        label: 'IGST (18%)',
        percent: 18,
        amount: taxTotal
      }
    ]
  };
}

function wrapInHtmlShell(
  title: string,
  contentHtml: string,
  pageSizeCss: string,
  pageMarginCss: string,
  isThermal: boolean = false,
  is58mm: boolean = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
    @page {
      size: ${pageSizeCss};
      margin: ${pageMarginCss};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isThermal ? "'JetBrains Mono', 'Courier New', monospace" : "'Inter', system-ui, -apple-system, sans-serif"};
      font-size: ${isThermal ? (is58mm ? '10px' : '11px') : '12px'};
      color: #0F172A;
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    #printable-tax-invoice {
      width: 100% !important;
      max-width: 100% !important;
      box-shadow: none !important;
      border: none !important;
      padding: 0 !important;
      border-radius: 0 !important;
    }
  </style>
</head>
<body>
  ${contentHtml}
</body>
</html>`;
}

function exportPdf(htmlFilename: string, pdfFilename: string) {
  const htmlPath = path.resolve(HTML_DIR, htmlFilename);
  const pdfPath = path.resolve(ARTIFACTS_DIR, pdfFilename);
  console.log(`Generating PDF: ${pdfFilename} from ${htmlFilename}...`);

  const res = spawnSync(CHROME_PATH, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    htmlPath
  ], { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stat = fs.statSync(pdfPath);
    console.log(`✓ ${pdfFilename} created successfully (${stat.size} bytes)`);
  } else {
    console.error(`✗ Failed to create ${pdfFilename}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Scenario 1: Standard A4, One Page
// ─────────────────────────────────────────────────────────────
function generateScenario1() {
  const lines: InvoiceLineItem[] = [
    createSampleLine(1, 'ThinkPad T14 Gen 4', '84713010', 1, 85000, 18, {
      description: 'Intel Core i7-1365U / 16GB RAM / 512GB NVMe SSD',
      serialNumber: 'TP-T14-2026-0089',
      warrantyMonths: 36
    }),
    createSampleLine(2, 'Logitech MX Master 3S', '84716060', 1, 8999, 18, {
      description: 'Performance Wireless Ergonomic Mouse with Quiet Clicks',
      serialNumber: 'MX3S-SN-449102',
      warrantyMonths: 12
    }),
    createSampleLine(3, 'UltraFine 27" 4K Monitor', '85285200', 1, 32500, 18, {
      description: 'IPS 3840x2160 HDR400 with USB-C 90W PD',
      serialNumber: 'UF27-4K-990182',
      warrantyMonths: 36
    })
  ];

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_1',
    voucherNumber: 'INV-2026-0041',
    voucherDate: '01 Nov 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '15 Nov 2026',
    paymentTerms: 'Net 15 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR One Lakh Fifty One Thousand Five Hundred Sixty Nine Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<StandardInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Tax Invoice — INV-2026-0041', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '01_standard_a4_one_page.html'), html, 'utf-8');
  exportPdf('01_standard_a4_one_page.html', '01_standard_a4_one_page.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 2: Standard A4, Two Pages
// ─────────────────────────────────────────────────────────────
function generateScenario2() {
  const lines: InvoiceLineItem[] = [];
  for (let i = 1; i <= 14; i++) {
    lines.push(
      createSampleLine(i, `Workstation Unit Pro Model ${i}`, '84715000', 1, 45000 + i * 1000, 18, {
        description: `Precision engineering desktop with dedicated Quadro GPU, Unit #${i}`,
        serialNumber: `WS-PRO-SN-${String(1000 + i).padStart(4, '0')}`,
        warrantyMonths: 24
      })
    );
  }

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_2',
    voucherNumber: 'INV-2026-0042',
    voucherDate: '01 Nov 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '15 Nov 2026',
    paymentTerms: 'Net 15 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Eight Lakh Forty Two Thousand Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<StandardInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Tax Invoice — INV-2026-0042', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '02_standard_a4_two_pages.html'), html, 'utf-8');
  exportPdf('02_standard_a4_two_pages.html', '02_standard_a4_two_pages.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 3: Standard A4, Three or More Pages
// ─────────────────────────────────────────────────────────────
function generateScenario3() {
  const lines: InvoiceLineItem[] = [];
  for (let i = 1; i <= 28; i++) {
    lines.push(
      createSampleLine(i, `Enterprise Edge Router Gateway v${i}`, '85176290', 2, 28000, 18, {
        description: `Managed Dual-WAN Gigabit Security Router with Hardware Encryption, Port ${i}`,
        serialNumber: `RTR-2026-A${String(i).padStart(3, '0')}, RTR-2026-B${String(i).padStart(3, '0')}`,
        warrantyMonths: 36
      })
    );
  }

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_3',
    voucherNumber: 'INV-2026-0043',
    voucherDate: '01 Nov 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '30 Nov 2026',
    paymentTerms: 'Net 30 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Eighteen Lakh Forty Nine Thousand Two Hundred Eighty Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<StandardInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Tax Invoice — INV-2026-0043', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '03_standard_a4_three_plus_pages.html'), html, 'utf-8');
  exportPdf('03_standard_a4_three_plus_pages.html', '03_standard_a4_three_plus_pages.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 4: Simple Invoice, Multiple Pages
// ─────────────────────────────────────────────────────────────
function generateScenario4() {
  const lines: InvoiceLineItem[] = [];
  for (let i = 1; i <= 16; i++) {
    lines.push(
      createSampleLine(i, `Barcode Scanner 2D QR Wireless #${i}`, '84719000', 1, 6500, 18, {
        description: 'Omnidirectional high-speed CCD imager with 2.4G dongle and cradle',
        serialNumber: `BCS-2D-SN-${String(2000 + i)}`,
        warrantyMonths: 12
      })
    );
  }

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_4',
    voucherNumber: 'INV-2026-0044',
    voucherDate: '02 Nov 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '16 Nov 2026',
    paymentTerms: 'Net 14 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR One Lakh Twenty Two Thousand Seven Hundred Twenty Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<SimpleInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Simple Tax Invoice — INV-2026-0044', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '04_simple_invoice_multipage.html'), html, 'utf-8');
  exportPdf('04_simple_invoice_multipage.html', '04_simple_invoice_multipage.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 5: Thermal 80mm
// ─────────────────────────────────────────────────────────────
function generateScenario5() {
  const lines: InvoiceLineItem[] = [
    createSampleLine(1, 'POS Thermal Printer 80mm', '84433250', 1, 7500, 18, {
      serialNumber: 'PRN-80-9921',
      warrantyMonths: 12
    }),
    createSampleLine(2, 'Cash Drawer Heavy Duty', '84733099', 1, 3800, 18, {
      serialNumber: 'CD-HD-3312'
    }),
    createSampleLine(3, 'Thermal Paper Rolls (Box 50)', '48234000', 2, 1200, 12),
    createSampleLine(4, 'USB Cable 3.0 Type B', '85444299', 2, 350, 18)
  ];

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_5',
    voucherNumber: 'INV-2026-0045',
    voucherDate: '02 Nov 2026',
    voucherType: 'POS Receipt',
    status: 'POSTED',
    dueDate: '02 Nov 2026',
    paymentTerms: 'Immediate',
    placeOfSupply: 'Karnataka (29)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Sixteen Thousand Two Hundred Eighty Four Only',
    hasBankDetails: false
  };

  const markup = renderToStaticMarkup(<ThermalInvoice data={data} options={{ pageSize: 'THERMAL_80' }} />);
  const html = wrapInHtmlShell('Thermal Receipt 80mm — INV-2026-0045', markup, '80mm 260mm', '2mm', true, false);
  fs.writeFileSync(path.join(HTML_DIR, '05_thermal_80mm.html'), html, 'utf-8');
  exportPdf('05_thermal_80mm.html', '05_thermal_80mm.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 6: Thermal 58mm
// ─────────────────────────────────────────────────────────────
function generateScenario6() {
  const lines: InvoiceLineItem[] = [
    createSampleLine(1, 'Handheld Scanner', '84719000', 1, 3200, 18, {
      serialNumber: 'HHS-58-1092',
      warrantyMonths: 6
    }),
    createSampleLine(2, 'Thermal Paper 58mm', '48234000', 3, 45, 12),
    createSampleLine(3, 'Power Adapter 12V 2A', '85044090', 1, 650, 18)
  ];

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_6',
    voucherNumber: 'INV-2026-0046',
    voucherDate: '03 Nov 2026',
    voucherType: 'POS Receipt',
    status: 'POSTED',
    dueDate: '03 Nov 2026',
    paymentTerms: 'Immediate',
    placeOfSupply: 'Karnataka (29)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Four Thousand Six Hundred Eighty Nine Only',
    hasBankDetails: false
  };

  const markup = renderToStaticMarkup(<ThermalInvoice data={data} options={{ pageSize: 'THERMAL_58' }} />);
  const html = wrapInHtmlShell('Thermal Receipt 58mm — INV-2026-0046', markup, '58mm 220mm', '2mm', true, true);
  fs.writeFileSync(path.join(HTML_DIR, '06_thermal_58mm.html'), html, 'utf-8');
  exportPdf('06_thermal_58mm.html', '06_thermal_58mm.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 7: One serial and multiple serials, long descriptions & long serial values
// ─────────────────────────────────────────────────────────────
function generateScenario7() {
  const lines: InvoiceLineItem[] = [
    createSampleLine(1, 'Custom Cloud Server Rack Node Ultra Heavy Duty Enterprise Appliance', '84714190', 1, 340000, 18, {
      description: 'Dual AMD EPYC 9654 96-Core 192-Thread Processors, 768GB DDR5 ECC Registered RAM, 8x 3.84TB Enterprise NVMe U.2 Hot-Swap Solid State Drives in RAID 10 Array with Redundant 1600W Titanium Power Supply Units and Quad 25GbE SFP28 Network Interface Controllers.',
      serialNumber: 'SRV-EPYC-9654-2026-ALPHA-001',
      warrantyMonths: 60
    }),
    createSampleLine(2, 'High-Density 48-Port PoE+ Managed Layer 3 Network Switches', '85176290', 8, 48000, 18, {
      description: 'Stackable L3 switch with 48x 1GbE PoE+ (370W total budget), 4x 10GbE SFP+ uplinks, enterprise routing protocols including BGP, OSPFv3, and redundant hot-swappable fan trays.',
      serialNumber: 'SW-POE48-SN-001, SW-POE48-SN-002, SW-POE48-SN-003, SW-POE48-SN-004, SW-POE48-SN-005, SW-POE48-SN-006, SW-POE48-SN-007, SW-POE48-SN-008',
      warrantyMonths: 36
    }),
    createSampleLine(3, 'Cat6A S/FTP Shielded Solid Copper Cable Reel 305m (Non-Serialized)', '85444999', 5, 14500, 18, {
      description: 'Low Smoke Zero Halogen (LSZH) 500MHz category 6A bulk horizontal network infrastructure cabling.'
    })
  ];

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_scen_7',
    voucherNumber: 'INV-2026-0047',
    voucherDate: '03 Nov 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '18 Nov 2026',
    paymentTerms: 'Net 15 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Nine Lakh Forty Two Thousand Eight Hundred Ten Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<StandardInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Tax Invoice — INV-2026-0047', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '07_long_descriptions_and_serials.html'), html, 'utf-8');
  exportPdf('07_long_descriptions_and_serials.html', '07_long_descriptions_and_serials.pdf');
}

// ─────────────────────────────────────────────────────────────
// Scenario 8: Historical Invoice with Recovered Serials
// ─────────────────────────────────────────────────────────────
function generateScenario8() {
  const lines: InvoiceLineItem[] = [
    createSampleLine(1, 'MacBook Pro 16" M3 Max', '84713010', 2, 349900, 18, {
      description: '16-Core CPU, 40-Core GPU, 48GB Unified Memory, 1TB SSD Space Black',
      serialNumber: 'MBP16-M3X-9011, MBP16-M3X-9012',
      warrantyMonths: 12
    }),
    createSampleLine(2, 'Apple Magic Keyboard with Touch ID & Numeric Keypad', '84716060', 2, 19500, 18, {
      description: 'Wireless Bluetooth Rechargeable Keyboard Space Black',
      serialNumber: 'MKB-SN-110291, MKB-SN-110292',
      warrantyMonths: 12
    })
  ];

  const totals = calculateInvoiceTotals(lines);
  const data: NormalizedInvoiceData = {
    ...baseCompany,
    ...baseCustomer,
    ...totals,
    voucherId: 'vch_historical_recovered',
    voucherNumber: 'INV-2026-0012',
    voucherDate: '15 Oct 2026',
    voucherType: 'Tax Invoice',
    status: 'POSTED',
    dueDate: '30 Oct 2026',
    paymentTerms: 'Net 15 Days',
    placeOfSupply: 'Kerala (32)',
    hasShippingAddress: false,
    lines,
    amountInWords: 'INR Eight Lakh Seventy One Thousand Seven Hundred Eighty Four Only',
    hasBankDetails: true,
    bankName: 'HDFC Bank',
    bankAccountName: 'DREAM TECH SOLUTIONS',
    bankAccountNo: '50200088991122',
    bankIfsc: 'HDFC0001234',
    bankBranch: 'Electronics City Branch'
  };

  const markup = renderToStaticMarkup(<StandardInvoice data={data} options={{ pageSize: 'A4', orientation: 'PORTRAIT' }} />);
  const html = wrapInHtmlShell('Historical Tax Invoice — INV-2026-0012', markup, 'A4 portrait', '8mm');
  fs.writeFileSync(path.join(HTML_DIR, '08_historical_invoice.html'), html, 'utf-8');
  exportPdf('08_historical_invoice.html', '08_historical_invoice.pdf');
}

// ─────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────
function runAll() {
  console.log('Starting QA-012 PDF Generation for all 8 scenarios...');
  generateScenario1();
  generateScenario2();
  generateScenario3();
  generateScenario4();
  generateScenario5();
  generateScenario6();
  generateScenario7();
  generateScenario8();
  console.log('All 8 QA-012 PDF scenarios generated successfully.');
}

runAll();
