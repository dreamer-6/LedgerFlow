import { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { AuthService } from '../services/auth.service.js';
import { getUserFromToken } from '../api/routes.js'; // Will move later

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

  sso = (req: Request, res: Response) => {
    try {
      const result = AuthService.ssoLogin(this.db, req.body);
      res.json(result);
    } catch (err: any) {
      if (err.message.includes('required') || err.message.includes('deactivated')) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  };

  getMe = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      
      const result = AuthService.getMe(this.db, user.userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
