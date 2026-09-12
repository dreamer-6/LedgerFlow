import express from 'express';
import cors from 'cors';
import { getDatabase } from './database/connection.js';
import { seedInitialData } from './database/seed.js';
import { createApiRouter } from './api/routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database & Seeds
const db = getDatabase();
seedInitialData(db);

// Mount API Routes
app.use('/api', createApiRouter(db));

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
