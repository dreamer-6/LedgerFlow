import { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AuthService } from '../services/auth.service.js';
import { SecureRequest } from '../middleware/security.js';

export class AuthController {
  constructor(private db: DatabaseSync) {}

  register = (req: Request, res: Response) => {
    try {
      const result = AuthService.register(this.db, req.body);
      res.status(201).json(result);
    } catch (err: any) {
      if (err.message.includes('already exists') || err.message.includes('required')) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  };

  login = (req: Request, res: Response) => {
    try {
      const result = AuthService.login(this.db, req.body);
      res.json(result);
    } catch (err: any) {
      if (err.message.includes('Invalid') || err.message.includes('required')) {
        res.status(401).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  };

  /**
   * SSO is DISABLED.
   * Returns HTTP 501 with no token and no account creation.
   * Real OAuth/OIDC SSO is a separate future task.
   */
  sso = (_req: Request, res: Response) => {
    res.status(501).json({
      error: 'SSO authentication is not implemented. Please use email and password login.'
    });
  };

  /**
   * getMe — requires authenticate middleware to have run.
   * Re-fetches user from DB to detect deactivated accounts.
   */
  getMe = (req: SecureRequest, res: Response) => {
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const result = AuthService.getMe(this.db, req.user.userId);
      res.json(result);
    } catch (err: any) {
      if (err.message === 'USER_NOT_FOUND') {
        return res.status(401).json({ error: 'Unauthorized: Account not found or deactivated' });
      }
      res.status(500).json({ error: err.message });
    }
  };
}
