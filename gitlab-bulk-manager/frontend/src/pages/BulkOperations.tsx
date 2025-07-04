import React, { useState } from 'react';
import { Box, Typography, Paper, Tabs, Tab, Grid, Card, CardContent, Button } from '@mui/material';
import { ImportGroups } from '../components/bulk/ImportGroups';
import { ImportProjects } from '../components/bulk/ImportProjects';
import { ImportMembers } from '../components/bulk/ImportMembers';
import { GitLabTree } from '../components/GitLabTree';
import FolderIcon from '@mui/icons-material/Folder';
import UploadFileIcon from '@mui/icons-material/UploadFile';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'group' | 'project';
  path: string;
  full_path: string;
  visibility?: string;
  description?: string;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`bulk-tabpanel-${index}`}
      aria-labelledby={`bulk-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

export const BulkOperations: React.FC = () => {
  const [tab, setTab] = React.useState(0);
  const [selectedGroup, setSelectedGroup] = useState<TreeNode | null>(null);

  const handleNodeSelect = (node: TreeNode) => {
    // Only allow selecting groups
    if (node.type === 'group') {
      setSelectedGroup(node);
    }
  };

  const getSelectedGroupData = () => {
    if (!selectedGroup) return undefined;
    
    return {
      id: parseInt(selectedGroup.id.replace('group-', '')),
      name: selectedGroup.name,
      full_path: selectedGroup.full_path,
    };
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bulk Operations
      </Typography>
      
      <Grid container spacing={3}>
        {/* Left Panel - Group Selection */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '600px', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              1. Select Target Group
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose where to perform bulk operations
            </Typography>
            
            {selectedGroup ? (
              <Card sx={{ mb: 2, bgcolor: 'primary.50' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FolderIcon sx={{ mr: 1 }} />
                    <Box>
                      <Typography variant="subtitle1">
                        {selectedGroup.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedGroup.full_path}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Card sx={{ mb: 2, bgcolor: 'grey.100' }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    No group selected
                  </Typography>
                </CardContent>
              </Card>
            )}
            
            <Box sx={{ flexGrow: 1, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <GitLabTree
                onSelect={handleNodeSelect}
                selectedNodeId={selectedGroup?.id}
              />
            </Box>
          </Paper>
        </Grid>

        {/* Right Panel - Operations */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, minHeight: '600px' }}>
            <Typography variant="h6" gutterBottom>
              2. Choose Operation
            </Typography>
            
            {!selectedGroup ? (
              <Box 
                sx={{ 
                  height: 400, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: 'text.secondary',
                }}
              >
                <UploadFileIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Select a group first
                </Typography>
                <Typography variant="body2">
                  Choose a target group from the left panel to enable bulk operations
                </Typography>
              </Box>
            ) : (
              <>
                <Tabs value={tab} onChange={(e, v) => setTab(v)}>
                  <Tab label="Import Groups" />
                  <Tab label="Import Projects" />
                  <Tab label="Import Members" />
                </Tabs>
                
                <TabPanel value={tab} index={0}>
                  <ImportGroups selectedGroup={getSelectedGroupData()} />
                </TabPanel>
                
                <TabPanel value={tab} index={1}>
                  <ImportProjects selectedGroup={getSelectedGroupData()} />
                </TabPanel>
                
                <TabPanel value={tab} index={2}>
                  <ImportMembers selectedGroup={getSelectedGroupData()} />
                </TabPanel>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};