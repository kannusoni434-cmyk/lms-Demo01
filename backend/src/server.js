import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectToDatabase from './config/database.js';

import authRoutes from './routes/authRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import studentPortalRoutes from './routes/studentPortalRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { startVideoCleanupScheduler } from './services/videoCleanupService.js';
import { startKeepAlive } from './services/keepAliveService.js';

// Auto-start background workers
import './workers/videoWorker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://lms-demo-mauve.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/student', studentPortalRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api', videoRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('LMS Backend API is running');
});

export { app };

const startServer = async () => {
  await connectToDatabase();
  
  // Start the video cleanup scheduler
  startVideoCleanupScheduler();
  
  // Start keep-alive service to prevent Render from sleeping
  startKeepAlive();
  

  
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Allowing CORS for frontend: ${FRONTEND_URL}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
