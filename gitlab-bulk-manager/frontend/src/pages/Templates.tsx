import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

export const Templates: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Templates
      </Typography>
      <Paper sx={{ p: 2 }}>
        <Typography>Project and operation templates will appear here</Typography>
      </Paper>
    </Box>
  );
};