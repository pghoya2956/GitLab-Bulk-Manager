import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Tooltip,
  Stack,
  Paper,
  TextField,
  InputAdornment,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  ExpandMore,
  ChevronRight,
  Folder,
  FolderOpen,
  Code,
  Group,
  Search,
  Security,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';
import axios from 'axios';

interface UserAccess {
  access_level: number;
  access_level_name: string;
}

interface Project {
  id: number;
  name: string;
  path: string;
  description?: string;
  member_count: number;
  visibility: string;
  user_access: UserAccess;
}

interface Group {
  id: number;
  name: string;
  full_path: string;
  description?: string;
  parent_id?: number;
  visibility: string;
  member_count: number;
  user_access: UserAccess;
  projects: Project[];
  subgroups: Group[];
  error?: string;
}

interface PermissionData {
  user: {
    id: number;
    username: string;
    name: string;
  };
  groups: Group[];
  timestamp: string;
}

const getAccessLevelColor = (level: string): string => {
  switch (level) {
    case 'owner':
      return '#ff6b6b';
    case 'maintainer':
      return '#4dabf7';
    case 'developer':
      return '#51cf66';
    case 'reporter':
      return '#868e96';
    case 'guest':
      return '#adb5bd';
    default:
      return '#dee2e6';
  }
};

const getVisibilityIcon = (visibility: string) => {
  switch (visibility) {
    case 'public':
      return <Visibility fontSize="small" />;
    case 'internal':
      return <Security fontSize="small" />;
    case 'private':
      return <VisibilityOff fontSize="small" />;
    default:
      return null;
  }
};

const isHighLevelAccess = (level: string): boolean => {
  return ['owner', 'maintainer', 'developer'].includes(level.toLowerCase());
};

const GroupNode: React.FC<{ group: Group; searchTerm: string; showAllLevels: boolean }> = ({ group, searchTerm, showAllLevels }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Filter based on access level
  const shouldShowGroup = showAllLevels || isHighLevelAccess(group.user_access.access_level_name);
  
  // Filter projects and subgroups based on access level
  const filteredProjects = group.projects.filter(p => 
    showAllLevels || isHighLevelAccess(p.user_access.access_level_name)
  );
  const filteredSubgroups = group.subgroups.filter(sg => 
    showAllLevels || isHighLevelAccess(sg.user_access.access_level_name)
  );
  
  const hasChildren = filteredSubgroups.length > 0 || filteredProjects.length > 0;
  
  // Filter based on search
  const matchesSearch = (text: string) => 
    text.toLowerCase().includes(searchTerm.toLowerCase());
  
  const groupMatches = matchesSearch(group.name) || matchesSearch(group.full_path);
  const hasMatchingChildren = 
    filteredSubgroups.some(sg => matchesSearch(sg.name) || matchesSearch(sg.full_path)) ||
    filteredProjects.some(p => matchesSearch(p.name) || matchesSearch(p.path));
  
  // Auto-expand if search matches children
  React.useEffect(() => {
    if (searchTerm && hasMatchingChildren && !groupMatches) {
      setExpanded(true);
    }
  }, [searchTerm, hasMatchingChildren, groupMatches]);
  
  // Don't show if doesn't match search or access level filter
  if (!shouldShowGroup || (searchTerm && !groupMatches && !hasMatchingChildren)) {
    return null;
  }

  if (group.error) {
    return (
      <Box sx={{ ml: 2, mb: 1 }}>
        <Alert severity="error" sx={{ py: 0.5 }}>
          {group.name}: {group.error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 1 }}>
      <Paper
        elevation={1}
        sx={{
          p: 1.5,
          cursor: hasChildren ? 'pointer' : 'default',
          '&:hover': {
            bgcolor: 'action.hover',
          },
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasChildren && (
            <IconButton size="small" sx={{ p: 0 }}>
              {expanded ? <ExpandMore /> : <ChevronRight />}
            </IconButton>
          )}
          {!hasChildren && <Box sx={{ width: 24 }} />}
          
          {expanded ? <FolderOpen color="warning" /> : <Folder color="warning" />}
          
          <Typography variant="body1" fontWeight="medium" sx={{ flexGrow: 1 }}>
            {group.name}
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={`${group.member_count} members`}>
              <Chip
                icon={<Group />}
                label={group.member_count}
                size="small"
                variant="outlined"
              />
            </Tooltip>
            
            <Tooltip title={`Your access: ${group.user_access.access_level_name}`}>
              <Chip
                label={group.user_access.access_level_name}
                size="small"
                sx={{
                  bgcolor: getAccessLevelColor(group.user_access.access_level_name),
                  color: 'white',
                }}
              />
            </Tooltip>
            
            <Tooltip title={`Visibility: ${group.visibility}`}>
              <Box>{getVisibilityIcon(group.visibility)}</Box>
            </Tooltip>
          </Stack>
        </Box>
        
        {group.description && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 5, display: 'block' }}>
            {group.description}
          </Typography>
        )}
      </Paper>

      <Collapse in={expanded}>
        <Box sx={{ ml: 3, mt: 1 }}>
          {/* Projects */}
          {filteredProjects
            .filter(p => !searchTerm || matchesSearch(p.name) || matchesSearch(p.path))
            .map(project => (
            <Paper
              key={project.id}
              elevation={0}
              sx={{
                p: 1,
                mb: 0.5,
                bgcolor: 'background.default',
                border: 1,
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Code color="primary" fontSize="small" />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {project.name}
                </Typography>
                
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Tooltip title={`${project.member_count} members`}>
                    <Chip
                      label={project.member_count}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.75rem' }}
                    />
                  </Tooltip>
                  
                  <Tooltip title={`Your access: ${project.user_access.access_level_name}`}>
                    <Chip
                      label={project.user_access.access_level_name}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        bgcolor: getAccessLevelColor(project.user_access.access_level_name),
                        color: 'white',
                      }}
                    />
                  </Tooltip>
                  
                  <Tooltip title={`Visibility: ${project.visibility}`}>
                    <Box>{getVisibilityIcon(project.visibility)}</Box>
                  </Tooltip>
                </Stack>
              </Box>
              
              {project.description && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 3, display: 'block' }}>
                  {project.description}
                </Typography>
              )}
            </Paper>
          ))}
          
          {/* Subgroups */}
          {filteredSubgroups.map(subgroup => (
            <GroupNode key={subgroup.id} group={subgroup} searchTerm={searchTerm} showAllLevels={showAllLevels} />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export const PermissionTree: React.FC = () => {
  const [data, setData] = useState<PermissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllLevels, setShowAllLevels] = useState(false);

  useEffect(() => {
    loadPermissionData();
  }, []);

  const loadPermissionData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get<PermissionData>('/api/permissions/overview');
      setData(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load permission data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Your GitLab Permissions
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={showAllLevels}
                  onChange={(e) => setShowAllLevels(e.target.checked)}
                />
              }
              label={showAllLevels ? "Show all access levels" : "Show Developer+ only"}
              labelPlacement="start"
            />
          </Box>
          
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search groups and projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Access Levels:
            </Typography>
            {['owner', 'maintainer', 'developer', 'reporter', 'guest'].map(level => (
              <Chip
                key={level}
                label={level}
                size="small"
                sx={{
                  bgcolor: getAccessLevelColor(level),
                  color: 'white',
                  height: 20,
                  fontSize: '0.75rem',
                }}
              />
            ))}
          </Stack>
        </Box>

        <Box>
          {data.groups.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
              No groups found
            </Typography>
          ) : (
            data.groups.map(group => (
              <GroupNode key={group.id} group={group} searchTerm={searchTerm} showAllLevels={showAllLevels} />
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
};