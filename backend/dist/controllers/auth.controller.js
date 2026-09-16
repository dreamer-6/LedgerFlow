"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_js_1 = require("../services/auth.service.js");
const routes_js_1 = require("../api/routes.js"); // Will move later
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
    getMe = (req, res) => {
        try {
            const user = (0, routes_js_1.getUserFromToken)(req);
            if (!user)
                return res.status(401).json({ error: 'Unauthorized' });
            const result = auth_service_js_1.AuthService.getMe(this.db, user.userId);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    };
}
exports.AuthController = AuthController;
