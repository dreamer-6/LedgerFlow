# LedgerFlow — Comprehensive Defect Register (UI-026)

**Project:** LedgerFlow — SIMPLE ACCOUNTING. REAL CLARITY.  
**Audit Scope:** End-to-End System Audit, Multi-Tenant Isolation, Default Data Scrub, CRUD & Settings Verification  
**Date:** 2026-10-14  
**Audit Status:** COMPLETE — 100% REMEDIATED & VERIFIED  

---

## Defect Summary Matrix

| Defect ID | Severity | Affected Feature | Classification | Remediation Status | Regression Test |
|---|---|---|---|---|---|
| **DEF-UI026-01** | High | Quotations Dashboard | Fake Seed Business Data | RESOLVED | `ui026-multicompany.test.ts` (Test 13) |
| **DEF-UI026-02** | High | Quotation Creation & Edit | Hardcoded Dummy Line Items & Addresses | RESOLVED | `npm run build` & Component Inspection |
| **DEF-UI026-03** | High | Quotation Print Preview & Export | Fictional Company Profile Fallback | RESOLVED | `ui026-e2e-workflows.test.ts` (Workflow E) |
| **DEF-UI026-04** | Medium | Global Topbar Account Menu | Fake User Identity Fallbacks | RESOLVED | `Topbar.tsx` & Auth State Audit |
| **DEF-UI026-05** | High | Business Onboarding & Seeds | Fictional City/State Seed Data | RESOLVED | `ui026-multicompany.test.ts` (Test 3) |
| **DEF-UI026-06** | Critical | Users & Permissions Settings | Broken/Missing Team Member CRUD & Sole-Owner Lockout | RESOLVED | `ui026-multicompany.test.ts` (Tests 15, 16, 17) |

---

## Detailed Defect Records

### DEF-UI026-01: Hardcoded Seed Quotation in Quotations Dashboard
- **Unique Defect ID:** `DEF-UI026-01`
- **Severity:** High
- **Classification:** Category F — Unintended fake/default production data
- **Affected Feature:** `frontend/src/pages/QuotationsDashboardView.tsx` (Quotations Dashboard & Register)
- **Reproduction Steps:**
  1. Initialize or log into any newly created business workspace with zero recorded quotations.
  2. Navigate to Quotations (`/quotations`).
  3. Observe that despite an empty database, a hardcoded quotation `qtn_seed_00056` for "ABC Enterprises" (₹14,500.00, Draft) is synthesized and displayed in the table and KPI calculations.
- **Root Cause:** A hardcoded synthetic fallback quotation array was inserted directly in the fallback branch of `QuotationsDashboardView.tsx` when `storedQuotations.length === 0`:
  ```ts
  const initialData: QuotationListItem[] = storedQuotations.length > 0 ? storedQuotations : [
    { id: 'qtn_seed_00056', quotationNumber: 'QTN-2024-001', customerName: 'ABC Enterprises', ... }
  ];
  ```
- **Fix Applied:** Removed the hardcoded fallback array. When no quotations exist in storage for the tenant, `initialData` defaults to an honest empty array `[]`, triggering genuine empty-state rendering (`No quotations found`).
- **Regression Test:** `backend/tests/ui026-multicompany.test.ts` (Test 13).
- **Verification Evidence:** Fresh company workspace loads with 0 quotations and an honest empty state; multi-company tests confirm zero cross-tenant quotation visibility.
- **Remaining Limitations:** None.

---

### DEF-UI026-02: Hardcoded Dummy Items and Fallback Cards in Quotation Creation
- **Unique Defect ID:** `DEF-UI026-02`
- **Severity:** High
- **Classification:** Category F — Unintended fake/default production data
- **Affected Feature:** `frontend/src/pages/QuotationCreationView.tsx`
- **Reproduction Steps:**
  1. Click "New Quotation" (`/quotations/new`).
  2. Observe default pre-populated items: "Dell Inspiron Desktop", "DeepCool Case Fan 120mm", "Crucial DDR4 8GB Desktop RAM", "Logitech B100 USB Optical Mouse", and "PC Assembly & Diagnostics Service".
  3. Observe customer card displaying fallback "123 Business Avenue, Industrial Complex, Coimbatore, TN - 641002" and salesperson "Praveen Kumar".
- **Root Cause:** Initial state declarations in `QuotationCreationView.tsx` initialized `items` with 5 static hardware products and hardcoded fallback strings for customer address, phone number, and salesperson.
- **Fix Applied:**
  1. Initialized `items` to an empty row `[{ id: '1', itemName: '', quantity: 1, ... }]`.
  2. Replaced hardcoded salesperson fallback with dynamic `user?.name || ''`.
  3. Replaced dummy Coimbatore address with genuine selected party address or empty prompt.
- **Regression Test:** Component unit inspection, `frontend/src/pages/QuotationCreationView.tsx` clean TypeScript build.
- **Verification Evidence:** Opening a new quotation presents an empty, unpolluted item grid ready for user input; no synthetic products or Coimbatore addresses appear.
- **Remaining Limitations:** None.

---

### DEF-UI026-03: Hardcoded Fictional Company Profile in Quotation Print/Export
- **Unique Defect ID:** `DEF-UI026-03`
- **Severity:** High
- **Classification:** Category F / G — Fictional identity fallback
- **Affected Feature:** `frontend/src/pages/QuotationPrintModal.tsx`
- **Reproduction Steps:**
  1. Open any quotation preview or print dialog.
  2. If company profile settings have not been customized, the document header displayed "Acme Traders Pvt Ltd", "42 Commercial Road, Coimbatore - 641002", "GSTIN: 33AAAAA0000A1Z5", and "State: 33-Tamil Nadu".
- **Root Cause:** Static fallback object inside `QuotationPrintModal.tsx`:
  ```ts
  const company = companyData || {
    name: 'Acme Traders Pvt Ltd',
    address: '42 Commercial Road, Coimbatore - 641002',
    ...
  };
  ```
- **Fix Applied:** Connected `QuotationPrintModal.tsx` directly to the active company context from `useBusinessStore` and `api.getCurrentCompany()`. Default fallback dynamically extracts `activeCompany?.businessName`, legal name, GSTIN, and state from authenticated business state.
- **Regression Test:** `backend/tests/ui026-e2e-workflows.test.ts` (Workflow E quotation printing verification).
- **Verification Evidence:** Printed quotation accurately bears the authentic business name ("Apex Industrial Solutions") with zero fictional Acme Traders references.
- **Remaining Limitations:** None.

---

### DEF-UI026-04: Hardcoded User Identity Fallbacks in Global Topbar
- **Unique Defect ID:** `DEF-UI026-04`
- **Severity:** Medium
- **Classification:** Category F — Unintended fake production data
- **Affected Feature:** `frontend/src/components/layout/Topbar.tsx`
- **Reproduction Steps:**
  1. Clear user profile in auth store or load Topbar with non-hydrated user state.
  2. Inspect account menu dropdown and profile pill.
  3. Profile defaulted to hardcoded personal identity "Saravanan", "saravanan@dreamtech.com", role "ADMIN", and initial "D".
- **Root Cause:** Fallback ternary operators inside `Topbar.tsx` defaulted to a developer's personal name and credentials rather than generic authenticated placeholders.
- **Fix Applied:** Refactored `userDisplayName`, `userEmail`, `userRole`, and user initial logic to dynamically derive from `authStore.user`. In the absence of an authenticated user, defaults to honest neutral placeholders ("User", "user@ledgerflow.local", "USER", "U").
- **Regression Test:** Frontend build verification and Topbar render inspection.
- **Verification Evidence:** Authenticated users see their genuine username, email, and role badge; no hardcoded personal identities appear.
- **Remaining Limitations:** None.

---

### DEF-UI026-05: Fictional City/State Seed Data in Business Creation & Defaults
- **Unique Defect ID:** `DEF-UI026-05`
- **Severity:** High
- **Classification:** Category F — Fictional seed data
- **Affected Feature:** `frontend/src/components/CreateBusinessOnboarding.tsx`, `backend/src/database/seed.ts`, `backend/src/services/business.service.ts`
- **Reproduction Steps:**
  1. Create a new company through the onboarding wizard.
  2. The company address defaulted to "42, Anna Salai, Mount Road, Chennai, Tamil Nadu - 600002" with phone "+91 98765 43210".
  3. `business.service.ts` auto-seeded dummy bank accounts "State Bank of India - Current A/c (Coimbatore Branch)" and placeholder GSTINs.
- **Root Cause:** Prototype initializers embedded placeholder Chennai/Coimbatore addresses and fictional contact numbers as hardcoded strings.
- **Fix Applied:**
  1. Updated `CreateBusinessOnboarding.tsx` form state to initialize address, phone, and email as clean empty strings `''`.
  2. Removed fictional Chennai addresses from seed templates; default address fields are empty or set to clean business-entered inputs.
  3. Preserved required statutory reference data (standard Chart of Accounts: Cash, Bank, Debtors, Creditors, Output/Input GST, Sales, Purchase) while stripping fictional geographical addresses.
- **Regression Test:** `backend/tests/ui026-multicompany.test.ts` (Test 3: Company C honest empty states).
- **Verification Evidence:** Company C creates a pristine workspace without synthetic bank branches, fake phone numbers, or dummy transactions.
- **Remaining Limitations:** None.

---

### DEF-UI026-06: Broken/Missing Company Team Member Management & Sole-Owner Lockout Protection
- **Unique Defect ID:** `DEF-UI026-06`
- **Severity:** Critical
- **Classification:** Missing CRUD implementation & Authorization Flaw
- **Affected Feature:** `frontend/src/pages/settings/UsersPermissionsTab.tsx`, `backend/src/api/routes.ts`, `backend/src/services/business.service.ts`
- **Reproduction Steps:**
  1. Navigate to Settings → Users & Permissions (`/settings?tab=users`).
  2. The team member table showed 4 hardcoded synthetic users ("Saravanan", "Abdul Rahman", "Praveen", "Karthik") with static mock badges.
  3. Clicking "Add Member", "Change Role", or "Remove Member" had no backend integration and did not persist across refresh or multi-tenant sessions.
  4. There was no server-side protection preventing an OWNER from demoting or removing themselves, potentially permanently locking out the company.
- **Root Cause:**
  1. Backend lacked tenant-isolated CRUD routes for company membership (`GET/POST /companies/current/users`, `PUT /companies/current/users/:userId/role`, `DELETE /companies/current/users/:userId`).
  2. `business_users` table existed in the schema but was only read during login; no service methods managed invitations, role updates, or member removal.
  3. Frontend `UsersPermissionsTab.tsx` relied on an in-memory static mock array.
- **Fix Applied:**
  1. Implemented complete business service methods in `backend/src/services/business.service.ts`:
     - `getCompanyMembers(companyId)`: Retrieves tenant-scoped active members with roles and join dates.
     - `addCompanyMember(companyId, inviterId, email, role, name)`: Adds an active member or sends invitation, strictly scoped to company.
     - `updateMemberRole(companyId, updaterId, targetUserId, newRole)`: Validates OWNER/ADMIN privileges; prevents self-demotion if the user is the sole remaining OWNER.
     - `removeCompanyMember(companyId, removerId, targetUserId)`: Validates privileges; strictly blocks removal of the last OWNER to prevent company lockout.
  2. Mounted secure authenticated REST routes in `backend/src/api/routes.ts`.
  3. Added client SDK methods in `frontend/src/api/client.ts`.
  4. Overhauled `frontend/src/pages/settings/UsersPermissionsTab.tsx`:
     - Replaced static mock list with live API queries.
     - Added live KPI cards: Total Members, Administrators, Accountants, Viewers.
     - Implemented "Add Team Member" modal with email, name, and role selector.
     - Implemented "Change Role" dropdown with immediate persistence.
     - Implemented "Remove Member" with confirmation dialog and error toast handling.
- **Regression Test:** `backend/tests/ui026-multicompany.test.ts` (Tests 15, 16, 17: role authorization, tenant isolation, and sole-owner lockout prevention).
- **Verification Evidence:**
  - `addCompanyMember` successfully enrolls new members into isolated tenant context.
  - Demoting/removing the sole OWNER returns HTTP 400 with message `"Cannot remove the last OWNER of a company"`.
  - All 3 tests passed 100% green.
- **Remaining Limitations:** External transactional email dispatch requires SMTP/SES configuration; in-app invitations create active memberships immediately within the workspace.
