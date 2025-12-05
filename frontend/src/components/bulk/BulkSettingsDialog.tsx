import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import { BulkVisibilityForm } from './BulkVisibilityForm';
import { BulkProtectedBranchesForm } from './BulkProtectedBranchesForm';
import { BulkPushRulesForm } from './BulkPushRulesForm';
import { BulkAccessLevelsForm } from './BulkAccessLevelsForm';
import { gitlabService } from '../../services/gitlab';
import { useNotification } from '../../hooks/useNotification';
import type { GitLabPushRule, GitLabProtectedBranch } from '../../types/gitlab';

interface BulkSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  settingType?: 'visibility' | 'permissions' | 'protected' | 'push-rules' | null;
  onSuccess?: (result?: any) => void;
}

interface BulkOperationResults {
  successful: Array<{ id: number; name: string }>;
  failed: Array<{ id: number; name: string; error: string }>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
};

export const BulkSettingsDialog: React.FC<BulkSettingsDialogProps> = ({
  open,
  onClose,
  selectedItems,
  settingType,
  onSuccess,
}) => {
  const getInitialTab = () => {
    switch (settingType) {
      case 'visibility': return 0;
      case 'permissions': return 3;
      case 'protected': return 1;
      case 'push-rules': return 2;
      default: return 0;
    }
  };
  
  const [tab, setTab] = useState(getInitialTab());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkOperationResults | null>(null);
  const { showSuccess, showError } = useNotification();
  
  useEffect(() => {
    setTab(getInitialTab());
  }, [settingType]);

  const projects = selectedItems.filter(item => item.type === 'project');
  const groups = selectedItems.filter(item => item.type === 'group');

  const handleVisibilitySubmit = async (visibility: string) => {
    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await gitlabService.bulkSetVisibility(items, visibility);
      if (response.results) {
        // Backend returns success/failed, convert to successful/failed for UI
        const normalizedResults = {
          successful: response.results.success || response.results.successful || [],
          failed: response.results.failed || [],
        };
        setResults(normalizedResults);

        if (normalizedResults.successful?.length > 0) {
          showSuccess(`Successfully updated visibility for ${normalizedResults.successful.length} items`);
        }
        if (normalizedResults.failed?.length > 0) {
          showError(`Failed to update ${normalizedResults.failed.length} items`);
        }

        if (onSuccess && normalizedResults.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || 'Failed to update visibility');
    } finally {
      setLoading(false);
    }
  };

  const handleProtectedBranchesSubmit = async (branches: { deleteExisting: boolean; rules: Array<{ name: string; push_access_level: number; merge_access_level: number }> }) => {
    setLoading(true);
    try {
      const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

      const response = await gitlabService.bulkSetProtectedBranches(projectIds, branches.rules as unknown as GitLabProtectedBranch[]);
      if (response.results) {
        const normalizedResults = {
          successful: response.results.success || response.results.successful || [],
          failed: response.results.failed || [],
        };
        setResults(normalizedResults);

        if (normalizedResults.successful?.length > 0) {
          showSuccess(`Successfully updated protected branches for ${normalizedResults.successful.length} projects`);
        }
        if (normalizedResults.failed?.length > 0) {
          showError(`Failed to update ${normalizedResults.failed.length} projects`);
        }

        if (onSuccess && normalizedResults.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || 'Failed to update protected branches');
    } finally {
      setLoading(false);
    }
  };

  const handlePushRulesSubmit = async (rules: Partial<GitLabPushRule>) => {
    setLoading(true);
    try {
      const projectIds = projects.map(p => parseInt(p.id.replace('project-', '')));

      const response = await gitlabService.bulkSetPushRules(projectIds, rules);
      if (response.results) {
        const normalizedResults = {
          successful: response.results.success || response.results.successful || [],
          failed: response.results.failed || [],
        };
        setResults(normalizedResults);

        if (normalizedResults.successful?.length > 0) {
          showSuccess(`Successfully updated push rules for ${normalizedResults.successful.length} projects`);
        }
        if (normalizedResults.failed?.length > 0) {
          showError(`Failed to update ${normalizedResults.failed.length} projects`);
        }

        if (onSuccess && normalizedResults.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || 'Failed to update push rules');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessLevelsSubmit = async (settings: { groups?: Record<string, string>; projects?: Record<string, string> }) => {
    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await gitlabService.bulkSetAccessLevels(items, settings);
      if (response.results) {
        const normalizedResults = {
          successful: response.results.success || response.results.successful || [],
          failed: response.results.failed || [],
        };
        setResults(normalizedResults);

        if (normalizedResults.successful?.length > 0) {
          showSuccess(`Successfully updated access levels for ${normalizedResults.successful.length} items`);
        }
        if (normalizedResults.failed?.length > 0) {
          showError(`Failed to update ${normalizedResults.failed.length} items`);
        }

        if (onSuccess && normalizedResults.successful?.length > 0) {
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        }
      }
    } catch (error) {
      showError((error as Error).message || 'Failed to update access levels');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResults(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        Bulk Settings Update
        <Typography variant="body2" color="text.secondary">
          Update settings for {selectedItems.length} selected items
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {/* Selected Items Summary */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Selected Items:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {groups.length > 0 && (
              <Chip
                icon={<FolderIcon />}
                label={`${groups.length} Groups`}
                color="warning"
                size="small"
              />
            )}
            {projects.length > 0 && (
              <Chip
                icon={<CodeIcon />}
                label={`${projects.length} Projects`}
                color="primary"
                size="small"
              />
            )}
          </Box>
        </Box>

        {/* Loading Progress */}
        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Results Display */}
        {results && (
          <Alert
            severity={(results.failed?.length || 0) === 0 ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2">
              Operation Complete
            </Typography>
            <Typography variant="body2">
              Success: {results.successful?.length || 0} | Failed: {results.failed?.length || 0}
            </Typography>
            {(results.failed?.length || 0) > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="error">
                  Failed items:
                </Typography>
                <List dense>
                  {results.failed.slice(0, 5).map((item: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={typeof item.name === 'string' ? item.name : JSON.stringify(item.name)}
                        secondary={typeof item.error === 'string' ? item.error : JSON.stringify(item.error)}
                      />
                    </ListItem>
                  ))}
                  {results.failed.length > 5 && (
                    <Typography variant="caption" color="text.secondary">
                      ... and {results.failed.length - 5} more
                    </Typography>
                  )}
                </List>
              </Box>
            )}
          </Alert>
        )}

        {/* Settings Tabs */}
        {!results && (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Visibility" />
              <Tab label="Protected Branches" disabled={projects.length === 0} />
              <Tab label="Push Rules" disabled={projects.length === 0} />
              <Tab label="Access Levels" />
            </Tabs>

            <TabPanel value={tab} index={0}>
              <BulkVisibilityForm 
                onSubmit={handleVisibilitySubmit}
                disabled={loading}
                itemCount={selectedItems.length}
              />
            </TabPanel>

            <TabPanel value={tab} index={1}>
              {projects.length === 0 ? (
                <Alert severity="info">
                  Protected branches can only be configured for projects.
                  Please select at least one project.
                </Alert>
              ) : (
                <BulkProtectedBranchesForm
                  onSubmit={handleProtectedBranchesSubmit}
                  disabled={loading}
                  projectCount={projects.length}
                />
              )}
            </TabPanel>

            <TabPanel value={tab} index={2}>
              {projects.length === 0 ? (
                <Alert severity="info">
                  Push rules can only be configured for projects.
                  Please select at least one project.
                </Alert>
              ) : (
                <BulkPushRulesForm
                  onSubmit={handlePushRulesSubmit}
                  disabled={loading}
                  projectCount={projects.length}
                />
              )}
            </TabPanel>

            <TabPanel value={tab} index={3}>
              <BulkAccessLevelsForm
                onSubmit={handleAccessLevelsSubmit}
                disabled={loading}
                hasGroups={groups.length > 0}
                hasProjects={projects.length > 0}
              />
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {results ? 'Close' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};