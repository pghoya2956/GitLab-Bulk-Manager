import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { setCredentials, loginSuccess } from '../store/slices/authSlice';

export const Login: React.FC = () => {
  const [gitlabUrl, setGitlabUrl] = useState('https://gitlab.com');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (token) {
      try {
        // Authenticate through backend proxy
        const response = await axios.post('/api/auth/login', {
          gitlabUrl,
          token
        }, {
          withCredentials: true
        });

        if (response.data.success) {
          const user = response.data.user;

          dispatch(setCredentials({ gitlabUrl, token: 'session' })); // Token is now managed by backend
          dispatch(loginSuccess({ user, token: 'session' }));
          navigate('/dashboard');
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          setError('Invalid token. Please check your GitLab Personal Access Token.');
        } else {
          setError('Failed to connect to server. Please ensure the backend is running.');
        }
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
        <Typography variant="h4" gutterBottom align="center">
          GitLab Bulk Manager
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box component="form" sx={{ mt: 2 }} onSubmit={handleLogin}>
          <TextField
            fullWidth
            label="GitLab URL"
            value={gitlabUrl}
            onChange={(e) => setGitlabUrl(e.target.value)}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Personal Access Token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            margin="normal"
            helperText="Token must have 'api' scope"
          />
          <Button
            fullWidth
            variant="contained"
            type="submit"
            sx={{ mt: 3 }}
            disabled={!token}
          >
            Login
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};