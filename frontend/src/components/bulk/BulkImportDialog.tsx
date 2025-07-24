import React, { useState } from 'react';
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
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Backdrop,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import { YamlEditor } from './YamlEditor';
import { HierarchyBuilder } from './HierarchyBuilder';
import { ImportGroups } from './ImportGroups';
import { gitlabService } from '../../services/gitlab';
import { useNotification } from '../../hooks/useNotification';
import type { GitLabProtectedBranch } from '../../types/gitlab';

interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  selectedGroup?: {
    id: string;
    name: string;
    full_path: string;
  };
  onSuccess?: (result?: { parentGroupId?: string; createdGroupIds: string[] }) => void;
}

interface YamlData {
  subgroups?: Array<{ name: string; path?: string; description?: string }>;
  projects?: Array<{ name: string; path?: string; description?: string }>;
  defaults?: Record<string, any>;
  options?: Record<string, any>;
  branchProtection?: Record<string, any>;
  ciVariables?: Array<{ key: string; value: string }>;
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

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  open,
  onClose,
  selectedGroup,
  onSuccess,
}) => {
  const [tab, setTab] = useState(0);
  const [subTab, setSubTab] = useState(0);
  const [generatedYaml, setGeneratedYaml] = useState<YamlData | null>(null);
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useNotification();

  const getSelectedGroupData = () => {
    if (!selectedGroup) {return undefined;}
    
    return {
      id: parseInt(selectedGroup.id.replace('group-', '')),
      name: selectedGroup.name,
      full_path: selectedGroup.full_path,
    };
  };

  const handleYamlExecute = async (type: 'subgroups' | 'projects', data: YamlData) => {
    try {
      if (!selectedGroup) {
        showError('Please select a target group first');
        return;
      }

      setLoading(true);
      const groupId = parseInt(selectedGroup.id.replace('group-', ''));
      console.log('Executing bulk import:', { type, groupId, data });

      if (type === 'subgroups') {
        const response = await gitlabService.bulkCreateSubgroups(
          groupId,
          data.subgroups || [],
          data.defaults,
          data.options
        );
        
        console.log('Subgroups response:', response);
        
        if (response.results?.created && response.results.created.length > 0) {
          showSuccess(`Successfully created ${response.results.created.length} subgroups`);
        }
        if (response.results?.skipped && response.results.skipped.length > 0) {
          showSuccess(`Skipped ${response.results.skipped.length} existing subgroups`);
        }
        if (response.results?.failed && response.results.failed.length > 0) {
          showError(`Failed to create ${response.results.failed.length} subgroups`);
        }
      } else {
        const response = await gitlabService.bulkCreateProjects(
          [{
            group_id: groupId,
            projects: data.projects || [],
          }],
          data.defaults,
          data.branchProtection as GitLabProtectedBranch[] | undefined,
          data.ciVariables
        );
        
        console.log('Projects response:', response);
        
        if (response.results?.created && response.results.created.length > 0) {
          showSuccess(`Successfully created ${response.results.created.length} projects`);
        }
        if (response.results?.failed && response.results.failed.length > 0) {
          showError(`Failed to create ${response.results.failed.length} projects`);
        }
      }
      
      // 생성된 그룹을 자동으로 펼치기 위해 부모 그룹 ID를 포함
      if (onSuccess) {
        // 생성된 그룹 ID들 수집
        const createdGroupIds = response.results?.created?.map((item: any) => `group-${item.id}`) || [];
        const parentGroupId = selectedGroup?.id;
        
        // onSuccess에 생성된 정보 전달
        onSuccess({ parentGroupId, createdGroupIds });
      }
    } catch (error) {
      console.error('Bulk import error:', error);
      showError(error instanceof Error ? error.message : 'Failed to execute bulk import');
    } finally {
      setLoading(false);
    }
  };

  const handleHierarchyGenerate = (data: YamlData) => {
    setGeneratedYaml(data);
    setTab(0); // Switch to YAML editor
    setSubTab(0); // Subgroups tab
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{ '& .MuiDialog-paper': { height: '90vh' } }}
    >
      <DialogTitle>
        Bulk Import Resources
        <Typography variant="body2" color="text.secondary">
          Create multiple groups and projects at once
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {/* Selected Group Display */}
        {selectedGroup ? (
          <Card sx={{ mb: 2, bgcolor: 'primary.50' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FolderIcon sx={{ mr: 1 }} />
                  <Box>
                    <Typography variant="subtitle1">
                      Target Group: {selectedGroup.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedGroup.full_path}
                    </Typography>
                  </Box>
                </Box>
                <Chip label="Selected" color="primary" size="small" />
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No group selected. Please select a target group from the tree before importing.
          </Alert>
        )}

        {/* Import Method Tabs */}
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab 
            label="YAML Editor" 
            icon={<Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CodeIcon sx={{ mr: 0.5 }} />
              <Chip label="Recommended" size="small" color="primary" />
            </Box>} 
            iconPosition="start" 
          />
          <Tab label="Visual Builder" icon={<AccountTreeIcon />} iconPosition="start" />
          <Tab 
            label="CSV Import" 
            icon={<Box sx={{ display: 'flex', alignItems: 'center' }}>
              <UploadFileIcon sx={{ mr: 0.5 }} />
              <Chip label="Legacy" size="small" />
            </Box>} 
            iconPosition="start" 
          />
        </Tabs>

        {/* YAML Editor Tab */}
        <TabPanel value={tab} index={0}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              <NewReleasesIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Define bulk operations using YAML format
            </Typography>
            <Typography variant="body2">
              Supports hierarchical structures, default settings, and idempotent operations
            </Typography>
          </Alert>
          
          <Tabs value={subTab} onChange={(_, v) => setSubTab(v)}>
            <Tab label="Create Subgroups" />
            <Tab label="Create Projects" />
          </Tabs>
          
          <Box sx={{ mt: 2, height: 'calc(100% - 200px)' }}>
            {subTab === 0 && (
              <YamlEditor 
                type="subgroups" 
                onExecute={(data) => handleYamlExecute('subgroups', data)}
                initialYaml={generatedYaml ? JSON.stringify(generatedYaml, null, 2) : undefined}
                disabled={!selectedGroup || loading}
              />
            )}
            {subTab === 1 && (
              <YamlEditor 
                type="projects" 
                onExecute={(data) => handleYamlExecute('projects', data)}
                disabled={!selectedGroup || loading}
              />
            )}
          </Box>
        </TabPanel>
        
        {/* Visual Builder Tab */}
        <TabPanel value={tab} index={1}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Visually create hierarchy structures and convert to YAML
          </Alert>
          
          {selectedGroup ? (
            <HierarchyBuilder 
              parentId={parseInt(selectedGroup.id.replace('group-', ''))}
              onGenerate={handleHierarchyGenerate}
            />
          ) : (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: 400,
                flexDirection: 'column',
                color: 'text.secondary',
              }}
            >
              <FolderIcon sx={{ fontSize: 64, mb: 2 }} />
              <Typography variant="h6">
                Select a target group first
              </Typography>
            </Box>
          )}
        </TabPanel>
        
        {/* CSV Import Tab (Legacy) */}
        <TabPanel value={tab} index={2}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Legacy feature: YAML Editor is recommended for better control
          </Alert>
          
          <ImportGroups selectedGroup={getSelectedGroupData()} />
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Close
        </Button>
      </DialogActions>

      {/* Loading Backdrop */}
      <Backdrop
        sx={{
          position: 'absolute',
          zIndex: (theme) => theme.zIndex.drawer + 1,
          color: '#fff',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 'inherit',
        }}
        open={loading}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Creating resources...
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Please wait while we create your groups and projects
          </Typography>
        </Box>
      </Backdrop>
    </Dialog>
  );
};