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
import { config } from './config/env.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.webOrigin, credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(morgan('dev'));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.use('/api/notifications', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/telegram', telegramRoutes);

app.use((error, _request, response, _next) => {
  console.error('[server] request failed:', error.message);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});

export default app;
