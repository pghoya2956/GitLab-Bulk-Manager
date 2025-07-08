import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Chip,
  Autocomplete,
  Paper,
  Skeleton,
  IconButton,
} from '@mui/material';
import { 
  ExpandMore, 
  CheckCircle, 
  FolderOpen,
  Folder,
  ChevronRight,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { gitlabService } from '../../services/gitlab';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface SvnConnectionFormProps {
  onSuccess: (data: any) => void;
  selectedGroup?: any;
  selectedProject?: any;
}

interface LayoutConfig {
  trunk: string;
  branches: string;
  tags: string;
}

interface GroupWithPermission {
  id: number;
  name: string;
  full_path: string;
  description?: string;
  access_level?: number;
  user_access?: {
    access_level: number;
    access_level_name: string;
  };
  subgroups?: any[];
}

interface FlattenedGroup extends GroupWithPermission {
  level: number;
  hasChildren: boolean;
  parentId?: number;
  parentPath?: string;
}

const SvnConnectionForm: React.FC<SvnConnectionFormProps> = ({
  onSuccess,
  selectedGroup,
  selectedProject,
}) => {
  const gitlabUrl = useSelector((state: RootState) => state.auth.gitlabUrl);
  
  const [formData, setFormData] = useState({
    svnUrl: '',
    svnUsername: '',
    svnPassword: '',
    projectName: '',  // 항상 빈 문자열로 시작
    projectPath: '',  // 항상 빈 문자열로 시작
    layoutType: 'standard',
    customLayout: {
      trunk: 'trunk',
      branches: 'branches',
      tags: 'tags',
    } as LayoutConfig,
    options: {
      incremental: true,
      preserveEmptyDirs: false,
      includeBranches: [] as string[],
      excludeBranches: [] as string[],
      keepTempFiles: true, // 임시 디렉토리 유지 (재개 기능을 위해)
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [svnInfo, setSvnInfo] = useState<any>(null);
  
  // Group selection state
  const [selectedTargetGroup, setSelectedTargetGroup] = useState<GroupWithPermission | null>(
    selectedGroup ? {
      id: selectedGroup.id,
      name: selectedGroup.name,
      full_path: selectedGroup.full_path || selectedGroup.path,
      description: selectedGroup.description,
      access_level: selectedGroup.access_level,
      user_access: selectedGroup.user_access
    } : null
  );
  const [groups, setGroups] = useState<GroupWithPermission[]>([]);
  const [flattenedGroups, setFlattenedGroups] = useState<FlattenedGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [recentGroups, setRecentGroups] = useState<GroupWithPermission[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  // Helper functions for recent groups
  const getRecentGroups = (gitlabUrl: string): GroupWithPermission[] => {
    const key = `svn-migration-recent-groups-${gitlabUrl}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  };

  const saveRecentGroup = (gitlabUrl: string, group: GroupWithPermission) => {
    const key = `svn-migration-recent-groups-${gitlabUrl}`;
    const recent = getRecentGroups(gitlabUrl);
    const updated = [group, ...recent.filter(g => g.id !== group.id)].slice(0, 10);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  // Flatten hierarchical groups
  const flattenGroups = (
    groups: any[], 
    level = 0, 
    parentId?: number, 
    parentPath?: string
  ): FlattenedGroup[] => {
    let flattened: FlattenedGroup[] = [];
    
    groups.forEach(group => {
      // Check if user has Developer+ access
      const accessLevel = group.user_access?.access_level || 0;
      if (accessLevel >= 30) { // Developer or higher
        const flatGroup: FlattenedGroup = {
          ...group,
          level,
          hasChildren: group.subgroups && group.subgroups.length > 0,
          parentId,
          parentPath,
        };
        flattened.push(flatGroup);
        
        // Recursively process subgroups
        if (group.subgroups && group.subgroups.length > 0) {
          const childGroups = flattenGroups(
            group.subgroups, 
            level + 1, 
            group.id,
            group.full_path
          );
          flattened = flattened.concat(childGroups);
        }
      }
    });
    
    return flattened;
  };

  // Toggle group expansion
  const toggleGroup = (groupId: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Load groups with permission filtering
  const loadGroups = async () => {
    if (!gitlabUrl) return;
    
    setLoadingGroups(true);
    try {
      // Get permissions overview which includes access levels
      const permissionsData = await gitlabService.getPermissionsOverview();
      
      // permissionsData.groups already has hierarchical structure with subgroups
      const hierarchicalGroups = permissionsData.groups || [];
      
      // Flatten the hierarchical structure
      const flattened = flattenGroups(hierarchicalGroups);
      
      setGroups(hierarchicalGroups);
      setFlattenedGroups(flattened);
      
      // Load recent groups - need to find them in flattened list
      const recentGroupIds = getRecentGroups(gitlabUrl).map(g => g.id);
      const validRecentGroups = flattened.filter((g: FlattenedGroup) => 
        recentGroupIds.includes(g.id)
      );
      setRecentGroups(validRecentGroups);
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError('그룹 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoadingGroups(false);
    }
  };

  // Load groups when success is true
  useEffect(() => {
    if (success && gitlabUrl) {
      loadGroups();
    }
  }, [success, gitlabUrl]);

  // Call handleSubmit when all required fields are filled
  const [isSubmitted, setIsSubmitted] = useState(false);
  useEffect(() => {
    if (success && selectedTargetGroup && formData.projectName && formData.projectPath && !isSubmitted) {
      setIsSubmitted(true);
      handleSubmit();
    }
  }, [success, selectedTargetGroup, formData.projectName, formData.projectPath, isSubmitted]);

  // Set selected group when groups are loaded
  useEffect(() => {
    if (selectedGroup && flattenedGroups.length > 0 && !selectedTargetGroup) {
      const matchingGroup = flattenedGroups.find(g => g.id === selectedGroup.id);
      if (matchingGroup) {
        setSelectedTargetGroup(matchingGroup);
      }
    }
  }, [selectedGroup, flattenedGroups]);

  // Auto-generate project path from name
  const generateProjectPath = (name: string) => {
    // 특수문자를 대시로 변환하고, 시작과 끝의 대시 제거
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      
      // Auto-generate project path when name changes
      if (name === 'projectName') {
        newData.projectPath = generateProjectPath(value);
        console.log('Project name changed:', {
          name: value,
          path: newData.projectPath
        });
      }
      
      return newData;
    });
  };

  const handleLayoutChange = (field: keyof LayoutConfig, value: string) => {
    setFormData((prev) => ({
      ...prev,
      customLayout: {
        ...prev.customLayout,
        [field]: value,
      },
    }));
  };

  const handleOptionChange = (option: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [option]: value,
      },
    }));
  };

  const handleBranchPatternAdd = (type: 'include' | 'exclude', pattern: string) => {
    if (pattern.trim()) {
      const key = type === 'include' ? 'includeBranches' : 'excludeBranches';
      setFormData((prev) => ({
        ...prev,
        options: {
          ...prev.options,
          [key]: [...prev.options[key], pattern.trim()],
        },
      }));
    }
  };

  const handleBranchPatternRemove = (type: 'include' | 'exclude', index: number) => {
    const key = type === 'include' ? 'includeBranches' : 'excludeBranches';
    setFormData((prev) => ({
      ...prev,
      options: {
        ...prev.options,
        [key]: prev.options[key].filter((_, i) => i !== index),
      },
    }));
  };

  const testConnection = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await gitlabService.testSvnConnection({
        svnUrl: formData.svnUrl,
        svnUsername: formData.svnUsername,
        svnPassword: formData.svnPassword,
      });

      setSvnInfo(result);
      setSuccess(true);

      // 프로젝트 이름 자동 설정
      if (!formData.projectName && result.repository_root) {
        const repoName = result.repository_root.split('/').pop() || 'svn-migration';
        setFormData((prev) => ({
          ...prev,
          projectName: repoName,
          projectPath: repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        }));
      }
    } catch (err: any) {
      setError(err.message || 'SVN 연결 테스트 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!success) {
      setError('먼저 SVN 연결을 테스트해주세요.');
      return;
    }

    if (!selectedTargetGroup) {
      setError('GitLab 그룹을 선택해주세요.');
      return;
    }

    const layout = formData.layoutType === 'standard'
      ? { trunk: 'trunk', branches: 'branches', tags: 'tags' }
      : formData.customLayout;

    // Save to recent groups
    if (gitlabUrl && selectedTargetGroup) {
      saveRecentGroup(gitlabUrl, selectedTargetGroup);
    }

    const successData = {
      ...formData,
      layout,
      svnInfo,
      targetGroup: selectedTargetGroup,
      targetGroupId: selectedTargetGroup.id,
    };
    
    console.log('SvnConnectionForm onSuccess called with:', {
      projectName: successData.projectName,
      projectPath: successData.projectPath,
      fullData: successData
    });
    
    onSuccess(successData);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {selectedGroup && (
          <>선택된 그룹: <strong>{selectedGroup.full_path}</strong></>
        )}
        {selectedProject && (
          <>선택된 프로젝트: <strong>{selectedProject.path_with_namespace}</strong></>
        )}
      </Typography>

      <TextField
        fullWidth
        label="SVN Repository URL"
        name="svnUrl"
        value={formData.svnUrl}
        onChange={handleInputChange}
        placeholder="https://svn.example.com/repos/myproject"
        margin="normal"
        required
      />

      <TextField
        fullWidth
        label="SVN 사용자명"
        name="svnUsername"
        value={formData.svnUsername}
        onChange={handleInputChange}
        placeholder="svnuser"
        margin="normal"
        helperText="공개 저장소의 경우 비워둘 수 있습니다"
      />

      <TextField
        fullWidth
        label="SVN 비밀번호"
        name="svnPassword"
        type="password"
        value={formData.svnPassword}
        onChange={handleInputChange}
        placeholder="••••••••"
        margin="normal"
        helperText="공개 저장소의 경우 비워둘 수 있습니다"
      />

      <Box sx={{ mt: 2, mb: 3 }}>
        <Button
          variant="outlined"
          onClick={testConnection}
          disabled={isLoading || !formData.svnUrl}
          startIcon={isLoading ? <CircularProgress size={20} /> : success ? <CheckCircle /> : null}
        >
          {isLoading ? '연결 중...' : success ? '연결 성공' : 'SVN 연결 테스트'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {svnInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Repository Root:</strong> {svnInfo.repository_root}<br />
            <strong>Repository UUID:</strong> {svnInfo.repository_uuid}<br />
            <strong>Revision:</strong> {svnInfo.revision}
          </Typography>
        </Alert>
      )}

      {success && (
        <>
          {/* Group Selection */}
          <Autocomplete
            fullWidth
            options={(() => {
              // Filter visible groups based on expanded state
              const visibleGroups = flattenedGroups.filter(group => {
                // Always show root groups
                if (group.level === 0) return true;
                
                // Check if all parent groups are expanded
                let currentParentId = group.parentId;
                while (currentParentId) {
                  if (!expandedGroups.has(currentParentId)) return false;
                  // Find parent in flattened list to check its parent
                  const parent = flattenedGroups.find(g => g.id === currentParentId);
                  currentParentId = parent?.parentId;
                }
                return true;
              });

              // Build options array with headers
              const options: any[] = [];
              
              if (recentGroups.length > 0) {
                options.push({ id: -1, name: '최근 사용', full_path: '', isHeader: true });
                options.push(...recentGroups);
              }
              
              if (recentGroups.length > 0 && visibleGroups.length > 0) {
                options.push({ id: -2, name: '모든 그룹', full_path: '', isHeader: true });
              }
              
              // Add visible groups that aren't in recent
              const recentIds = recentGroups.map(r => r.id);
              options.push(...visibleGroups.filter(g => !recentIds.includes(g.id)));
              
              return options;
            })()}
            getOptionLabel={(option) => {
              if ((option as any).isHeader) return option.name;
              return option.full_path;
            }}
            renderOption={(props, option) => {
              if ((option as any).isHeader) {
                return (
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ px: 2, py: 1, display: 'block' }}
                    key={option.id}
                  >
                    {option.name}
                  </Typography>
                );
              }
              
              const group = option as FlattenedGroup;
              const isExpanded = expandedGroups.has(group.id);
              
              return (
                <Box 
                  component="li" 
                  {...props}
                  key={group.id}
                >
                  <Box sx={{ 
                    ml: group.level * 3, 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%' 
                  }}>
                    {group.hasChildren ? (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleGroup(group.id);
                        }}
                        sx={{ p: 0.5, mr: 0.5 }}
                      >
                        {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRight fontSize="small" />}
                      </IconButton>
                    ) : (
                      <Box sx={{ width: 28 }} />
                    )}
                    
                    {group.hasChildren && isExpanded ? (
                      <FolderOpen sx={{ mr: 1, color: 'action.active', fontSize: 20 }} />
                    ) : (
                      <Folder sx={{ mr: 1, color: 'action.active', fontSize: 20 }} />
                    )}
                    
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">{group.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {group.full_path} • {group.user_access?.access_level_name}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            }}
            value={selectedTargetGroup}
            onChange={(_, newValue) => {
              if (newValue && !(newValue as any).isHeader) {
                setSelectedTargetGroup(newValue);
              }
            }}
            loading={loadingGroups}
            loadingText="그룹 목록을 불러오는 중..."
            noOptionsText="프로젝트를 생성할 수 있는 그룹이 없습니다."
            isOptionEqualToValue={(option, value) => option.id === value.id}
            filterOptions={(options, params) => {
              const { inputValue } = params;
              
              if (!inputValue) return options;
              
              // Filter by name or full path
              return options.filter(option => {
                if ((option as any).isHeader) return true;
                const group = option as FlattenedGroup;
                return (
                  group.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                  group.full_path.toLowerCase().includes(inputValue.toLowerCase())
                );
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="대상 GitLab 그룹"
                margin="normal"
                required
                helperText="프로젝트가 생성될 GitLab 그룹을 선택하세요. (Developer 이상 권한 필요)"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingGroups ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            fullWidth
            label="GitLab 프로젝트 이름"
            name="projectName"
            value={formData.projectName}
            onChange={handleInputChange}
            placeholder="My Project"
            margin="normal"
            required
          />

          <TextField
            fullWidth
            label="GitLab 프로젝트 경로"
            name="projectPath"
            value={formData.projectPath}
            onChange={handleInputChange}
            placeholder="my-project"
            margin="normal"
            required
            helperText="영문 소문자, 숫자, 하이픈만 사용 가능"
          />

          {/* URL Preview */}
          {selectedTargetGroup && formData.projectPath && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'action.hover',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                프로젝트가 생성될 위치:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  mt: 0.5,
                }}
              >
                {gitlabUrl}/{selectedTargetGroup.full_path}/{formData.projectPath}
              </Typography>
            </Paper>
          )}

          <FormControl fullWidth margin="normal">
            <InputLabel>레이아웃 타입</InputLabel>
            <Select
              value={formData.layoutType}
              onChange={(e) => setFormData({ ...formData, layoutType: e.target.value })}
              label="레이아웃 타입"
            >
              <MenuItem value="standard">표준 (trunk/branches/tags)</MenuItem>
              <MenuItem value="custom">커스텀</MenuItem>
            </Select>
          </FormControl>

          {formData.layoutType === 'custom' && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Trunk 경로"
                value={formData.customLayout.trunk}
                onChange={(e) => handleLayoutChange('trunk', e.target.value)}
                placeholder="trunk"
                margin="dense"
              />
              <TextField
                fullWidth
                label="Branches 경로"
                value={formData.customLayout.branches}
                onChange={(e) => handleLayoutChange('branches', e.target.value)}
                placeholder="branches"
                margin="dense"
              />
              <TextField
                fullWidth
                label="Tags 경로"
                value={formData.customLayout.tags}
                onChange={(e) => handleLayoutChange('tags', e.target.value)}
                placeholder="tags"
                margin="dense"
              />
            </Box>
          )}

          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>고급 옵션</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.options.incremental}
                    onChange={(e) => handleOptionChange('incremental', e.target.checked)}
                  />
                }
                label="증분 마이그레이션 지원"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.options.preserveEmptyDirs}
                    onChange={(e) => handleOptionChange('preserveEmptyDirs', e.target.checked)}
                  />
                }
                label="빈 디렉토리 보존"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.options.keepTempFiles}
                    onChange={(e) => handleOptionChange('keepTempFiles', e.target.checked)}
                  />
                }
                label="임시 파일 유지 (재개 기능 사용 시 필수)"
              />

              <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
                포함할 브랜치 패턴:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {formData.options.includeBranches.map((pattern, index) => (
                  <Chip
                    key={index}
                    label={pattern}
                    onDelete={() => handleBranchPatternRemove('include', index)}
                    size="small"
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="release/*"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBranchPatternAdd('include', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </Box>

              <Typography variant="body2" sx={{ mb: 1 }}>
                제외할 브랜치 패턴:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {formData.options.excludeBranches.map((pattern, index) => (
                  <Chip
                    key={index}
                    label={pattern}
                    onDelete={() => handleBranchPatternRemove('exclude', index)}
                    size="small"
                  />
                ))}
                <TextField
                  size="small"
                  placeholder="experimental/*"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleBranchPatternAdd('exclude', (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {/* Submit button is handled by the parent dialog */}
        </>
      )}
    </Box>
  );
};

export default SvnConnectionForm;