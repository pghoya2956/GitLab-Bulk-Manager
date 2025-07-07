import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';

interface AccessLevelSettings {
  groups?: {
    project_creation_level?: string;
    subgroup_creation_level?: string;
  };
  projects?: {
    merge_requests_access_level?: string;
    issues_access_level?: string;
    forking_access_level?: string;
  };
}

interface BulkAccessLevelsFormProps {
  onSubmit: (settings: AccessLevelSettings) => void;
  disabled?: boolean;
  hasGroups: boolean;
  hasProjects: boolean;
}

const PROJECT_CREATION_LEVELS = [
  { value: 'noone', label: 'No one' },
  { value: 'maintainer', label: 'Maintainers' },
  { value: 'developer', label: 'Developers + Maintainers' },
];

const SUBGROUP_CREATION_LEVELS = [
  { value: 'owner', label: 'Owners' },
  { value: 'maintainer', label: 'Maintainers' },
];

const FEATURE_ACCESS_LEVELS = [
  { value: 'disabled', label: 'Disabled' },
  { value: 'private', label: 'Only project members' },
  { value: 'enabled', label: 'Everyone with access' },
];

export const BulkAccessLevelsForm: React.FC<BulkAccessLevelsFormProps> = ({
  onSubmit,
  disabled,
  hasGroups,
  hasProjects,
}) => {
  const [groupSettings, setGroupSettings] = useState({
    project_creation_level: 'developer',
    subgroup_creation_level: 'maintainer',
    request_access_enabled: true,
  });

  const [projectSettings, setProjectSettings] = useState({
    issues_access_level: 'enabled',
    merge_requests_access_level: 'enabled',
    wiki_access_level: 'enabled',
    snippets_access_level: 'enabled',
  });

  const handleGroupChange = (field: string, value: string | boolean) => {
    setGroupSettings({ ...groupSettings, [field]: value });
  };

  const handleProjectChange = (field: string, value: string | boolean) => {
    setProjectSettings({ ...projectSettings, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settings: AccessLevelSettings = {};
    
    if (hasGroups && Object.keys(groupSettings).length > 0) {
      settings.groups = groupSettings;
    }
    
    if (hasProjects && Object.keys(projectSettings).length > 0) {
      settings.projects = projectSettings;
    }
    
    onSubmit(settings);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Alert severity="info" sx={{ mb: 3 }}>
        Configure access levels and permissions for selected items.
        Only applicable settings will be applied based on item types.
      </Alert>

      {hasGroups && (
        <>
          <Typography variant="h6" gutterBottom>
            Group Settings
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Project Creation Level</InputLabel>
              <Select
                value={groupSettings.project_creation_level}
                onChange={(e) => handleGroupChange('project_creation_level', e.target.value)}
                label="Project Creation Level"
              >
                {PROJECT_CREATION_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Subgroup Creation Level</InputLabel>
              <Select
                value={groupSettings.subgroup_creation_level}
                onChange={(e) => handleGroupChange('subgroup_creation_level', e.target.value)}
                label="Subgroup Creation Level"
              >
                {SUBGROUP_CREATION_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={groupSettings.request_access_enabled}
                  onChange={(e) => handleGroupChange('request_access_enabled', e.target.checked)}
                />
              }
              label="Allow users to request access"
            />
          </Box>

          {hasProjects && <Divider sx={{ my: 3 }} />}
        </>
      )}

      {hasProjects && (
        <>
          <Typography variant="h6" gutterBottom>
            Project Feature Settings
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Issues</InputLabel>
              <Select
                value={projectSettings.issues_access_level}
                onChange={(e) => handleProjectChange('issues_access_level', e.target.value)}
                label="Issues"
              >
                {FEATURE_ACCESS_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Merge Requests</InputLabel>
              <Select
                value={projectSettings.merge_requests_access_level}
                onChange={(e) => handleProjectChange('merge_requests_access_level', e.target.value)}
                label="Merge Requests"
              >
                {FEATURE_ACCESS_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Wiki</InputLabel>
              <Select
                value={projectSettings.wiki_access_level}
                onChange={(e) => handleProjectChange('wiki_access_level', e.target.value)}
                label="Wiki"
              >
                {FEATURE_ACCESS_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Snippets</InputLabel>
              <Select
                value={projectSettings.snippets_access_level}
                onChange={(e) => handleProjectChange('snippets_access_level', e.target.value)}
                label="Snippets"
              >
                {FEATURE_ACCESS_LEVELS.map(level => (
                  <MenuItem key={level.value} value={level.value}>
                    {level.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="submit"
          variant="contained"
          disabled={disabled}
        >
          Apply Access Level Settings
        </Button>
      </Box>
    </Box>
  );
};