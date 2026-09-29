/**
 * LedgerFlow Security Middleware — TASK 001
 *
 * Three-layer security pipeline:
 *   1. authenticate          — validates JWT, rejects unauthenticated requests
 *   2. resolveCompanyContext — validates company membership, sets req.companyId + req.membershipRole
 *   3. authorize(roles)      — enforces minimum business-role on company-scoped routes
 *
 * This module is the ONLY source of JWT_SECRET.
 * All route handlers must use req.user / req.companyId set by these middlewares.
 * The frontend may hint a company context but the backend ALWAYS verifies membership.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';

// --------------------------------------------------------------------------
// JWT_SECRET — single authoritative source
// --------------------------------------------------------------------------

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL] JWT_SECRET environment variable is not set. Server will not start.');
      process.exit(1);
    }
    // Development only — generate a process-local random secret (not persisted)
    // This means tokens from one dev process will not be valid in another, which is acceptable.
    const devSecret = 'dev_' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    console.warn(
      '[SECURITY WARNING] JWT_SECRET is not set. Using a random development secret. ' +
      'All tokens will be invalidated on server restart. Set JWT_SECRET in .env for stable development.'
    );
    // Cache it for the process lifetime
    (getJwtSecret as any)._devSecret = devSecret;
    return devSecret;
  }
  return secret;
}

// Memoize — call once per process
let _secret: string | null = null;
export function jwtSecret(): string {
  if (!_secret) {
    if ((getJwtSecret as any)._devSecret) {
      _secret = (getJwtSecret as any)._devSecret;
    } else {
      _secret = getJwtSecret();
    }
  }
  return _secret!;
}

// --------------------------------------------------------------------------
// Augmented request types
// --------------------------------------------------------------------------

export interface AuthenticatedUser {
  userId: string;
  username: string;
  role: string;
  name: string;
  email: string;
}

export interface SecureRequest extends Request {
  user?: AuthenticatedUser;
  companyId?: string;
  membershipRole?: string;  // user_businesses.role for the resolved company
}

// --------------------------------------------------------------------------
// 1. authenticate — validates JWT, verifies user exists & active in DB, never falls back to anonymous
// --------------------------------------------------------------------------

function executeAuth(db: DatabaseSync | null, req: SecureRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or malformed token' });
    return;
  }

  const token = authHeader.slice(7); // strip 'Bearer '
  try {
    const payload = jwt.verify(token, jwtSecret()) as any;

    // Validate required fields exist in token
    if (!payload?.userId) {
      res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
      return;
    }

    // SECURITY (Scenario 20): Validate user still exists and is active in database
    let activeDb = db;
    if (!activeDb) {
      try {
        const { getDatabase } = require('../database/connection.js');
        activeDb = getDatabase();
      } catch {
        activeDb = null;
      }
    }

    if (activeDb) {
      const dbUser = activeDb.prepare(
        'SELECT user_id, username, role, full_name, email, is_active FROM users WHERE user_id = ?'
      ).get(payload.userId) as any;

      if (!dbUser || dbUser.is_active !== 1) {
        res.status(401).json({ error: 'Unauthorized: User account not found or deactivated' });
        return;
      }

      req.user = {
        userId: dbUser.user_id,
        username: dbUser.username || '',
        role: dbUser.role || 'USER',
        name: dbUser.full_name || '',
        email: dbUser.email || ''
      };
    } else {
      req.user = {
        userId: payload.userId,
        username: payload.username || '',
        role: payload.role || 'USER',
        name: payload.name || '',
        email: payload.email || ''
      };
    }

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Unauthorized: Token has expired' });
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  }
}

export function authenticate(dbOrReq?: DatabaseSync | SecureRequest, res?: Response, next?: NextFunction): any {
  // If called directly as middleware: authenticate(req, res, next)
  if (res && next && dbOrReq && 'headers' in (dbOrReq as any)) {
    return executeAuth(null, dbOrReq as SecureRequest, res, next);
  }

  // If called as factory: authenticate(db)
  const explicitDb = (dbOrReq && !('headers' in (dbOrReq as any))) ? (dbOrReq as DatabaseSync) : null;
  return (req: SecureRequest, response: Response, nextFn: NextFunction) => {
    executeAuth(explicitDb, req, response, nextFn);
  };
}

// --------------------------------------------------------------------------
// 2. resolveCompanyContext — verifies company membership, sets companyId + membershipRole
//
// Rules (per approved architecture):
//   - User must be authenticated (authenticate must run first)
//   - If x-company-id header OR ?companyId query param is provided, verify membership
//   - If no context supplied AND user has exactly ONE business → use it
//   - If no context supplied AND user has MULTIPLE businesses → 400 (require explicit selection)
//   - global users.role is NEVER used as a tenant bypass
//   - Never fall back to first company in DB
// --------------------------------------------------------------------------

export function resolveCompanyContext(db: DatabaseSync) {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    const headerId = (req.headers['x-company-id'] as string) || undefined;
    const queryId = (req.query.companyId as string) || (req.query.company_id as string) || undefined;
    const bodyId = (req.body?.companyId as string) || undefined;
    const requested = headerId || queryId;

    // If a specific company was requested, verify membership
    if (requested) {
      const membership = db.prepare(
        'SELECT company_id, role FROM user_businesses WHERE user_id = ? AND company_id = ?'
      ).get(req.user.userId, requested) as { company_id: string; role: string } | undefined;

      if (membership) {
        req.companyId = membership.company_id;
        req.membershipRole = membership.role;
        next();
        return;
      }

      // No membership — reject. Do NOT disclose whether company exists.
      res.status(403).json({ error: 'Forbidden: You do not have access to this business' });
      return;
    }

    // No company specified — look up memberships
    const memberships = db.prepare(
      'SELECT company_id, role FROM user_businesses WHERE user_id = ? ORDER BY created_at ASC'
    ).all(req.user.userId) as { company_id: string; role: string }[];

    if (memberships.length === 0) {
      res.status(403).json({ error: 'Forbidden: No business memberships found for this account' });
      return;
    }

    if (memberships.length === 1) {
      // Exactly one membership — safe to auto-resolve
      req.companyId = memberships[0].company_id;
      req.membershipRole = memberships[0].role;
      next();
      return;
    }

    // Multiple memberships — require explicit selection
    res.status(400).json({
      error: 'Business context required: You have multiple businesses. Please select one.',
      businesses: memberships.map(m => m.company_id)
    });
  };
}

// --------------------------------------------------------------------------
// 3. authorize — enforces minimum membership role on the resolved company
//
// Role hierarchy (highest to lowest): OWNER > ADMIN > ACCOUNTANT > VIEWER
// --------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 1,
  ACCOUNTANT: 2,
  ADMIN: 3,
  OWNER: 4
};

/**
 * Returns middleware that rejects if the user's membership role is below any of allowedRoles.
 * Always use AFTER resolveCompanyContext.
 */
export function authorize(...allowedRoles: string[]) {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.companyId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.membershipRole || ''] ?? 0;
    const requiredLevel = Math.min(...allowedRoles.map(r => ROLE_HIERARCHY[r] ?? 99));

    if (userLevel < requiredLevel) {
      res.status(403).json({
        error: `Forbidden: This action requires ${allowedRoles.join(' or ')} role`
      });
      return;
    }

    next();
  };
}

// --------------------------------------------------------------------------
// Utility: verify that a resource belongs to the resolved company
// Returns 404 if not found or belongs to different company (no existence disclosure)
// --------------------------------------------------------------------------

export function assertResourceOwnership(
  res: Response,
  resourceCompanyId: string | null | undefined,
  resolvedCompanyId: string
): boolean {
  if (!resourceCompanyId || resourceCompanyId !== resolvedCompanyId) {
    res.status(404).json({ error: 'Not found' });
    return false;
  }
  return true;
}
