import React, { useState } from 'react';
import type { GitLabPushRule } from '../../types/gitlab';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
} from '@mui/material';

interface BulkPushRulesFormProps {
  onSubmit: (rules: Partial<GitLabPushRule>) => void;
  disabled?: boolean;
  projectCount: number;
}

export const BulkPushRulesForm: React.FC<BulkPushRulesFormProps> = ({
  onSubmit,
  disabled,
  projectCount,
}) => {
  const [rules, setRules] = useState<Partial<GitLabPushRule>>({
    deny_delete_tag: false,
    member_check: false,
    prevent_secrets: true,
    commit_message_regex: '',
    commit_message_negative_regex: '',
    branch_name_regex: '',
    author_email_regex: '',
    file_name_regex: '',
    max_file_size: 100,
    commit_committer_check: false,
    reject_unsigned_commits: false,
  });

  const handleChange = (field: keyof GitLabPushRule, value: any) => {
    setRules({ ...rules, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(rules);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Alert severity="warning" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          GitLab Premium Required
        </Typography>
        <Typography variant="body2">
          Push rules are only available in GitLab Premium and above. 
          These settings will be applied to {projectCount} selected projects.
        </Typography>
      </Alert>

      <Typography variant="subtitle1" gutterBottom>
        Security Rules
      </Typography>
      
      <FormGroup sx={{ mb: 3 }}>
        <FormControlLabel
          control={
            <Switch
              checked={rules.prevent_secrets}
              onChange={(e) => handleChange('prevent_secrets', e.target.checked)}
            />
          }
          label="Prevent committing secrets to Git"
        />
        <FormControlLabel
          control={
            <Switch
              checked={rules.reject_unsigned_commits}
              onChange={(e) => handleChange('reject_unsigned_commits', e.target.checked)}
            />
          }
          label="Reject unsigned commits"
        />
        <FormControlLabel
          control={
            <Switch
              checked={rules.commit_committer_check}
              onChange={(e) => handleChange('commit_committer_check', e.target.checked)}
            />
          }
          label="Committer restriction (committer must match GitLab user)"
        />
        <FormControlLabel
          control={
            <Switch
              checked={rules.deny_delete_tag}
              onChange={(e) => handleChange('deny_delete_tag', e.target.checked)}
            />
          }
          label="Deny deleting a tag"
        />
        <FormControlLabel
          control={
            <Switch
              checked={rules.member_check}
              onChange={(e) => handleChange('member_check', e.target.checked)}
            />
          }
          label="Check whether author is a GitLab user"
        />
      </FormGroup>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        Commit Message Rules
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="Required expression in commit messages"
          value={rules.commit_message_regex}
          onChange={(e) => handleChange('commit_message_regex', e.target.value)}
          placeholder="e.g., ^(feat|fix|docs|style|refactor|test|chore):"
          helperText="Commits must match this regex pattern"
          fullWidth
        />
        
        <TextField
          label="Prohibited expression in commit messages"
          value={rules.commit_message_negative_regex}
          onChange={(e) => handleChange('commit_message_negative_regex', e.target.value)}
          placeholder="e.g., WIP|TODO"
          helperText="Commits matching this pattern will be rejected"
          fullWidth
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="subtitle1" gutterBottom>
        File & Branch Rules
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <TextField
          label="Prohibited file names"
          value={rules.file_name_regex}
          onChange={(e) => handleChange('file_name_regex', e.target.value)}
          placeholder="e.g., (jar|exe)$"
          helperText="Files matching this pattern cannot be pushed"
          fullWidth
        />
        
        <TextField
          label="Branch name regex"
          value={rules.branch_name_regex}
          onChange={(e) => handleChange('branch_name_regex', e.target.value)}
          placeholder="e.g., ^(feature|bugfix|hotfix)/"
          helperText="Only branches matching this pattern can be created"
          fullWidth
        />
        
        <TextField
          label="Commit author's email regex"
          value={rules.author_email_regex}
          onChange={(e) => handleChange('author_email_regex', e.target.value)}
          placeholder="e.g., @company\.com$"
          helperText="Only commits from matching emails are allowed"
          fullWidth
        />
        
        <TextField
          label="Maximum file size (MB)"
          type="number"
          value={rules.max_file_size}
          onChange={(e) => handleChange('max_file_size', parseInt(e.target.value) || 0)}
          helperText="Files larger than this will be rejected (0 = no limit)"
          fullWidth
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={disabled}
        >
          Apply Push Rules
        </Button>
      </Box>
    </Box>
  );
};