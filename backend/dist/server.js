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
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '15mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '15mb' }));
// Initialize Database & Seeds
const db = (0, connection_js_1.getDatabase)();
(0, seed_js_1.seedInitialData)(db);
// Mount API Routes
app.use('/api', (0, routes_js_1.createApiRouter)(db));
// Root Health Check
app.get('/', (req, res) => {
    res.json({
        name: 'LedgerFlow Backend API',
        status: 'online',
        engine: 'Double-Entry Accounting, Inventory & GST Operating System',
        version: '1.0.0'
    });
});
app.listen(PORT, () => {
    console.log(`[LedgerFlow] Backend Server running on http://localhost:${PORT}`);
});
