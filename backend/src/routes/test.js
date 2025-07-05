import express from 'express';

const router = express.Router();

// Test endpoint to verify backend is working
router.get('/test', (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    session: req.session ? 'Session management enabled' : 'No session',
    environment: process.env.NODE_ENV || 'development'
  });
});

export default router;