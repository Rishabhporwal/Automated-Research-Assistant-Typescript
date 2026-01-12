import "reflect-metadata";
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import * as path from 'path';
import { reportRoutes } from './api/routes/reportRoutes';
import { Logger } from './utils/logger';

const app = express();
const port = process.env.PORT || 3000;
const logger = new Logger('App');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'static')));

// Routes
app.use('/', reportRoutes);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Start server
app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`🔗 Test endpoint: http://localhost:${port}/api/test`);
  console.log(`🔐 Login: http://localhost:${port} (admin/admin123)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export { app };