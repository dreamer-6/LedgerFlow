/**
 * ui041-quotation-sidebar-navigation.test.ts — Test Suite for UI-041: Quotation Sidebar Navigation Correction
 *
 * Verifies:
 * 1. Main Quotation sidebar item navigates directly to Quotation Dashboard (setQuotationViewMode('dashboard')).
 * 2. Zero redundant "Quotation Dashboard" item inside the submenu.
 * 3. Submenu strictly contains exactly two items:
 *    - "Quotation Creation" -> setQuotationViewMode('create')
 *    - "Quotation Register" -> setQuotationViewMode('register')
 * 4. Quotation parent item is expandable/collapsible via chevron toggle.
 * 5. Clicking Quotation parent while expanded still directly navigates to Quotation Dashboard.
 * 6. Default route in App.tsx for Quotation module is 'dashboard' (QuotationDashboardView).
 * 7. Active navigation highlighting rules:
 *    - Parent active on dashboard, create, register, view.
 *    - Child "Quotation Creation" active only when quotationViewMode === 'create'.
 *    - Child "Quotation Register" active when quotationViewMode === 'register' || quotationViewMode === 'view'.
 * 8. Routing architecture preservation: QuotationDashboardView, QuotationCreationView, QuotationRegisterView, QuotationDetailsView properly routed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('UI-041: Quotation Sidebar Navigation Correction', () => {
  const sidebarPath = path.resolve(__dirname, '../../frontend/src/components/layout/Sidebar.tsx');
  const appPath = path.resolve(__dirname, '../../frontend/src/App.tsx');

  const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
  const appCode = fs.readFileSync(appPath, 'utf8');

  it('1. Main Quotation sidebar item navigates directly to Quotation Dashboard', () => {
    // Check non-collapsed primary item click handler
    assert.ok(
      sidebarCode.includes("setActiveTab('quotation');\n                    if (setQuotationViewMode) setQuotationViewMode('dashboard');"),
      'Clicking primary Quotation item must set activeTab to quotation and quotationViewMode to dashboard'
    );
    // Check collapsed primary item click handler
    assert.ok(
      sidebarCode.includes("setActiveTab('quotation');\n                  if (setQuotationViewMode) setQuotationViewMode('dashboard');"),
      'Clicking collapsed Quotation item must navigate to dashboard'
    );
  });

  it('2. Does NOT display a separate Dashboard submenu item under Quotation', () => {
    // Extract the quotation collapsible submenu block
    const quotationSubmenuStart = sidebarCode.indexOf("{expandedGroup === 'quotation' && (");
    assert.ok(quotationSubmenuStart !== -1, 'Quotation collapsible submenu must exist');
    const quotationSubmenuBlock = sidebarCode.slice(quotationSubmenuStart, quotationSubmenuStart + 3000);

    assert.ok(
      !quotationSubmenuBlock.includes('Quotation Dashboard</span>'),
      'Must NOT display a separate "Quotation Dashboard" entry in the submenu'
    );
    assert.ok(
      !quotationSubmenuBlock.includes('>Dashboard</span>'),
      'Must NOT display any "Dashboard" entry in the submenu'
    );
  });

  it('3. Submenu strictly contains only Quotation Creation and Quotation Register', () => {
    const quotationSubmenuStart = sidebarCode.indexOf("{expandedGroup === 'quotation' && (");
    const quotationSubmenuBlock = sidebarCode.slice(quotationSubmenuStart, quotationSubmenuStart + 3000);

    assert.ok(
      quotationSubmenuBlock.includes('Quotation Creation</span>'),
      'Submenu must contain "Quotation Creation"'
    );
    assert.ok(
      quotationSubmenuBlock.includes("setQuotationViewMode('create')"),
      'Quotation Creation submenu item must set quotationViewMode to create'
    );
    assert.ok(
      quotationSubmenuBlock.includes('Quotation Register</span>'),
      'Submenu must contain "Quotation Register"'
    );
    assert.ok(
      quotationSubmenuBlock.includes("setQuotationViewMode('register')"),
      'Quotation Register submenu item must set quotationViewMode to register'
    );

    // Count span labels in the submenu block
    const spanMatches = quotationSubmenuBlock.match(/<span style=\{\{ flex: 1 \}\}>([^<]+)<\/span>/g) || [];
    assert.equal(spanMatches.length, 2, 'Submenu must contain exactly two child items');
    assert.ok(spanMatches[0].includes('Quotation Creation'));
    assert.ok(spanMatches[1].includes('Quotation Register'));
  });

  it('4. Quotation parent item is expandable/collapsible via chevron toggle', () => {
    assert.ok(
      sidebarCode.includes("toggleGroup('quotation')"),
      'Chevron must call toggleGroup(\'quotation\') with stopPropagation'
    );
    assert.ok(
      sidebarCode.includes("expandedGroup === 'quotation' ? <ChevronUp size={14} /> : <ChevronDown size={14} />"),
      'Must display dynamic ChevronUp/ChevronDown based on expandedGroup state'
    );
  });

  it('5. Clicking Quotation parent while expanded navigates directly to Quotation Dashboard', () => {
    // The parent item div has onClick handler that unconditionally sets quotationViewMode('dashboard')
    // regardless of whether expandedGroup === 'quotation' or not.
    const parentItemRegex = /onClick=\{\(\) => \{\s*setActiveTab\('quotation'\);\s*if \(setQuotationViewMode\) setQuotationViewMode\('dashboard'\);\s*setExpandedGroup\('quotation'\);/;
    assert.ok(
      parentItemRegex.test(sidebarCode),
      'Parent item click handler must always navigate to dashboard'
    );
  });

  it('6. Quotation Dashboard is the default route when entering the Quotation module', () => {
    // Check initial state in App.tsx
    assert.ok(
      appCode.includes("const [quotationViewMode, setQuotationViewMode] = useState<'dashboard' | 'create' | 'register' | 'view'>('dashboard');"),
      'Default quotationViewMode state in App.tsx must be "dashboard"'
    );

    // Alt+Q shortcut sets quotationViewMode to 'dashboard'
    assert.ok(
      appCode.includes("setQuotationViewMode('dashboard');\n          setActiveTab('quotation');"),
      'Alt+Q shortcut must set quotationViewMode to dashboard'
    );
  });

  it('7. Active navigation highlighting rules are strictly enforced', () => {
    // Parent item highlighting: active whenever activeTab === 'quotation'
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'quotation' ? 'active' : ''}`}"),
      'Parent item must be active whenever activeTab === quotation'
    );

    // Child "Quotation Creation" highlighting
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'quotation' && quotationViewMode === 'create' ? 'active' : ''}`}"),
      'Child "Quotation Creation" must be active only when activeTab === quotation and quotationViewMode === create'
    );

    // Child "Quotation Register" highlighting (also highlights when viewing a quotation from register)
    assert.ok(
      sidebarCode.includes("className={`nav-item ${activeTab === 'quotation' && (quotationViewMode === 'register' || quotationViewMode === 'view') ? 'active' : ''}`}"),
      'Child "Quotation Register" must be active when quotationViewMode is register or view'
    );
  });

  it('8. All 4 quotation views exist and are routed correctly in App.tsx', () => {
    assert.ok(appCode.includes("{quotationViewMode === 'dashboard' && ("), 'App.tsx must route dashboard');
    assert.ok(appCode.includes('<QuotationDashboardView'), 'App.tsx must render QuotationDashboardView');
    assert.ok(appCode.includes("{quotationViewMode === 'register' && ("), 'App.tsx must route register');
    assert.ok(appCode.includes('<QuotationRegisterView'), 'App.tsx must render QuotationRegisterView');
    assert.ok(appCode.includes("{quotationViewMode === 'view' && ("), 'App.tsx must route view');
    assert.ok(appCode.includes('<QuotationDetailsView'), 'App.tsx must render QuotationDetailsView');
    assert.ok(appCode.includes("{quotationViewMode === 'create' && ("), 'App.tsx must route create');
    assert.ok(appCode.includes('<QuotationCreationView'), 'App.tsx must render QuotationCreationView');
  });
});
