"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessController = void 0;
const business_service_js_1 = require("../services/business.service.js");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class BusinessController {
    db;
    constructor(db) {
        this.db = db;
    }
    /**
     * GET /businesses
     * Returns businesses the authenticated user is a member of.
     * Requires: authenticate (no company context needed)
     */
    getBusinesses = (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const businesses = business_service_js_1.BusinessService.getBusinesses(this.db, req.user.userId);
            res.json(businesses);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    /**
     * POST /businesses
     * Creates a new isolated business for the authenticated user.
     * Requires: authenticate
     */
    createBusiness = (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'Authentication required to create a new business.' });
            }
            const company = business_service_js_1.BusinessService.createBusiness(this.db, req.user.userId, req.body);
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
    /**
     * GET /companies/current
     * Requires: authenticate + resolveCompanyContext
     */
    getCurrentCompanyInfo = (req, res) => {
        try {
            if (!req.companyId) {
                return res.json({ company: null, activeFinancialYear: null });
            }
            const info = business_service_js_1.BusinessService.getCurrentCompanyInfo(this.db, req.companyId);
            res.json(info);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    /**
     * PUT /companies/current
     * Requires: authenticate + resolveCompanyContext + ADMIN
     */
    updateCurrentCompany = (req, res) => {
        try {
            if (!req.companyId) {
                return res.status(400).json({ error: 'No company selected to update.' });
            }
            // Use the server-resolved companyId — never trust req.body.company_id
            business_service_js_1.BusinessService.updateCurrentCompany(this.db, req.companyId, req.body);
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    /**
     * POST /companies/:id/delete
     * Requires: authenticate (password re-entry provides additional verification)
     * The user must have OWNER membership in the target company.
     */
    deleteCompany = (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'Authentication required to delete company.' });
            }
            const { password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Account password is required to verify company deletion.' });
            }
            const dbUser = this.db.prepare('SELECT user_id, password_hash FROM users WHERE user_id = ?').get(req.user.userId);
            if (!dbUser || !bcryptjs_1.default.compareSync(password, dbUser.password_hash)) {
                return res.status(401).json({ error: 'Incorrect account password. Company deletion rejected.' });
            }
            const targetCompanyId = req.params.id;
            // Verify OWNER membership before allowing deletion
            const membership = this.db.prepare("SELECT role FROM user_businesses WHERE user_id = ? AND company_id = ? AND role = 'OWNER'").get(req.user.userId, targetCompanyId);
            if (!membership) {
                return res.status(403).json({ error: 'Forbidden: Only company OWNER can delete this business.' });
            }
            const result = business_service_js_1.BusinessService.deleteCompany(this.db, req.user.userId, targetCompanyId);
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
    /**
     * GET /financial-years
     * Requires: authenticate + resolveCompanyContext
     */
    getFinancialYears = (req, res) => {
        try {
            if (!req.companyId)
                return res.json([]);
            const fys = business_service_js_1.BusinessService.getFinancialYears(this.db, req.companyId);
            res.json(fys);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
    /**
     * POST /financial-years
     * Requires: authenticate + resolveCompanyContext + ADMIN
     */
    createFinancialYear = (req, res) => {
        try {
            if (!req.companyId) {
                return res.status(400).json({ error: 'No company selected for financial year creation.' });
            }
            // Use server-resolved companyId — never trust req.body.companyId
            const fy = business_service_js_1.BusinessService.createFinancialYear(this.db, req.companyId, req.body);
            res.status(201).json(fy);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    };
    /**
     * PUT /financial-years/:fyId
     * Requires: authenticate + resolveCompanyContext + ADMIN (or OWNER for reopening closed years)
     */
    updateFinancialYearStatus = (req, res) => {
        try {
            if (!req.companyId) {
                return res.status(400).json({ error: 'No company context.' });
            }
            const { fyId } = req.params;
            const { status, reason } = req.body;
            // Verify the financial year belongs to this company
            const fy = this.db.prepare('SELECT fy_id FROM financial_years WHERE fy_id = ? AND company_id = ?').get(fyId, req.companyId);
            if (!fy) {
                return res.status(404).json({ error: 'Financial year not found for this company.' });
            }
            const updated = business_service_js_1.BusinessService.updateFinancialYearStatus(this.db, req.companyId, fyId, status, req.membershipRole || req.user?.role, reason, req.user?.userId);
            res.json(updated);
        }
        catch (err) {
            if (err.message && err.message.includes('Only the company OWNER')) {
                return res.status(403).json({ error: err.message });
            }
            res.status(400).json({ error: err.message });
        }
    };
}
exports.BusinessController = BusinessController;
