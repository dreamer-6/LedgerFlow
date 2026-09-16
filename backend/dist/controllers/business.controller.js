"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessController = void 0;
const business_service_js_1 = require("../services/business.service.js");
const routes_js_1 = require("../api/routes.js"); // Will move later
class BusinessController {
    db;
    constructor(db) {
        this.db = db;
    }
    getBusinesses = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const businesses = business_service_js_1.BusinessService.getBusinesses(this.db, user?.userId);
            res.json(businesses);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    createBusiness = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            if (!user?.userId) {
                return res.status(401).json({ error: 'Authentication required to create a new business.' });
            }
            const company = business_service_js_1.BusinessService.createBusiness(this.db, user.userId, req.body);
            res.status(201).json({
                company,
                message: 'Business created and isolated accounting initialized successfully.'
            });
        }
        catch (err) {
            if (err.message.includes('required')) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message });
            }
        }
    };
    getCurrentCompanyInfo = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId) {
                return res.json({ company: null, activeFinancialYear: null });
            }
            const info = business_service_js_1.BusinessService.getCurrentCompanyInfo(this.db, companyId);
            res.json(info);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    updateCurrentCompany = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            const targetId = req.body.company_id || companyId;
            if (!targetId) {
                return res.status(400).json({ error: 'No company selected to update.' });
            }
            business_service_js_1.BusinessService.updateCurrentCompany(this.db, targetId, req.body);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    deleteCompany = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            if (!user?.userId) {
                return res.status(401).json({ error: 'Authentication required to delete company.' });
            }
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Account password is required to verify company deletion.' });
            }
            // We should ideally call AuthService for this but for now we duplicate the simple check
            const bcrypt = require('bcryptjs');
            const dbUser = this.db.prepare('SELECT user_id, password_hash FROM users WHERE user_id = ?').get(user.userId);
            if (!dbUser || !bcrypt.compareSync(password, dbUser.password_hash)) {
                return res.status(401).json({ error: 'Incorrect account password. Company deletion rejected.' });
            }
            const targetCompanyId = req.params.id;
            const result = business_service_js_1.BusinessService.deleteCompany(this.db, user.userId, targetCompanyId);
            res.json(result);
        }
        catch (err) {
            if (err.message.includes('permission')) {
                res.status(403).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message });
            }
        }
    };
    getFinancialYears = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!companyId)
                return res.json([]);
            const fys = business_service_js_1.BusinessService.getFinancialYears(this.db, companyId);
            res.json(fys);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    createFinancialYear = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const targetCompanyId = req.body.companyId || (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            if (!targetCompanyId) {
                return res.status(400).json({ error: 'No company selected for financial year creation.' });
            }
            const fy = business_service_js_1.BusinessService.createFinancialYear(this.db, targetCompanyId, req.body);
            res.status(201).json(fy);
        }
        catch (err) {
            if (err.message.includes('required')) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message });
            }
        }
    };
    updateFinancialYearStatus = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            const companyId = (0, routes_js_1.resolveCompanyId)(req, this.db, user);
            const { fyId } = req.params;
            const { status } = req.body;
            const updated = business_service_js_1.BusinessService.updateFinancialYearStatus(this.db, companyId, fyId, status);
            res.json(updated);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
}
exports.BusinessController = BusinessController;
