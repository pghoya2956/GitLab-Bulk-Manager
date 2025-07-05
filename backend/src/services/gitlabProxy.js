import axios from 'axios';
import logger from '../utils/logger.js';

export const gitlabProxy = async (req, res, next) => {
  try {
    const gitlabUrl = req.gitlabUrl;
    const gitlabToken = req.gitlabToken;
    
    // Build the full URL
    const path = req.path.replace(/^\//, ''); // Remove leading slash
    const url = `${gitlabUrl}/api/v4/${path}`;
    
    // Prepare request config
    const config = {
      method: req.method,
      url: url,
      headers: {
        'PRIVATE-TOKEN': gitlabToken,
        'Content-Type': 'application/json',
        ...req.headers
      },
      params: req.query
    };

    // Add body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      config.data = req.body;
    }

    // Remove host-specific headers
    delete config.headers.host;
    delete config.headers.connection;
    delete config.headers.cookie;
    delete config.headers.authorization;

    logger.debug(`Proxying ${req.method} request to ${url}`);

    // Make the request to GitLab
    const response = await axios(config);

    // Forward response headers
    if (response.headers['x-total']) {
      res.set('X-Total-Count', response.headers['x-total']);
    }
    if (response.headers['x-page']) {
      res.set('X-Page', response.headers['x-page']);
    }
    if (response.headers['x-per-page']) {
      res.set('X-Per-Page', response.headers['x-per-page']);
    }
    if (response.headers['x-next-page']) {
      res.set('X-Next-Page', response.headers['x-next-page']);
    }
    if (response.headers['x-prev-page']) {
      res.set('X-Prev-Page', response.headers['x-prev-page']);
    }

    // Send response
    res.status(response.status).json(response.data);

  } catch (error) {
    if (error.response) {
      // GitLab API returned an error
      logger.error(`GitLab API error: ${error.response.status} - ${error.response.statusText}`);
      return res.status(error.response.status).json({
        error: 'GitLab API Error',
        message: error.response.data?.message || error.message,
        details: error.response.data
      });
    }
    
    // Network or other error
    logger.error('Proxy error:', error.message);
    next(error);
  }
};