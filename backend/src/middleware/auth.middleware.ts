import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { DatabaseSync } from 'node:sqlite';

const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';

export interface AuthRequest extends Request {
  user?: any;
  companyId?: string;
}

export function requireAuth(db: DatabaseSync) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

    try {
      const token = authHeader.replace('Bearer ', '');
      const user = jwt.verify(token, JWT_SECRET) as any;
      req.user = user;

      // Resolve company context
      const headerId = req.headers['x-company-id'] as string;
      const queryId = req.query.companyId as string;
      const requested = headerId || queryId;

      if (requested) {
        const access = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? AND company_id = ?').get(user.userId, requested) as any;
        if (access) {
          req.companyId = access.company_id;
        } else if (user.role === 'ADMIN') {
          const compExists = db.prepare('SELECT company_id FROM companies WHERE company_id = ?').get(requested) as any;
          if (compExists) req.companyId = compExists.company_id;
        }
      }

      if (!req.companyId) {
        // Fallback to first company
        const first = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(user.userId) as any;
        if (first) {
          req.companyId = first.company_id;
        } else if (user.role === 'ADMIN') {
          const anyComp = db.prepare('SELECT company_id FROM companies ORDER BY created_at ASC LIMIT 1').get() as any;
          if (anyComp) req.companyId = anyComp.company_id;
        }
      }

      if (!req.companyId) {
         return res.status(403).json({ error: 'Forbidden: No business context found.' });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
  };
}
