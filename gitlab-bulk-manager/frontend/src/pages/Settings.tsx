import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography>Application settings and configuration will appear here</Typography>
      </Paper>
    </Box>
  );
};