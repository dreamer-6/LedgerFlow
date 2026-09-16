"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'ledgerflow_secure_secret_key_2026';
function requireAuth(db) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Unauthorized: Missing token' });
        }
        try {
            const token = authHeader.replace('Bearer ', '');
            const user = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = user;
            // Resolve company context
            const headerId = req.headers['x-company-id'];
            const queryId = req.query.companyId;
            const requested = headerId || queryId;
            if (requested) {
                const access = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? AND company_id = ?').get(user.userId, requested);
                if (access) {
                    req.companyId = access.company_id;
                }
            }
            if (!req.companyId) {
                // Fallback to first company
                const first = db.prepare('SELECT company_id FROM user_businesses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(user.userId);
                if (first)
                    req.companyId = first.company_id;
            }
            if (!req.companyId) {
                return res.status(403).json({ error: 'Forbidden: No business context found.' });
            }
            next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
    };
}
