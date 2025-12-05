// Centralized error handling middleware

const errorHandler = (err, req, res, next) => {
  // Default error status and message
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let error = 'Error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    status = 400;
    error = 'Validation Error';
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    error = 'Invalid ID';
    message = 'Invalid resource identifier';
  } else if (err.code === 11000) {
    status = 409;
    error = 'Duplicate Error';
    message = 'Resource already exists';
  } else if (err.response) {
    // Axios error from GitLab API
    status = err.response.status;
    message = err.response.data?.message || err.response.data?.error || message;
    error = err.response.data?.error || error;
  }

  // Log error for debugging (in production, use proper logging service)
  if (process.env.NODE_ENV !== 'test') {
    console.error(`Error ${status}: ${message}`, {
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }

  // Send error response
  res.status(status).json({
    error,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export { errorHandler, asyncHandler, notFoundHandler };