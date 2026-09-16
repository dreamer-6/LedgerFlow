# LedgerFlow

> **LedgerFlow** is a business-owned Accounting & ERP OS designed around strict double-entry accounting principles, robust inventory tracking, GST compliance, outstanding management, reporting, auditability, and secure business data isolation.

LedgerFlow is designed as a complete business accounting operating system. The central principle of the platform is that all financial and stock states are derived exclusively from immutable, atomic business transactions (vouchers). 

---

## 🏗 Architecture

LedgerFlow currently employs a monolithic full-stack architecture being refactored into a layered domain-driven design, strictly enforcing separation of concerns.

- **Frontend:** React, TypeScript, Vite. Focuses entirely on presentation and user experience.
- **Backend:** Node.js, Express, TypeScript. Handles authentication, multi-tenancy context isolation, business logic, and transaction atomicity.
- **Database:** SQLite (via `node:sqlite`'s `DatabaseSync`), functioning as an embedded, synchronous data store for high-performance localized operations. Designed to be migratable to PostgreSQL in the future.

### Application Layers

1. **Controllers Layer** (`backend/src/controllers/`) - Parses HTTP requests and shapes HTTP responses.
2. **Service Layer** (`backend/src/services/`) - Enforces business logic, permissions, and directs engines.
3. **Domain/Engine Layer** (`backend/src/domain/`) - The heart of LedgerFlow containing the strict `PostingEngine`, `InventoryEngine`, and GST calculation rules.
4. **Data Access/Repositories** - Manages schema structure, queries, and multi-tenant data isolation.

---

## ⚙️ Core Engines

### 1. The Accounting Engine
Strict enforcement of **Double-Entry Accounting**. 
For every posted accounting voucher, `TOTAL DEBIT = TOTAL CREDIT`. A transaction will mathematically fail to post if there is a discrepancy.

### 2. The Posting Engine (Transaction Atomicity)
LedgerFlow operates on the principle:
`ONE BUSINESS TRANSACTION → ONE VOUCHER → MULTIPLE EFFECTS (Accounting + Inventory + GST + Outstanding + Audit)`

When a user submits a Sales Invoice, the Posting Engine opens an atomic SQLite transaction (`BEGIN TRANSACTION`). It updates:
- Voucher headers and line items
- Ledger Entries (Sales Account, Customer Account, Tax Accounts)
- Stock Entries (Depleting inventory in a specific Godown)
- Bill Allocations (Outstanding tracking for the customer)
- Audit Logs

If any single operation fails, the engine issues a `ROLLBACK`, guaranteeing that the system never enters an inconsistent or partially initialized state.

---

## 🏢 Multi-Tenancy & Data Isolation

LedgerFlow is designed as a SaaS platform where a single User Account can own and operate **Multiple Isolated Businesses**.

1. **Authentication:** JWT-based session management verifies "Who is the user?".
2. **Business Context:** Every API request carries a business identifier (`companyId`). The backend intercepts this via `AuthMiddleware` to authorize whether the user holds a valid role (`OWNER`, `ACCOUNTANT`, `STAFF`) for that specific business.
3. **Strict Isolation:** Data sets (Ledgers, Parties, Stock Items, Vouchers, Reports) are strictly isolated by `company_id`. Business logic and queries unconditionally enforce this boundary to prevent data leakage between tenants.

---

## 🔄 Workflow & Project Structure

The project directory structure is designed to support scalable ERP development:

```text
/LedgerFlow
├── /frontend               # React UI
│   ├── /src/components     # Reusable UI elements
│   ├── /src/pages          # Primary application views (Dashboard, Voucher Entry)
│   ├── /src/styles         # Global CSS and layout styling
│   └── /src/App.tsx        # Application routing and state initialization
│
├── /backend                # Express API
│   ├── /src/api            # Route definitions and bindings
│   ├── /src/controllers    # HTTP request handlers
│   ├── /src/services       # Core business logic (Auth, Business, Masters, Vouchers)
│   ├── /src/middleware     # Request interception (JWT Auth, Tenancy)
│   ├── /src/domain         # Rule engines (Accounting, Valuation)
│   └── /src/database       # Schema, Migrations, and Seeding
│
└── LedgerFlow_Final_Project_Architecture.md  # The definitive source of truth for design
```

---

## 📊 Reporting & Financial Years

Reports in LedgerFlow (Dashboard, Daybook, Trial Balance, Profit & Loss, Balance Sheet, Stock Summary) are **never** the source of truth—they are aggregations derived dynamically from the atomic ledger and stock entries. 

Data is bounded by **Financial Years** (e.g., April 1 - March 31). Active financial years are managed strictly; closing balances of a preceding year mathematically carry over as opening balances for the active year.

---

## 🚀 Getting Started

To run the application locally in development mode:

1. **Terminal 1 (Backend):**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Terminal 2 (Frontend):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

*(Note: The system requires Node.js v22.5.0+ to utilize `node:sqlite` natively.)*
