import { Request, Response } from 'express';
import { DatabaseSync } from 'node:sqlite';
import { BusinessService } from '../services/business.service.js';
import { getUserFromToken, resolveCompanyId } from '../api/routes.js'; // Will move later

export class BusinessController {
  constructor(private db: DatabaseSync) {}

  getBusinesses = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const businesses = BusinessService.getBusinesses(this.db, user?.userId);
      res.json(businesses);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  createBusiness = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      if (!user?.userId) {
        return res.status(401).json({ error: 'Authentication required to create a new business.' });
      }

      const company = BusinessService.createBusiness(this.db, user.userId, req.body);
      res.status(201).json({
        company,
        message: 'Business created and isolated accounting initialized successfully.'
      });
    } catch (err: any) {
      if (err.message.includes('required')) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  };

  getCurrentCompanyInfo = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, this.db, user);
      if (!companyId) {
        return res.json({ company: null, activeFinancialYear: null });
      }
      
      const info = BusinessService.getCurrentCompanyInfo(this.db, companyId);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  updateCurrentCompany = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, this.db, user);
      const targetId = req.body.company_id || companyId;
      if (!targetId) {
        return res.status(400).json({ error: 'No company selected to update.' });
      }

      BusinessService.updateCurrentCompany(this.db, targetId, req.body);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  deleteCompany = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      if (!user?.userId) {
        return res.status(401).json({ error: 'Authentication required to delete company.' });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Account password is required to verify company deletion.' });
      }

      // We should ideally call AuthService for this but for now we duplicate the simple check
      const bcrypt = require('bcryptjs');
      const dbUser = this.db.prepare('SELECT user_id, password_hash FROM users WHERE user_id = ?').get(user.userId) as any;
      if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
        return res.status(401).json({ error: 'Incorrect account password. Company deletion rejected.' });
      }

      const targetCompanyId = req.params.id;
      const result = BusinessService.deleteCompany(this.db, user.userId, targetCompanyId);
      res.json(result);
    } catch (err: any) {
      if (err.message.includes('permission')) {
         res.status(403).json({ error: err.message });
      } else {
         res.status(500).json({ error: err.message });
      }
    }
  };

  getFinancialYears = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, this.db, user);
      if (!companyId) return res.json([]);
      
      const fys = BusinessService.getFinancialYears(this.db, companyId);
      res.json(fys);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  createFinancialYear = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const targetCompanyId = req.body.companyId || resolveCompanyId(req, this.db, user);
      if (!targetCompanyId) {
        return res.status(400).json({ error: 'No company selected for financial year creation.' });
      }

      const fy = BusinessService.createFinancialYear(this.db, targetCompanyId, req.body);
      res.status(201).json(fy);
    } catch (err: any) {
      if (err.message.includes('required')) {
         res.status(400).json({ error: err.message });
      } else {
         res.status(500).json({ error: err.message });
      }
    }
  };

  updateFinancialYearStatus = (req: Request, res: Response) => {
    try {
      const user = getUserFromToken(req);
      const companyId = resolveCompanyId(req, this.db, user);
      const { fyId } = req.params;
      const { status } = req.body;

      const updated = BusinessService.updateFinancialYearStatus(this.db, companyId, fyId, status);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
