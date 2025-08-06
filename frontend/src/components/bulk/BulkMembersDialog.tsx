import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Tabs,
  Tab,
  TextField,
  Autocomplete,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  CircularProgress,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import CodeIcon from '@mui/icons-material/Code';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import GroupIcon from '@mui/icons-material/Group';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import { useNotification } from '../../hooks/useNotification';

interface BulkMembersDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: () => void;
}

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  avatar_url?: string;
  web_url?: string;
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

const ACCESS_LEVELS = [
  { value: 10, label: 'Guest' },
  { value: 20, label: 'Reporter' },
  { value: 30, label: 'Developer' },
  { value: 40, label: 'Maintainer' },
  { value: 50, label: 'Owner' },
];

export const BulkMembersDialog: React.FC<BulkMembersDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [accessLevel, setAccessLevel] = useState(30); // Developer by default
  const [existingMembers, setExistingMembers] = useState<User[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [results, setResults] = useState<any>(null);
  const { showSuccess, showError } = useNotification();

  const groups = selectedItems.filter(item => item.type === 'group');
  const projects = selectedItems.filter(item => item.type === 'project');

  // Load existing members when tab changes to remove
  useEffect(() => {
    if (tab === 1 && selectedItems.length > 0) {
      loadExistingMembers();
    }
  }, [tab, selectedItems]);

  const loadExistingMembers = async () => {
    if (selectedItems.length === 0) return;
    
    setLoading(true);
    try {
      // For simplicity, load members from the first item
      const firstItem = selectedItems[0];
      const itemId = parseInt(firstItem.id.replace(/^(group|project)-/, ''));
      
      const response = await axios.get(
        `/api/members/${firstItem.type}/${itemId}`,
        { withCredentials: true }
      );
      
      setExistingMembers(response.data);
    } catch (error) {
      showError('Failed to load existing members');
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) return;
    
    setSearchLoading(true);
    try {
      const response = await axios.get('/api/members/search/users', {
        params: { search: query },
        withCredentials: true,
      });
      
      setSearchResults(response.data);
    } catch (error) {
      showError('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      showError('Please select at least one user');
      return;
    }

    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await axios.post('/api/members/bulk-add', {
        items,
        users: selectedUsers,
        accessLevel,
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`Successfully added members to ${response.data.results.successful.length} items`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`Failed to add members to ${response.data.results.failed.length} items`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to add members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMembers = async () => {
    if (selectedMemberIds.length === 0) {
      showError('Please select at least one member to remove');
      return;
    }

    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await axios.post('/api/members/bulk-remove', {
        items,
        userIds: selectedMemberIds,
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`Successfully removed members from ${response.data.results.successful.length} items`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`Failed to remove members from ${response.data.results.failed.length} items`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to remove members');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccess = async () => {
    if (selectedMemberIds.length === 0) {
      showError('Please select at least one member to update');
      return;
    }

    setLoading(true);
    try {
      const items = selectedItems.map(item => ({
        id: parseInt(item.id.replace(/^(group|project)-/, '')),
        name: item.name,
        type: item.type,
      }));

      const response = await axios.post('/api/members/bulk-update-access', {
        items,
        userIds: selectedMemberIds,
        accessLevel,
      }, { withCredentials: true });

      setResults(response.data.results);
      
      if (response.data.results.successful?.length > 0) {
        showSuccess(`Successfully updated access for ${response.data.results.successful.length} items`);
      }
      if (response.data.results.failed?.length > 0) {
        showError(`Failed to update access for ${response.data.results.failed.length} items`);
      }
      
      if (onSuccess && response.data.results.successful?.length > 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update access levels');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setResults(null);
      setSelectedUsers([]);
      setSelectedMemberIds([]);
      setSearchResults([]);
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon />
          <Typography variant="h6">멤버 일괄 관리</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {selectedItems.length}개 항목의 멤버를 관리합니다
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {/* Selected items summary */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {groups.length > 0 && (
              <Chip
                icon={<FolderIcon />}
                label={`${groups.length}개 그룹`}
                color="warning"
                size="small"
              />
            )}
            {projects.length > 0 && (
              <Chip
                icon={<CodeIcon />}
                label={`${projects.length}개 프로젝트`}
                color="primary"
                size="small"
              />
            )}
          </Box>
        </Box>

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {/* Results */}
        {results ? (
          <Alert 
            severity={results.failed?.length === 0 ? 'success' : 'warning'}
            sx={{ mb: 2 }}
          >
            <Typography variant="subtitle2">작업 완료</Typography>
            <Typography variant="body2">
              성공: {results.successful?.length || 0} | 실패: {results.failed?.length || 0}
            </Typography>
            {results.failed?.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="error">
                  실패 항목:
                </Typography>
                <List dense>
                  {results.failed.slice(0, 3).map((item: any, index: number) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`${item.item?.name} - ${item.user?.username || `User ${item.userId}`}`}
                        secondary={item.error}
                      />
                    </ListItem>
                  ))}
                  {results.failed.length > 3 && (
                    <Typography variant="caption" color="text.secondary">
                      ... 외 {results.failed.length - 3}개
                    </Typography>
                  )}
                </List>
              </Box>
            )}
          </Alert>
        ) : (
          <>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="멤버 추가" icon={<PersonAddIcon />} />
              <Tab label="멤버 제거" icon={<PersonRemoveIcon />} />
              <Tab label="권한 변경" icon={<GroupIcon />} />
            </Tabs>

            {/* Add Members Tab */}
            <TabPanel value={tab} index={0}>
              <Box sx={{ mb: 2 }}>
                <Autocomplete
                  multiple
                  options={searchResults}
                  value={selectedUsers}
                  onChange={(_, newValue) => setSelectedUsers(newValue)}
                  getOptionLabel={(option) => `${option.name} (@${option.username})`}
                  loading={searchLoading}
                  onInputChange={(_, value) => {
                    if (value.length >= 2) {
                      searchUsers(value);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="사용자 검색"
                      placeholder="이름 또는 사용자명 입력..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {searchLoading && <CircularProgress color="inherit" size={20} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <ListItemAvatar>
                        <Avatar src={option.avatar_url} sx={{ width: 32, height: 32 }}>
                          {option.name[0]}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={option.name}
                        secondary={`@${option.username} • ${option.email}`}
                      />
                    </Box>
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        avatar={<Avatar src={option.avatar_url}>{option.name[0]}</Avatar>}
                        label={option.username}
                        {...getTagProps({ index })}
                      />
                    ))
                  }
                />
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>액세스 레벨</InputLabel>
                <Select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as number)}
                  label="액세스 레벨"
                >
                  {ACCESS_LEVELS.map(level => (
                    <MenuItem key={level.value} value={level.value}>
                      {level.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedUsers.length > 0 && (
                <Alert severity="info">
                  {selectedUsers.length}명의 사용자를 {selectedItems.length}개 항목에 추가합니다
                </Alert>
              )}
            </TabPanel>

            {/* Remove Members Tab */}
            <TabPanel value={tab} index={1}>
              {existingMembers.length === 0 ? (
                <Alert severity="info">
                  멤버 목록을 불러오는 중...
                </Alert>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    제거할 멤버 선택:
                  </Typography>
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {existingMembers.map((member: any) => (
                      <ListItem
                        key={member.id}
                        secondaryAction={
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setSelectedMemberIds(prev =>
                                prev.includes(member.id)
                                  ? prev.filter(id => id !== member.id)
                                  : [...prev, member.id]
                              );
                            }}
                            color={selectedMemberIds.includes(member.id) ? 'error' : 'default'}
                          >
                            <DeleteIcon />
                          </IconButton>
                        }
                      >
                        <ListItemAvatar>
                          <Avatar src={member.avatar_url}>{member.name?.[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.name || member.username}
                          secondary={`@${member.username} • ${ACCESS_LEVELS.find(l => l.value === member.access_level)?.label}`}
                        />
                      </ListItem>
                    ))}
                  </List>
                  {selectedMemberIds.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      {selectedMemberIds.length}명의 멤버를 {selectedItems.length}개 항목에서 제거합니다
                    </Alert>
                  )}
                </>
              )}
            </TabPanel>

            {/* Update Access Level Tab */}
            <TabPanel value={tab} index={2}>
              {existingMembers.length === 0 ? (
                <Alert severity="info">
                  멤버 목록을 불러오는 중...
                </Alert>
              ) : (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    권한을 변경할 멤버 선택:
                  </Typography>
                  <List sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                    {existingMembers.map((member: any) => (
                      <ListItem
                        key={member.id}
                        onClick={() => {
                          setSelectedMemberIds(prev =>
                            prev.includes(member.id)
                              ? prev.filter(id => id !== member.id)
                              : [...prev, member.id]
                          );
                        }}
                        selected={selectedMemberIds.includes(member.id)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <ListItemAvatar>
                          <Avatar src={member.avatar_url}>{member.name?.[0]}</Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={member.name || member.username}
                          secondary={`@${member.username} • 현재: ${ACCESS_LEVELS.find(l => l.value === member.access_level)?.label}`}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>새 액세스 레벨</InputLabel>
                    <Select
                      value={accessLevel}
                      onChange={(e) => setAccessLevel(e.target.value as number)}
                      label="새 액세스 레벨"
                    >
                      {ACCESS_LEVELS.map(level => (
                        <MenuItem key={level.value} value={level.value}>
                          {level.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedMemberIds.length > 0 && (
                    <Alert severity="info">
                      {selectedMemberIds.length}명의 권한을 {ACCESS_LEVELS.find(l => l.value === accessLevel)?.label}로 변경합니다
                    </Alert>
                  )}
                </>
              )}
            </TabPanel>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {results ? '닫기' : '취소'}
        </Button>
        {!results && (
          <>
            {tab === 0 && (
              <Button 
                onClick={handleAddMembers} 
                variant="contained" 
                disabled={loading || selectedUsers.length === 0}
                startIcon={<PersonAddIcon />}
              >
                멤버 추가
              </Button>
            )}
            {tab === 1 && (
              <Button 
                onClick={handleRemoveMembers} 
                variant="contained" 
                color="error"
                disabled={loading || selectedMemberIds.length === 0}
                startIcon={<PersonRemoveIcon />}
              >
                멤버 제거
              </Button>
            )}
            {tab === 2 && (
              <Button 
                onClick={handleUpdateAccess} 
                variant="contained" 
                disabled={loading || selectedMemberIds.length === 0}
                startIcon={<GroupIcon />}
              >
                권한 변경
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};