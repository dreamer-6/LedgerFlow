# SEC-010: Production Security Hardening Implementation Plan

**Task ID:** SEC-010  
**Date:** 2026-10-16  
**Status:** In Progress (Plan Phase)  
**Target:** Production-grade security hardening for authentication, JWT configuration, rate limiting, and data disclosure prevention.  

---

## 1. Confirmed Security Findings & Audit Evidence

### Finding 1: Unrestricted Brute-Force Vulnerability on `/api/auth/login`
- **Location:** `backend/src/api/routes.ts` (line 64), `backend/src/controllers/auth.controller.ts` (lines 22–33)
- **Severity:** High
- **Practical Impact:** Attackers can send unlimited automated credential guessing attempts per minute. In addition to password cracking, bcrypt password hashing is deliberately CPU intensive; an unthrottled flood of login attempts will exhaust server CPU threads, causing Denial of Service (DoS) for all tenants.
- **Evidence:** `routes.ts` routes `POST /auth/login` directly to `authController.login` without rate limiting middleware.

### Finding 2: Permissive JWT Secret Validation in Production
- **Location:** `backend/src/middleware/security.ts` (lines 22–54), `backend/src/server.ts` (line 31)
- **Severity:** High
- **Practical Impact:** Currently, `getJwtSecret()` only verifies if `process.env.JWT_SECRET` is truthy. In production, if an operator sets `JWT_SECRET="secret"`, `JWT_SECRET="123456"`, or any weak value under 32 characters, the server starts up without complaint. Weak secrets can be cracked in seconds using offline hashcat dictionaries, allowing attackers to forge arbitrary JWT tokens with `OWNER` role across any company. Furthermore, `process.exit(1)` is called directly inside `security.ts`, which terminates test runners rather than throwing catchable errors.
- **Evidence:** Inspection of `backend/src/middleware/security.ts` confirms lack of minimum length and entropy checks for production mode.

### Finding 3: Company Vault Password Hash Disclosure in API Responses
- **Location:** `backend/src/services/business.service.ts` (lines 18, 56, 60, 204)
- **Severity:** Medium
- **Practical Impact:** `SELECT c.* FROM companies c` and `SELECT * FROM companies` query results include `vault_password_hash`. When `getCurrentCompanyInfo`, `getBusinesses`, or `createBusiness` return the company object, the bcrypt hash of the company vault password is transmitted over HTTP in clear JSON. Any viewer or interceptor can harvest the hash for offline cracking.
- **Evidence:** Verified in `business.service.ts`: `db.prepare('SELECT * FROM companies ...').get()` returns the raw row including `vault_password_hash`.

### Finding 4: Insecure Pseudo-Random Fallback in Development
- **Location:** `backend/src/middleware/security.ts` (line 31)
- **Severity:** Low (Development only)
- **Practical Impact:** In non-production environments when `JWT_SECRET` is unset, the secret was generated using `Math.random().toString(36)`. `Math.random()` is not cryptographically secure and is vulnerable to PRNG state recovery.
- **Evidence:** Line 31 of `security.ts`: `const devSecret = 'dev_' + Math.random().toString(36)...`.

---

## 2. Minimal Changes Required

### Change 1: Standalone High-Performance Rate Limiter Middleware
- **New File:** `backend/src/middleware/rateLimiter.ts`
- **Design:**
  - Zero-dependency, thread-safe in-memory sliding window rate limiter.
  - Dual-key tracking: Throttles by client IP address and by normalized login identifier (`email`/`username`).
  - Configuration:
    - Login Rate Limit: Max 10 attempts per 15 minutes per IP; max 5 failed attempts per 15 minutes per account identifier.
    - Standard HTTP 429 response with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.
  - Success Reset: Legitimate users with successful credentials immediately clear their failure count so honest typos never accumulate into a lockout.
  - Automated memory cleanup: Expired window timestamps are pruned periodically to prevent memory leaks.
  - Test helper: Exported `resetRateLimits()` function for clean unit and integration test assertions.

### Change 2: Production-Grade JWT Secret Verification
- **Target File:** `backend/src/middleware/security.ts`
- **Design:**
  - In `production` (`process.env.NODE_ENV === 'production'`):
    - Must be defined, non-empty, and non-whitespace.
    - Must be at least 32 characters (256 bits of entropy).
    - Must not match well-known insecure defaults (`'secret'`, `'jwt_secret'`, `'changeme'`, `'password'`, `'12345678901234567890123456789012'`).
    - Throws `Error('FATAL: JWT_SECRET environment variable is required in production and must be at least 32 characters long.')`.
  - In `development` / `test`:
    - If `process.env.JWT_SECRET` is set, uses it.
    - If not set, generates a cryptographically secure 256-bit random secret via `crypto.randomBytes(32).toString('hex')`.
  - Catch fatal error in `server.ts` and exit cleanly with code 1.

### Change 3: Sanitize Company Object Outputs
- **Target File:** `backend/src/services/business.service.ts`
- **Design:**
  - Create a private helper `sanitizeCompany(company: any)` that unconditionally deletes `vault_password_hash` before returning company data to API controllers.
  - Apply in `getCurrentCompanyInfo`, `getBusinesses`, and `createBusiness`.

### Change 4: Attach Rate Limiter to Auth Routes
- **Target File:** `backend/src/api/routes.ts`, `backend/src/controllers/auth.controller.ts`
- **Design:**
  - Apply `loginRateLimiter` to `POST /api/auth/login`.
  - On failed login, increment account failure count and return 401 with standard rate-limit headers.
  - On successful login, clear account failure counter.

---

## 3. Regression Risks & Prevention Strategy

| Risk | Mitigation |
| :--- | :--- |
| **Legitimate user locked out by past typos** | Successful authentication clears failed attempt records for both IP and user account. |
| **Existing test suites broken by rate limit** | In test environment (`NODE_ENV === 'test'` or via `resetRateLimits()`), rate limiter can be reset or bypassed during bulk fixture setup. |
| **Accounting or Inventory integrity regressions** | Rate limiting is isolated to auth entry routes. No changes will touch `posting-engine.ts`, `accountingEngine.ts`, `valuation.ts`, or schema. |
| **Existing business switcher broken by sanitized companies** | Frontend uses `company_name`, `gstin`, `state`, etc. Frontend never reads `vault_password_hash` directly; stripping it has 0 frontend impact. |

---

## 4. Verification & Testing Strategy

1. **Dedicated Security Test Suite:**
   - Create `backend/tests/sec-010-hardening.test.ts`:
     - Test 1: Excessive failed login attempts trigger HTTP 429 Too Many Requests.
     - Test 2: Standard rate-limiting headers (`Retry-After`, `X-RateLimit-Remaining`) are present.
     - Test 3: Successful login resets failed attempts for that user/IP.
     - Test 4: Missing `JWT_SECRET` in `NODE_ENV === 'production'` throws fatal error.
     - Test 5: Weak/short `JWT_SECRET` (<32 chars) in `NODE_ENV === 'production'` throws fatal error.
     - Test 6: Strong `JWT_SECRET` in `NODE_ENV === 'production'` succeeds.
     - Test 7: `GET /api/companies/current` and `GET /api/businesses` never return `vault_password_hash`.
2. **Full Regression Suite:**
   - Run `npm --prefix backend test` (all 12 existing test suites must pass 100%).
   - Run backend TypeScript build (`npm --prefix backend run build`).
   - Run frontend build (`npm --prefix frontend run build`).
