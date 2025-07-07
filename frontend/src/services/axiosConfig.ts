import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

// Request interceptor
axios.interceptors.request.use(
  (config) => {
    // Add request timestamp for tracking
    config.metadata = { startTime: new Date() };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axios.interceptors.response.use(
  (response) => {
    // Calculate response time (could be used for monitoring)
    const startTime = response.config.metadata?.startTime;
    if (startTime && process.env.NODE_ENV === 'development') {
      // Duration: new Date().getTime() - startTime.getTime()
      // Could log to a monitoring service in production
    }
    return response;
  },
  (error) => {
    // Handle 401 errors globally
    if (error.response?.status === 401) {
      // Token is invalid, logout user
      store.dispatch(logout());
      window.location.href = '/login';
    }
    
    // In development, errors will be shown in DevTools network tab
    // In production, could send to error monitoring service
    
    return Promise.reject(error);
  }
);

export default axios;