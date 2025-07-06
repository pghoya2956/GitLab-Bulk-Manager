import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

interface BulkProtectedBranchesFormProps {
  onSubmit: (branches: any) => void;
  disabled?: boolean;
  projectCount: number;
}

interface BranchRule {
  name: string;
  push_access_level: number;
  merge_access_level: number;
  unprotect_access_level: number;
  allow_force_push: boolean;
  code_owner_approval_required: boolean;
}

const ACCESS_LEVELS = [
  { value: 0, label: 'No one' },
  { value: 30, label: 'Developer + Maintainer' },
  { value: 40, label: 'Maintainer' },
  { value: 60, label: 'Admin' },
];

export const BulkProtectedBranchesForm: React.FC<BulkProtectedBranchesFormProps> = ({
  onSubmit,
  disabled,
  projectCount,
}) => {
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [rules, setRules] = useState<BranchRule[]>([
    {
      name: 'main',
      push_access_level: 40,
      merge_access_level: 30,
      unprotect_access_level: 40,
      allow_force_push: false,
      code_owner_approval_required: false,
    },
  ]);

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        name: '',
        push_access_level: 40,
        merge_access_level: 30,
        unprotect_access_level: 40,
        allow_force_push: false,
        code_owner_approval_required: false,
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleRuleChange = (index: number, field: keyof BranchRule, value: any) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [field]: value };
    setRules(newRules);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      deleteExisting,
      rules: rules.filter(rule => rule.name.trim() !== ''),
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Alert severity="info" sx={{ mb: 3 }}>
        Configure protected branch rules for {projectCount} selected projects.
        These rules will be applied to all selected projects.
      </Alert>

      <FormControlLabel
        control={
          <Switch
            checked={deleteExisting}
            onChange={(e) => setDeleteExisting(e.target.checked)}
          />
        }
        label="Delete existing protected branches before applying new rules"
        sx={{ mb: 2 }}
      />

      <Typography variant="subtitle1" gutterBottom>
        Branch Protection Rules
      </Typography>

      <List>
        {rules.map((rule, index) => (
          <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'stretch', mb: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <TextField
                label="Branch Name/Pattern"
                value={rule.name}
                onChange={(e) => handleRuleChange(index, 'name', e.target.value)}
                placeholder="e.g., main, develop, release/*"
                fullWidth
                required
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handleRemoveRule(index)}
                  disabled={rules.length === 1}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mb: 2 }}>
              <FormControl size="small">
                <InputLabel>Push Access</InputLabel>
                <Select
                  value={rule.push_access_level}
                  onChange={(e) => handleRuleChange(index, 'push_access_level', e.target.value)}
                  label="Push Access"
                >
                  {ACCESS_LEVELS.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel>Merge Access</InputLabel>
                <Select
                  value={rule.merge_access_level}
                  onChange={(e) => handleRuleChange(index, 'merge_access_level', e.target.value)}
                  label="Merge Access"
                >
                  {ACCESS_LEVELS.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small">
                <InputLabel>Unprotect Access</InputLabel>
                <Select
                  value={rule.unprotect_access_level}
                  onChange={(e) => handleRuleChange(index, 'unprotect_access_level', e.target.value)}
                  label="Unprotect Access"
                >
                  {ACCESS_LEVELS.filter(l => l.value >= 40).map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={rule.allow_force_push}
                    onChange={(e) => handleRuleChange(index, 'allow_force_push', e.target.checked)}
                  />
                }
                label="Allow force push"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={rule.code_owner_approval_required}
                    onChange={(e) => handleRuleChange(index, 'code_owner_approval_required', e.target.checked)}
                  />
                }
                label="Require code owner approval"
              />
            </Box>

            {index < rules.length - 1 && <Divider sx={{ mt: 2 }} />}
          </ListItem>
        ))}
      </List>

      <Button
        startIcon={<AddIcon />}
        onClick={handleAddRule}
        sx={{ mb: 3 }}
      >
        Add Another Rule
      </Button>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={disabled || rules.every(r => !r.name.trim())}
        >
          Apply Protected Branch Rules
        </Button>
      </Box>
    </Box>
  );
};