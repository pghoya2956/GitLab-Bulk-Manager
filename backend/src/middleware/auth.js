import logger from '../utils/logger.js';

export const authenticateToken = (req, res, next) => {
  // Check if user has a valid session
  if (!req.session || !req.session.gitlabToken || !req.session.gitlabUrl) {
    logger.warn('Unauthorized request - no valid session');
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Please login first' 
    });
  }

  // Add GitLab credentials to request object
  req.gitlabToken = req.session.gitlabToken;
  req.gitlabUrl = req.session.gitlabUrl;
  req.userId = req.session.userId;

  next();
};

export const optionalAuth = (req, res, next) => {
  // Similar to authenticateToken but doesn't block if no session
  if (req.session && req.session.gitlabToken) {
    req.gitlabToken = req.session.gitlabToken;
    req.gitlabUrl = req.session.gitlabUrl;
    req.userId = req.session.userId;
  }
  next();
};