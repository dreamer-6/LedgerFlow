"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_js_1 = require("../services/auth.service.js");
class AuthController {
    db;
    constructor(db) {
        this.db = db;
    }
    register = (req, res) => {
        try {
            const result = auth_service_js_1.AuthService.register(this.db, req.body);
            res.status(201).json(result);
        }
        catch (err) {
            if (err.message.includes('already exists') || err.message.includes('required')) {
                res.status(400).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message });
            }
        }
    };
    login = (req, res) => {
        try {
            const result = auth_service_js_1.AuthService.login(this.db, req.body);
            res.json(result);
        }
        catch (err) {
            if (err.message.includes('Invalid') || err.message.includes('required')) {
                res.status(401).json({ error: err.message });
            }
            else {
                res.status(500).json({ error: err.message });
            }
        }
    };
    /**
     * SSO is DISABLED.
     * Returns HTTP 501 with no token and no account creation.
     * Real OAuth/OIDC SSO is a separate future task.
     */
    sso = (_req, res) => {
        res.status(501).json({
            error: 'SSO authentication is not implemented. Please use email and password login.'
        });
    };
    /**
     * getMe — requires authenticate middleware to have run.
     * Re-fetches user from DB to detect deactivated accounts.
     */
    getMe = (req, res) => {
        try {
            if (!req.user?.userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }
            const result = auth_service_js_1.AuthService.getMe(this.db, req.user.userId);
            res.json(result);
        }
        catch (err) {
            if (err.message === 'USER_NOT_FOUND') {
                return res.status(401).json({ error: 'Unauthorized: Account not found or deactivated' });
            }
            res.status(500).json({ error: err.message });
        }
    };
}
exports.AuthController = AuthController;
