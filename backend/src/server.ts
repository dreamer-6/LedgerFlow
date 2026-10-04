import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { getDatabase } from './database/connection.js';
import { seedInitialData } from './database/seed.js';
import { createApiRouter } from './api/routes.js';
import { jwtSecret } from './middleware/security.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────────────────
// ALLOWED_ORIGIN can be set in production.
// Development allows any localhost or 127.0.0.1 port (3000, 5173, etc.).
const allowedOrigin = process.env.ALLOWED_ORIGIN;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin)
    if (!origin) return callback(null, true);
    if (allowedOrigin && origin === allowedOrigin) return callback(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' is not allowed`));
  },
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// ── Initialize JWT Secret early so it fails fast if misconfigured ─────────
jwtSecret();

// ── Database & Seed ────────────────────────────────────────────────────────
const db = getDatabase();
seedInitialData(db);

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api', createApiRouter(db));

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
