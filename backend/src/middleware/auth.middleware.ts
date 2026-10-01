/**
 * Auth Middleware — DEPRECATED / COMPATIBILITY WRAPPER
 *
 * This module has been superseded by src/middleware/security.ts as part of TASK 001.
 * All security middleware functions are re-exported from security.ts for backward compatibility.
 * Direct hardcoded secrets and unmounted helpers have been removed.
 */

export {
  authenticate,
  resolveCompanyContext,
  authorize,
  assertResourceOwnership,
  jwtSecret,
  SecureRequest,
  SecureRequest as AuthRequest,
  AuthenticatedUser
} from './security.js';
