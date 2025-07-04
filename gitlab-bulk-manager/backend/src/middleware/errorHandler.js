import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  // Handle specific error types
  if (err.response) {
    // GitLab API error
    return res.status(err.response.status || 500).json({
      error: 'GitLab API Error',
      message: err.response.data?.message || err.message,
      details: err.response.data
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred processing your request'
      : err.message
  });
};