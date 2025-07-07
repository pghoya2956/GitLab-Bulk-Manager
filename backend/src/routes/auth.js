import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { gitlabUrl, token } = req.body;

    if (!gitlabUrl || !token) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'GitLab URL and token are required',
      });
    }

    // Validate token by fetching user info
    const response = await axios.get(`${gitlabUrl}/api/v4/user`, {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });

    const user = response.data;

    // Store credentials in session
    req.session.gitlabToken = token;
    req.session.gitlabUrl = gitlabUrl;
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      is_admin: user.is_admin,
      created_at: user.created_at,
      avatar_url: user.avatar_url,
      web_url: user.web_url,
    };

    // Save session
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return next(err);
      }

      logger.info(`User ${user.username} logged in successfully`);

      res.json({
        success: true,
        user: req.session.user,
        message: 'Login successful',
      });
    });

  } catch (error) {
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'The provided token is invalid or expired',
      });
    }
    next(error);
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const username = req.session.user?.username;

  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destroy error:', err);
      return res.status(500).json({
        error: 'Logout failed',
        message: 'Could not destroy session',
      });
    }

    logger.info(`User ${username} logged out`);

    res.json({
      success: true,
      message: 'Logout successful',
    });
  });
});

// Check session endpoint
router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({
      authenticated: true,
      user: req.session.user,
    });
  } else {
    res.json({
      authenticated: false,
    });
  }
});

export default router;