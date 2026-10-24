import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/authRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import telegramRoutes from './routes/telegramRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config/env.js';
import { pool } from './config/db.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: [
        "'self'",
        "data:",
        "https://images.unsplash.com",
        "https://encrypted-tbn0.gstatic.com",
        "https://w7.pngwing.com",
        ...config.mediaAllowedHosts.map((host) => `https://${host}`),
      ],
      frameSrc: ["'self'", "https://www.google.com"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || config.webOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '32kb' }));
app.use(morgan('dev'));

// Static public uploads directory
app.use('/uploads', express.static(resolve(currentDir, '../public/uploads'), {
  maxAge: '7d',
  immutable: true,
}));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/api/health/database', async (_request, response) => {
  try {
    await pool.query('SELECT 1');
    return response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('[database] health check failed:', { code: error.code ?? null });
    return response.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/groups', groupRoutes);

app.use((error, _request, response, _next) => {
  console.error('[server] request failed:', error.message);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});

export default app;
