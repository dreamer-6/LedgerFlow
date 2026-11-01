---
name: LedgerFlow Design System
colors:
  primary: '#F97316'
  primary-hover: '#EA580C'
  primary-active: '#C2410C'
  primary-soft: 'rgba(249, 115, 22, 0.10)'
  primary-glow: '0 4px 14px rgba(249, 115, 22, 0.30)'
  on-primary: '#FFFFFF'
  primary-container: '#FFF7ED'
  on-primary-container: '#EA580C'
  inverse-primary: '#FF641F'

  background: '#F8F7F4'
  on-background: '#0F172A'
  surface: '#FFFFFF'
  on-surface: '#0F172A'
  on-surface-variant: '#475569'
  surface-secondary: '#F8F7F4'
  surface-muted: '#F1F0ED'
  surface-hover: '#F5F4F1'
  surface-card: '#FFFFFF'
  surface-inner: '#F8F7F4'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#F8F7F4'
  surface-container: '#F1F0ED'
  surface-container-high: '#E5E7EB'
  surface-container-highest: '#CBD5E1'
  inverse-surface: '#080808'
  inverse-on-surface: '#F5F5F5'

  outline: '#E5E7EB'
  outline-strong: '#D1D5DB'
  outline-variant: '#ECEEF2'
  outline-focus: '#F97316'
  surface-tint: '#F97316'

  text-primary: '#0F172A'
  text-secondary: '#475569'
  text-muted: '#94A3B8'
  text-disabled: '#CBD5E1'
  text-link: '#F97316'

  success: '#16A34A'
  success-bg: '#DCFCE7'
  success-border: 'rgba(22, 163, 74, 0.22)'
  success-text: '#15803D'

  warning: '#D97706'
  warning-bg: '#FEF3C7'
  warning-border: 'rgba(217, 119, 6, 0.22)'
  warning-text: '#B45309'

  danger: '#DC2626'
  danger-bg: '#FEE2E2'
  danger-border: 'rgba(220, 38, 38, 0.22)'
  danger-text: '#B91C1C'

  info: '#2563EB'
  info-bg: '#EFF6FF'
  info-border: 'rgba(37, 99, 235, 0.22)'
  info-text: '#1D4ED8'

  chart-sales: '#F97316'
  chart-purchase: '#E2D9D0'
  chart-purchase-dark: '#6B7280'
typography:
  display-metric:
    fontFamily: Inter, sans-serif
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 1.0
    letterSpacing: -0.03em
  headline-h1:
    fontFamily: Inter, sans-serif
    fontSize: 23px
    fontWeight: '700'
    lineHeight: 1.25
    letterSpacing: -0.025em
  headline-panel:
    fontFamily: Inter, sans-serif
    fontSize: 14.5px
    fontWeight: '700'
    lineHeight: 1.3
    letterSpacing: -0.01em
  stat-kpi-amount:
    fontFamily: JetBrains Mono, monospace
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 1.2
    letterSpacing: -0.02em
    fontVariantNumeric: tabular-nums
  body-base:
    fontFamily: Inter, sans-serif
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: 1.5
    letterSpacing: '0'
  body-table:
    fontFamily: Inter, sans-serif
    fontSize: 12.5px
    fontWeight: '500'
    lineHeight: 1.4
    letterSpacing: '0'
  label-kpi-title:
    fontFamily: Inter, sans-serif
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 1.2
    letterSpacing: '0'
  label-table-th:
    fontFamily: Inter, sans-serif
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 1.0
    letterSpacing: 0.05em
    textTransform: uppercase
  label-badge:
    fontFamily: Inter, sans-serif
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 1.4
    letterSpacing: 0.02em
  code-mono:
    fontFamily: JetBrains Mono, monospace
    fontSize: 12px
    fontWeight: '600'
    letterSpacing: -0.01em
    fontVariantNumeric: tabular-nums
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 20px
  pill: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 20px
  2xl: 24px
  3xl: 32px
  4xl: 48px
  margin-content: 32px
  container-max: 1440px
---

# LedgerFlow™ Design System Specification

**Product:** LedgerFlow — Modern Indian Double-Entry ERP & GST Accounting Software  
**Version:** 2.0 (Synchronized with Dashboard, Sales, Purchase & Accounting Modules)  
**Specification Source:** [frontend/src/styles/tokens.css](file:///g:/HTML/LedgerFlow/frontend/src/styles/tokens.css), [frontend/src/styles/dashboard.css](file:///g:/HTML/LedgerFlow/frontend/src/styles/dashboard.css), [frontend/src/styles/components.css](file:///g:/HTML/LedgerFlow/frontend/src/styles/components.css), [frontend/src/pages/DashboardView.tsx](file:///g:/HTML/LedgerFlow/frontend/src/pages/DashboardView.tsx)

---

## 1. Visual Theme & Atmosphere

LedgerFlow's visual identity unites the raw transaction execution speed of traditional Indian accounting systems (such as Tally Prime) with the aesthetic refinement, clarity, and visual rhythm of modern engineering tools (such as Stripe, Linear, and Vercel). Built for high-volume Indian business environments, the interface emphasizes immediate financial readability, rigorous double-entry confidence, and high data density without visual clutter.

The visual architecture is founded upon an authentic **Warm Neutral / Linen foundation** (`#F8F7F4`) in Light Mode, which prevents the ocular fatigue caused by stark cold white backgrounds during long operating hours. In Dark Mode, it transitions into an **Obsidian Matte Black environment** (`#080808` canvas with `#151515` card surfaces and `#191919` inner compartments).

The brand is anchored by **Electric International Orange** (`#F97316` in light mode, `#FF641F` with high luminance in dark mode). Orange serves as the precise focal point across the application: guiding the operator's eye to primary calls-to-action, active dashboard modules, voucher linkages, and positive momentum indicators. Ambient atmospheric watermarks (`radial-gradient` top-right atmospheric warmth) and micro-interactions give the dashboard a tactile, living presence.

---

## 2. Color Palette & Functional Roles

### 2.1 Primary Brand Tokens

| Token Name | Light Mode Hex | Dark Mode Hex | Functional Usage |
|:---|:---|:---|:---|
| `--color-primary` | `#F97316` | `#FF641F` | Primary Brand Orange; active navigation, primary action buttons, focus rings, active links |
| `--color-primary-hover` | `#EA580C` | `#FF7A3D` | Interactive hover state for primary buttons and branded navigation items |
| `--color-primary-active` | `#C2410C` | `#E05315` | Pressed/active state for primary interactive elements |
| `--color-primary-soft` | `rgba(249, 115, 22, 0.10)` | `rgba(255, 100, 31, 0.14)` | Tinted background for active navigation, highlighted row pills, and subtle tags |
| `--color-primary-glow` | `0 4px 14px rgba(249, 115, 22, 0.30)` | `0 4px 20px rgba(255, 100, 31, 0.35)` | Atmospheric elevation shadow on primary buttons and featured cards |

---

### 2.2 Neutral Foundation & Surface Elevation

The surface hierarchy utilizes a 3-layer dimensional stacking model:
1. **App Canvas / Ground Layer**: Foundation behind all content.
2. **Card / Panel Layer**: Elevated content surfaces with hairline borders and soft ambient occlusion shadows.
3. **Muted / Inset Layer**: Recessed compartments such as table headers, scope switchers, input boxes, and code blocks.

| Token Name | Light Mode Hex | Dark Mode Hex | Functional Role |
|:---|:---|:---|:---|
| `--color-background` | `#F8F7F4` (Warm Sand Linen) | `#080808` (Obsidian Canvas) | Root application backdrop |
| `--color-surface` | `#FFFFFF` (Pure White) | `#151515` (Deep Slate Black) | KPI cards, panel containers, modal dialogs, flyouts |
| `--color-surface-secondary` | `#F8F7F4` (Warm Neutral) | `#191919` (Elevated Panel) | Inset panels, table sticky headers, scope switcher tracks |
| `--color-surface-muted` | `#F1F0ED` (Soft Putty) | `#191919` (Dark Inset) | Input box default fills, keyboard shortcut pills (`kbd`) |
| `--color-surface-hover` | `#F5F4F1` (Subtle Hover) | `#222222` (Card Hover) | Table row hover, list item hover, secondary button hover |
| `--color-border` | `#E5E7EB` (Subtle Border) | `#292929` (Obsidian Border) | Card perimeters, header bottom dividers, container outlines |
| `--color-border-strong` | `#D1D5DB` (Medium Gray) | `#383838` (Defined Outline) | Form field borders, divider rules, hover borders |
| `--color-border-subtle` | `#ECEEF2` or `#F1F0ED` | `#1F1F1F` | Table row horizontal hairline dividers |

---

### 2.3 Typography & Text Contrast Hierarchy

Text contrast adheres strictly to WCAG AA/AAA guidelines against their respective surface backgrounds:

| Token Name | Light Mode Value | Dark Mode Value | Semantic Role |
|:---|:---|:---|:---|
| `--color-text` | `#0F172A` (Deep Slate Navy) | `#F5F5F5` (Crisp Off-White) | Page titles, primary numbers, table body data, active values |
| `--color-text-secondary`| `#475569` (Slate Gray) | `#8E8E8E` (Muted Warm Gray) | Subtitles, KPI card titles, field labels, metadata |
| `--color-text-muted` | `#94A3B8` (Cool Muted) | `#737373` (Dim Charcoal) | Table column headers, chart axis ticks, timestamps, placeholders |
| `--color-text-disabled` | `#CBD5E1` (Faded Slate) | `#525252` (Disabled Gray) | Inactive navigation options, disabled action triggers |
| `--color-text-link` | `#F97316` (Brand Orange) | `#FF641F` (Ember Orange) | Clickable voucher numbers, "View All" report links |

---

### 2.4 Status & Accounting Functional Badges

Status colors are paired with high-legibility tinted background badges:

| State / Category | Foreground Hex | Background Hex / RGBA | Border Hex / RGBA | Application |
|:---|:---|:---|:---|:---|
| **Success / Posted** | `#16A34A` (Emerald) | `#DCFCE7` / `rgba(22, 163, 74, 0.10)` | `rgba(22, 163, 74, 0.22)` | Posted vouchers, positive growth `↑`, matched reconciliations |
| **Warning / Draft** | `#D97706` (Amber) | `#FEF3C7` / `rgba(217, 119, 6, 0.10)` | `rgba(217, 119, 6, 0.22)` | Draft vouchers, pending payments, due warning thresholds |
| **Danger / Cancelled**| `#DC2626` (Crimson) | `#FEE2E2` / `rgba(220, 38, 38, 0.10)` | `rgba(220, 38, 38, 0.22)` | Cancelled vouchers, negative trend `↓`, overdue bills, errors |
| **Info / Receivables**| `#2563EB` (Royal Blue) | `#EFF6FF` / `rgba(37, 99, 235, 0.10)` | `rgba(37, 99, 235, 0.22)` | Informational notifications, customer ledger references |
| **Sales Type** | `#EA580C` (Dark Orange) | `#FFF7ED` (Warm Orange Tint) | `transparent` | Sales voucher classification pill |
| **Purchase Type** | `#475569` (Slate) | `#F1F5F9` (Slate Tint) | `transparent` | Purchase voucher classification pill |
| **Receipt Type** | `#059669` (Teal Green) | `#ECFDF5` (Mint Tint) | `transparent` | Receipt voucher classification pill |
| **Payment Type** | `#D97706` (Amber Gold) | `#FEF3C7` (Warm Amber Tint) | `transparent` | Payment voucher classification pill |
| **Journal Type** | `#475569` (Muted Slate) | `#F1F5F9` (Muted Slate Tint) | `transparent` | Journal voucher adjustment pill |

---

### 2.5 KPI Icon Chip Palette (Dashboard Row 1)

Each of the 5 core dashboard metric cards features an icon chip with calibrated tinting:

| Card Metric | Icon Component | Background Tint | Icon Foreground | Semantic Role |
|:---|:---|:---|:---|:---|
| **1. Total Sales** | `BarChart3` | `#FFF7ED` | `#F97316` | Revenue generation |
| **2. Total Purchase**| `ShoppingBag` | `#FFF3ED` | `#EA580C` | Inward procurement & inventory expense |
| **3. Receivables** | `Users` | `#F1F5F9` | `#475569` | Sundry Debtors (due from customers) |
| **4. Payables** | `Wallet` | `#FFF7ED` | `#D97706` | Sundry Creditors (due to suppliers) |
| **5. Service Income** | `Receipt` | `#FFF3ED` | `#F97316` | Non-inventory service, repair & labor turnover |

---

### 2.6 Chart & Visualization Palette

| Element | Light Mode | Dark Mode | Details |
|:---|:---|:---|:---|
| **Sales Bar** | `#F97316` (Brand Orange) | `#FF641F` (Ember Orange) | Primary revenue bar; width `14px`, radius `5px 5px 0 0` |
| **Purchase Bar** | `#E2D9D0` (Warm Sand Grey) | `#6B7280` (Medium Slate) | Comparative procurement bar; width `14px`, radius `5px 5px 0 0` |
| **Sales Bar Hover** | `#FF7A3D` | `#FF8F5C` | Brightened interactive feedback on column hover |
| **Purchase Bar Hover**| `#D4C9BF` | `#8E8E8E` | Subtle highlight on column hover |
| **Health Gauge Arc**| Linear Gradient `#FB923C` $\to$ `#F97316` | Linear Gradient `#FB923C` $\to$ `#FF641F` | Semicircular liquidity arc (`radius: 75px`, `strokeWidth: 14px`) |
| **Health Gauge Track**| `#E5E7EB` | `#292929` | Inactive 180° background rail |
| **Gridlines** | `#F1F0ED` | `#1F1F1F` | 1px horizontal threshold lines (`0%, 25%, 50%, 75%, 100%`) |
| **Chart Tooltip Card**| `#1E293B` (Midnight Slate) | `#1E293B` (Midnight Slate) | Floating dark glass tooltip with white text and tabular values |

---

## 3. Typography Rules

### 3.1 Font Family Stacks

```css
/* Primary User Interface & Headings */
--font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Numeric Engine, Financial Figures, Voucher Codes, GSTINs */
--font-mono: 'JetBrains Mono', 'Courier New', monospace;
```

- **Inter**: Selected for its generous x-height, neutral letterforms, open counters, and exceptional readability at dense sizes (`11px`–`14px`).
- **JetBrains Mono**: Strictly utilized across all currency values, accounting totals, balance sheets, voucher numbers, and tax figures to guarantee character-width parity and zero column jitter.

---

### 3.2 Typographic Scale & Hierarchy

| Level / Class | Font Family | Size | Weight | Line Height | Letter Spacing | Case | Usage |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **Display Score** | `Inter` | `34px` | `800` (Extra Bold) | `1.0` | `-0.03em` | None | Business Health Score (`92`) |
| **Page Header (H1)** | `Inter` | `23px` | `700` (Bold) | `1.25` | `-0.025em` | Title | Dashboard Greeting ("Good evening, Admin") |
| **KPI Amount** | `JetBrains Mono` | `22px` | `700` (Bold) | `1.2` | `-0.02em` | None | Primary KPI cards (`₹ 12,48,320`) |
| **Panel Header Title**| `Inter` | `14.5px` | `700` (Bold) | `1.3` | `-0.01em` | Title | Panel titles ("Business Health", "Recent Vouchers") |
| **Subtitle / Body** | `Inter` | `13.5px` | `400` (Regular) | `1.5` | `0` | Sentence | Explanatory subtext, callout descriptions |
| **KPI Card Title** | `Inter` | `13px` | `600` (Semi-bold) | `1.2` | `0` | Title | KPI headers ("Total Sales", "Receivables") |
| **Table Body Data** | `Inter` | `12.5px` | `500` (Medium) | `1.4` | `0` | Sentence | Table party names, voucher descriptions |
| **Voucher Number Link**| `JetBrains Mono`| `12.5px` | `600` (Semi-bold) | `1.4` | `-0.01em` | None | Clickable voucher identifiers (`INV-2026-001`) |
| **Control / Button** | `Inter` | `12px` | `500`–`600` | `1.0` | `0` | None | Filter buttons, date dropdowns, action triggers |
| **Trend / Delta Badge**| `Inter` | `11.5px` | `600` (Semi-bold) | `1.0` | `0` | None | Percentage growth (`↑ 12.4%`) |
| **Table Column Header**| `Inter` | `11px` | `600` (Semi-bold) | `1.0` | `+0.05em` | UPPERCASE | Table headers (`DATE`, `VOUCHER NO.`, `AMOUNT`) |
| **Pill Status Badge** | `Inter` | `11px` | `600` (Semi-bold) | `1.4` | `+0.02em` | Title | Status indicators (`Posted`, `Draft`, `Cancelled`) |
| **Micro / Axis Label**| `Inter` | `10.5px`–`11px`| `500` (Medium) | `1.0` | `0` | None | Chart Y-axis ticks, sparkline date labels, `kbd` shortcuts |

---

## 4. Numeric Value Styling & Financial Format Engine

In financial software, numerical presentation directly impacts operational speed and audit precision. LedgerFlow enforces strict mathematical, formatting, and alignment standards:

### 4.1 Strict Monospaced Tabular Figures
Every financial amount, currency figure, percentage, voucher number, ledger balance, and date must declare:
```css
font-family: var(--font-mono, 'JetBrains Mono', monospace);
font-variant-numeric: tabular-nums;
```
This forces all numerical digits (`0`–`9`) to occupy identical horizontal bounding boxes (e.g. `1` occupies the same width as `8`), preventing table columns from shifting or visually jittering during data refreshes.

### 4.2 Indian Rupee Currency Formatting (`en-IN`)
All database values are stored as 64-bit integer paise to prevent floating-point rounding errors. Frontend display formats these integers using Indian grouping notation (Lakhs and Crores: 2, 2, 3 groupings):

```typescript
function formatINR(paise: number | undefined | null): string {
  if (paise == null || isNaN(paise)) return '₹ 0';
  const rupees = Math.round(paise / 100);
  const isNeg = rupees < 0;
  const abs = Math.abs(rupees);
  return (isNeg ? '-₹ ' : '₹ ') + abs.toLocaleString('en-IN');
}
```

#### Formatting Rules:
1. **Currency Symbol Space**: Always place a non-breaking space between the rupee symbol and digits: `"₹ 12,48,320"`, never `"₹12,48,320"`.
2. **Indian Number Grouping**:
   - Hundreds: `₹ 750`
   - Thousands: `₹ 8,450`
   - Lakhs: `₹ 12,48,320`
   - Crores: `₹ 1,45,20,500`
3. **Negative Financial Values**: Formatted with the negative sign preceding the currency symbol: `"-₹ 45,000"`.
4. **Zero Representation**: Rendered cleanly as `"₹ 0"`.
5. **Horizontal Alignment**: All financial values in data tables are strictly **Right-Aligned** (`th.text-right`, `td.text-right`), ensuring that units, tens, hundreds, and thousands line up vertically for quick operator scanning.

### 4.3 Trend & Delta Badge Rules
Trends indicate month-over-month performance or period changes:
- **Positive Delta**: Foreground `#16A34A`, Background `rgba(22, 163, 74, 0.10)` or `#DCFCE7`, Icon `↑`, Example: `↑ 12.4%`.
- **Negative Delta**: Foreground `#DC2626`, Background `rgba(220, 38, 38, 0.10)` or `#FEE2E2`, Icon `↓`, Example: `↓ 5.2%`.
- **Neutral / Static**: Foreground `#94A3B8`, Label text: `"Active Period"` or `"Due from Debtors"`.

### 4.4 Date Formatting Standards
- Standard Dashboard Display: `"28 Sep 2024"` (`DD MMM YYYY`).
- Table Cells: `"14 Oct 2026"`.
- Date Pickers / ISO: `YYYY-MM-DD`.

---

## 5. Component Styling Specifications

### 5.1 KPI Metric Cards (`.lf-kpi-card-mockup`)

```css
.lf-kpi-card-mockup {
  background: var(--color-surface, #FFFFFF);
  border: 1px solid var(--color-border, #E5E7EB);
  border-radius: var(--radius-lg, 12px);
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  overflow: hidden;
}

.lf-kpi-card-mockup:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.03);
  border-color: var(--color-border-strong, #CBD5E1);
}
```

- **Top Row**: 34×34px rounded (`8px`) icon chip on the left, card title (`13px`, semi-bold `#475569`), kebab menu trigger on the right.
- **Center**: Prominent numerical amount (`22px`, bold `JetBrains Mono`).
- **Bottom Row**: Left-aligned trend badge (`11.5px`) with contextual sub-label; right-aligned data-driven CSS sparkline strip.
- **Sparkline Specs**: Gap `2.5px`, bar width `5px`, corner radius `1.5px 1.5px 0 0`, opacity graded from `0.3` to `0.9` based on chronological recency.

---

### 5.2 Business Health Gauge (`.lf-health-gauge-box`)

- **Gauge Structure**: 190×105px SVG semicircular arc (`radius: 75px`, `strokeWidth: 14px`, `strokeLinecap: round`).
- **Gradient Def**: `#FB923C` (0%) to `#F97316` (100%).
- **Circumference Math**: Total semicircle arc length = $75 \times \pi \approx 235.6\text{px}$. Active stroke offset: `235.6 - (score / 100) * 235.6`.
- **Center Display**: Score integer (`34px`, weight 800, tracking `-0.03em`), subtext `"of 100 points"` (`11.5px`, muted `#94A3B8`).
- **Breakdown Rows**: 5 items (Sales, Purchase, Receivables, Payables, Service Income) with 8×8px circular colored bullet, label, monospaced tabular amount (`text-align: right`), and percentage share (`min-width: 44px`).

---

### 5.3 Comparative Sales & Purchase Bar Chart (`.lf-chart-body`)

- **Plot Layout**: Fixed Y-axis column (4 value ticks) paired with flex container containing 5 horizontal gridlines (`#F1F0ED`).
- **Bar Columns**: 6 grouped month clusters.
- **Bar Proportions**:
  - Width: `14px` each.
  - Corner Radius: `5px 5px 0 0`.
  - Sales Bar: Branded Orange (`#F97316`), Purchase Bar: Warm Sand (`#E2D9D0` light, `#6B7280` dark).
  - Hover Interaction: Transition heights smoothly (`0.35s cubic-bezier(0.16, 1, 0.3, 1)`), render dark floating tooltip (`#1E293B`, rounded `8px`, shadow `0 4px 16px rgba(0,0,0,0.25)`).

---

### 5.4 Recent Vouchers Data Table (`.lf-vouchers-table`)

```css
.lf-vouchers-table {
  width: 100%;
  border-collapse: collapse;
}

.lf-vouchers-table th {
  padding: 10px 18px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted, #94A3B8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-border, #F1F0ED);
  background: var(--color-surface-secondary, #F8F7F4);
}

.lf-vouchers-table td {
  padding: 12px 18px;
  border-bottom: 1px solid var(--color-border-subtle, #F1F0ED);
  font-size: 12.5px;
  color: var(--color-text, #0F172A);
  vertical-align: middle;
}

.lf-vouchers-table tr:hover td {
  background-color: var(--color-surface-hover, #F8F7F4);
}
```

- **Voucher ID Column**: Rendered as an interactive link (`color: #F97316; font-weight: 600`), underlined on hover.
- **Party Column**: Clipped gracefully with `text-overflow: ellipsis` and `max-width: 160px`.
- **Amount Column**: Strict `text-align: right`, `font-weight: 600`, `font-variant-numeric: tabular-nums`.

---

### 5.5 Pill Badges (`.lf-pill-badge`)

```css
.lf-pill-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}
```

- **Voucher Types**:
  - `type-sales`: `#FFF7ED` bg, `#EA580C` text
  - `type-purchase`: `#F1F5F9` bg, `#475569` text
  - `type-receipt`: `#ECFDF5` bg, `#059669` text
  - `type-payment`: `#FEF3C7` bg, `#D97706` text
  - `type-journal`: `#F1F5F9` bg, `#475569` text
- **Voucher Status**:
  - `status-posted`: `#DCFCE7` bg, `#16A34A` text
  - `status-draft`: `#FEF3C7` bg, `#D97706` text
  - `status-cancelled`: `#FEE2E2` bg, `#DC2626` text

---

### 5.6 Scope Switcher & Segmented Controls (`.lf-scope-tabs`)

- **Track Container**: Recessed background (`#F1F0ED` light, `#1E293B` dark), padding `3px`, border-radius `8px`.
- **Tab Buttons**: Padding `5px 12px`, font size `11.5px`, radius `6px`.
- **Active Tab**: Background `var(--color-primary, #F97316)`, text `#FFFFFF`, font weight `700`.
- **Inactive Tab**: Background `transparent`, text `var(--color-text-secondary, #94A3B8)`, font weight `500`.

---

### 5.7 Quick Action Grid (`.lf-quick-actions-grid`)

- **Grid Architecture**: 2 columns (`grid-template-columns: 1fr 1fr`), gap `12px`.
- **Tile**: Background `#FFFFFF`, border `1px solid var(--color-border)`, radius `12px`, padding `12px 14px`.
- **Hover State**: Elevates by `-1px`, changes border to `#F97316`, illuminates with soft shadow (`0 3px 10px rgba(249, 115, 22, 0.10)`), translates trailing chevron `+2px`.
- **Icon Box**: 36×36px, radius `8px`, branded background tint.

---

## 6. Layout Principles & Elevation Architecture

### 6.1 Grid & Spacing Scale

The layout operates on a strict **4px baseline rhythm**:

| Spacing Token | Pixels | Application |
|:---|:---|:---|
| `--space-1` | `4px` | Pill padding, minimal element gap, micro margins |
| `--space-2` | `8px` | Icon-to-label gap, button horizontal spacing, control margins |
| `--space-3` | `12px` | Quick action tile gap, badge margins, table cell vertical padding |
| `--space-4` | `16px` | KPI grid gap, card internal padding, topbar horizontal padding |
| `--space-5` | `20px` | Panel grid gap (`lf-dashboard-grid-middle`), section bottom margins |
| `--space-6` | `24px` | Main dashboard outer top padding, large card padding |
| `--space-8` | `32px` | Dashboard horizontal margin padding (`32px` on desktop) |
| `--space-10` | `40px` | Dashboard bottom safe area clearance |

- **Container Constraints**: `.lf-dashboard` max-width is constrained to `1440px`, centered with `margin: 0 auto`.
- **Middle Row Grid**: Asymmetric 2-column layout (`grid-template-columns: 1fr 1.32fr; gap: 20px`).
- **Lower Row Grid**: Inverted asymmetric 2-column layout (`grid-template-columns: 1.32fr 1fr; gap: 20px`).

---

### 6.2 Elevation, Shadows & Depth

| Elevation Level | Light Mode Shadow | Dark Mode Shadow | Usage |
|:---|:---|:---|:---|
| **Flat / Base** | `none` | `none` | Inset panels, table track headers |
| **Level 1 (Card)** | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)` | `0 1px 3px rgba(0,0,0,0.50)` | Default state for KPI cards & panels |
| **Level 2 (Hover)** | `0 6px 18px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)` | `0 4px 12px rgba(0,0,0,0.60)` | KPI cards on hover, quick action tiles |
| **Level 3 (Flyout)** | `0 10px 25px -5px rgba(0,0,0,0.20)` | `0 12px 32px rgba(0,0,0,0.70)` | Kebab menus, action dropdowns, popovers |
| **Level 4 (Modal)** | `0 20px 60px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.08)` | `0 20px 60px rgba(0,0,0,0.85)` | Modal dialogs, voucher cancel confirmations |
| **Focus Ring** | `0 0 0 3px rgba(249, 115, 22, 0.15)` | `0 0 0 3px rgba(255, 100, 31, 0.20)` | Keyboard accessible focus states |

---

### 6.3 Corner Radius Scale

| Token | Radius Value | Applied Components |
|:---|:---|:---|
| `--radius-xs` | `4px` | Keyboard shortcut badges (`kbd`), trend delta badges, small tags |
| `--radius-sm` | `6px` | Small action buttons (`.lf-ctrl-btn`), dropdown selectors |
| `--radius-md` | `8px` | Icon boxes, search trigger inputs, form inputs |
| `--radius-lg` | `12px` | KPI cards, dashboard panels, quick action tiles |
| `--radius-xl` | `16px` | Modal dialogs, full page overlay cards |
| `--radius-pill`| `9999px` | Status badges (`.lf-pill-badge`), beacon dots, capsule tabs |

---

### 6.4 Responsive Breakpoints

```css
/* Desktop Large (Default) */
.lf-kpi-grid { grid-template-columns: repeat(5, 1fr); }
.lf-dashboard-grid-middle { grid-template-columns: 1fr 1.32fr; }
.lf-dashboard-grid-bottom { grid-template-columns: 1.32fr 1fr; }

/* Laptop / Medium Display (max-width: 1280px) */
@media (max-width: 1280px) {
  .lf-kpi-grid { grid-template-columns: repeat(3, 1fr); }
  .lf-dashboard-grid-middle,
  .lf-dashboard-grid-bottom { grid-template-columns: 1fr; }
}

/* Tablet & Mobile (max-width: 768px) */
@media (max-width: 768px) {
  .lf-dashboard { padding: 16px; }
  .lf-dashboard-header { flex-direction: column; gap: 12px; }
  .lf-kpi-grid { grid-template-columns: 1fr; }
  .lf-health-body { grid-template-columns: 1fr; }
  .lf-quick-actions-grid { grid-template-columns: 1fr; }
}
```

---

## 7. Stitch & Developer Implementation Tokens

For direct consumption in modern web applications, the complete token dictionary is exposed via CSS variables:

```css
:root, [data-theme="light"] {
  /* Brand */
  --color-primary: #F97316;
  --color-primary-hover: #EA580C;
  --color-primary-active: #C2410C;
  --color-primary-soft: rgba(249, 115, 22, 0.10);
  --color-primary-glow: 0 4px 14px rgba(249, 115, 22, 0.30);

  /* Surfaces */
  --color-background: #F8F7F4;
  --color-surface: #FFFFFF;
  --color-surface-secondary: #F8F7F4;
  --color-surface-muted: #F1F0ED;
  --color-surface-hover: #F5F4F1;

  /* Typography */
  --color-text: #0F172A;
  --color-text-secondary: #475569;
  --color-text-muted: #94A3B8;
  --color-text-disabled: #CBD5E1;

  /* Outlines */
  --color-border: #E5E7EB;
  --color-border-strong: #D1D5DB;

  /* Status */
  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-danger: #DC2626;
  --color-info: #2563EB;

  /* Typography Stacks */
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}

[data-theme="dark"] {
  /* Brand */
  --color-primary: #FF641F;
  --color-primary-hover: #FF7A3D;
  --color-primary-active: #E05315;
  --color-primary-soft: rgba(255, 100, 31, 0.14);
  --color-primary-glow: 0 4px 20px rgba(255, 100, 31, 0.35);

  /* Surfaces */
  --color-background: #080808;
  --color-surface: #151515;
  --color-surface-secondary: #191919;
  --color-surface-muted: #191919;
  --color-surface-hover: #222222;

  /* Typography */
  --color-text: #F5F5F5;
  --color-text-secondary: #8E8E8E;
  --color-text-muted: #737373;
  --color-text-disabled: #525252;

  /* Outlines */
  --color-border: #292929;
  --color-border-strong: #383838;

  /* Status */
  --color-success: #10B981;
  --color-warning: #EAB308;
  --color-danger: #EF4444;
  --color-info: #3B82F6;
}
```
