import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Tabs, 
  Tab, 
  Grid, 
  Card, 
  CardContent,
  Alert,
  Chip
} from '@mui/material';
import { ImportGroups } from '../components/bulk/ImportGroups';
import { YamlEditor } from '../components/bulk/YamlEditor';
import { HierarchyBuilder } from '../components/bulk/HierarchyBuilder';
import { GitLabTree } from '../components/GitLabTree';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import NewReleasesIcon from '@mui/icons-material/NewReleases';

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
      id={`import-tabpanel-${index}`}
      aria-labelledby={`import-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

export const BulkImport: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [subTab, setSubTab] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<TreeNode | null>(null);
  const [generatedYaml, setGeneratedYaml] = useState<any>(null);

  const handleNodeSelect = (node: TreeNode) => {
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          대량 가져오기
        </Typography>
        <Typography variant="body1" color="text.secondary">
          YAML 파일이나 시각적 빌더를 사용하여 GitLab 리소스를 대량으로 생성합니다
        </Typography>
      </Box>
      
      <Grid container spacing={3}>
        {/* 왼쪽 패널 - 그룹 선택 */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '600px', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              1. 대상 그룹 선택
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              리소스를 생성할 그룹을 선택하세요
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
              <Alert severity="info" sx={{ mb: 2 }}>
                그룹을 선택하면 가져오기 옵션이 활성화됩니다
              </Alert>
            )}
            
            <Box sx={{ flexGrow: 1, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <GitLabTree
                onSelect={handleNodeSelect}
                selectedNodeId={selectedGroup?.id}
              />
            </Box>
          </Paper>
        </Grid>

        {/* 오른쪽 패널 - 가져오기 옵션 */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, minHeight: '600px' }}>
            <Typography variant="h6" gutterBottom>
              2. 가져오기 방법 선택
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
                <FolderIcon sx={{ fontSize: 64, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  먼저 그룹을 선택하세요
                </Typography>
                <Typography variant="body2">
                  왼쪽 패널에서 대상 그룹을 선택하면 가져오기 옵션이 표시됩니다
                </Typography>
              </Box>
            ) : (
              <>
                <Tabs value={tab} onChange={(e, v) => setTab(v)}>
                  <Tab 
                    label="YAML Editor" 
                    icon={<Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <CodeIcon sx={{ mr: 0.5 }} />
                      <Chip label="권장" size="small" color="primary" />
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
                
                {/* YAML Editor 탭 */}
                <TabPanel value={tab} index={0}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      <NewReleasesIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                      YAML 형식으로 대량 작업을 정의합니다
                    </Typography>
                    <Typography variant="body2">
                      계층적 구조, 기본 설정, 멱등성 처리를 지원합니다
                    </Typography>
                  </Alert>
                  
                  <Tabs value={subTab} onChange={(e, v) => setSubTab(v)}>
                    <Tab label="서브그룹 생성" />
                    <Tab label="프로젝트 생성" />
                  </Tabs>
                  
                  <Box sx={{ mt: 2 }}>
                    {subTab === 0 && (
                      <YamlEditor 
                        type="subgroups" 
                        onExecute={(data) => {
                          console.log('서브그룹 생성:', data);
                        }}
                      />
                    )}
                    {subTab === 1 && (
                      <YamlEditor 
                        type="projects" 
                        onExecute={(data) => {
                          console.log('프로젝트 생성:', data);
                        }}
                      />
                    )}
                  </Box>
                </TabPanel>
                
                {/* Visual Builder 탭 */}
                <TabPanel value={tab} index={1}>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    시각적으로 계층 구조를 만들고 YAML로 변환합니다
                  </Alert>
                  
                  <HierarchyBuilder 
                    parentId={parseInt(selectedGroup.id.replace('group-', ''))}
                    onGenerate={(data) => {
                      setGeneratedYaml(data);
                      setTab(0); // YAML 편집기로 전환
                      setSubTab(0); // 서브그룹 탭으로
                      // TODO: YAML 데이터를 편집기에 전달
                    }}
                  />
                </TabPanel>
                
                {/* CSV Import 탭 (Legacy) */}
                <TabPanel value={tab} index={2}>
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    레거시 기능: YAML Editor 사용을 권장합니다
                  </Alert>
                  
                  <ImportGroups selectedGroup={getSelectedGroupData()} />
                </TabPanel>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};