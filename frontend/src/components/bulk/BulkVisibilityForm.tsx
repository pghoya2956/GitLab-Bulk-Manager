import React, { useState } from 'react';
import {
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import BusinessIcon from '@mui/icons-material/Business';
import LockIcon from '@mui/icons-material/Lock';

interface BulkVisibilityFormProps {
  onSubmit: (visibility: string) => void;
  disabled?: boolean;
  itemCount: number;
}

export const BulkVisibilityForm: React.FC<BulkVisibilityFormProps> = ({
  onSubmit,
  disabled,
  itemCount,
}) => {
  const [visibility, setVisibility] = useState<string>('private');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(visibility);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Alert severity="info" sx={{ mb: 3 }}>
        This will update the visibility level for all {itemCount} selected items.
        Note that child projects and subgroups inherit visibility from their parent.
      </Alert>

      <FormControl component="fieldset">
        <FormLabel component="legend">Select Visibility Level</FormLabel>
        <RadioGroup
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <FormControlLabel
            value="private"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LockIcon color="action" />
                <Box>
                  <Typography variant="body1">Private</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Project access must be granted explicitly to each user
                  </Typography>
                </Box>
              </Box>
            }
          />
          
          <FormControlLabel
            value="internal"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon color="action" />
                <Box>
                  <Typography variant="body1">Internal</Typography>
                  <Typography variant="caption" color="text.secondary">
                    The project can be accessed by any logged in user
                  </Typography>
                </Box>
              </Box>
            }
          />
          
          <FormControlLabel
            value="public"
            control={<Radio />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PublicIcon color="action" />
                <Box>
                  <Typography variant="body1">Public</Typography>
                  <Typography variant="caption" color="text.secondary">
                    The project can be accessed without any authentication
                  </Typography>
                </Box>
              </Box>
            }
          />
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={disabled}
        >
          Update Visibility
        </Button>
      </Box>
    </Box>
  );
};