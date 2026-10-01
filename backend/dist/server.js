"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const connection_js_1 = require("./database/connection.js");
const seed_js_1 = require("./database/seed.js");
const routes_js_1 = require("./api/routes.js");
const security_js_1 = require("./middleware/security.js");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// ── CORS ──────────────────────────────────────────────────────────────────
// ALLOWED_ORIGIN must be set in production.
// Development default allows localhost:5173 (Vite dev server).
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin)
            return callback(null, true);
        if (origin === allowedOrigin)
            return callback(null, true);
        callback(new Error(`CORS: Origin '${origin}' is not allowed`));
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '15mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '15mb' }));
// ── Initialize JWT Secret early so it fails fast if misconfigured ─────────
(0, security_js_1.jwtSecret)();
// ── Database & Seed ────────────────────────────────────────────────────────
const db = (0, connection_js_1.getDatabase)();
(0, seed_js_1.seedInitialData)(db);
// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api', (0, routes_js_1.createApiRouter)(db));
// ── Health Check ───────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        name: 'LedgerFlow Backend API',
        status: 'online',
        engine: 'Double-Entry Accounting, Inventory & GST Operating System',
        version: '2.0.0'
    });
});
app.listen(PORT, () => {
    console.log(`[LedgerFlow] Backend Server running on http://localhost:${PORT}`);
    if (process.env.NODE_ENV === 'production') {
        console.log(`[LedgerFlow] CORS allowed origin: ${allowedOrigin}`);
    }
});
