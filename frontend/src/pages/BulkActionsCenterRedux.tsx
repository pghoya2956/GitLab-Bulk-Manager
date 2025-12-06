import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  Snackbar,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  ClearAll as ClearAllIcon,
  History as HistoryIcon,
} from '@mui/icons-material';

// Redux hooks and actions
import { useAppDispatch } from '../store/hooks';
import {
  useSelection,
  useHistory,
  useBulkOperations,
  useGitLabData,
} from '../store/hooks';
import { setGroups, setProjects, setLoading, setError, setShowArchived, ArchivedFilter } from '../store/slices/gitlabSlice';

// Components
import { GroupProjectTree } from '../components/tree/GroupProjectTree';
import { BulkDeleteDialog } from '../components/bulk/BulkDeleteDialog';
import { BulkTransferDialog } from '../components/bulk/BulkTransferDialog';
import { BulkArchiveDialog } from '../components/bulk/BulkArchiveDialog';
import { BulkUnarchiveDialog } from '../components/bulk/BulkUnarchiveDialog';
import { BulkCloneDialog } from '../components/bulk/BulkCloneDialog';
import { BulkImportDialog } from '../components/bulk/BulkImportDialog';
import { BulkSettingsDialog } from '../components/bulk/BulkSettingsDialog';
import { BulkMembersDialog } from '../components/bulk/BulkMembersDialog';
import { BulkCICDDialog } from '../components/bulk/BulkCICDDialog';
import { BulkIssuesDialog } from '../components/bulk/BulkIssuesDialog';
import { BulkProtectionDialog } from '../components/bulk/BulkProtectionDialog';
import { BulkActionCards } from '../components/BulkActionCards';
import { ActionHistorySidebar } from '../components/ActionHistorySidebar';
import ProgressDialog from '../components/ProgressDialog';

// API
import { bulkAPI } from '../api/bulkOperations';
import { gitlabAPI } from '../api/gitlab';

const BulkActionsCenterRedux: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux state
  const {
    selectedItems,
    selectedCount,
    selectItems,
    toggleItem,
    clearSelection,
  } = useSelection();

  const {
    actions: historyActions,
    addHistoryAction,
  } = useHistory();

  const {
    currentOperation,
  } = useBulkOperations();

  const { loading: dataLoading, error: dataError, showArchived } = useGitLabData();

  // Local state for dialogs
  const [dialogs, setDialogs] = useState({
    create: false,
    delete: false,
    transfer: false,
    archive: false,
    unarchive: false,
    clone: false,
    settings: false,
    members: false,
    cicd: false,
    issues: false,
    protection: false,
  });

  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' | 'info' });

  // Fetch GitLab data on mount
  const fetchData = useCallback(async () => {
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      const [groupsData, projectsData] = await Promise.all([
        gitlabAPI.getGroups(),
        gitlabAPI.getProjects({ includeArchived: showArchived }),
      ]);

      dispatch(setGroups(groupsData));
      dispatch(setProjects(projectsData));
    } catch (err: any) {
      console.error('Failed to fetch GitLab data:', err);
      dispatch(setError(err.message || 'Failed to fetch GitLab data'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, showArchived]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle archived filter change
  const handleArchivedFilterChange = (value: ArchivedFilter) => {
    dispatch(setShowArchived(value));
  };

  // Calculate counts
  const selectedGroups = selectedItems.filter(item => item.type === 'group');
  const selectedProjects = selectedItems.filter(item => item.type === 'project');

  // Get first selected group for import dialog
  const selectedGroupForImport = selectedGroups.length > 0 ? {
    id: selectedGroups[0].id,
    name: selectedGroups[0].name,
    full_path: selectedGroups[0].fullPath || selectedGroups[0].path || selectedGroups[0].name,
  } : undefined;

  // Dialog handlers
  const openDialog = (type: keyof typeof dialogs) => {
    setDialogs(prev => ({ ...prev, [type]: true }));
  };

  const closeDialog = (type: keyof typeof dialogs) => {
    setDialogs(prev => ({ ...prev, [type]: false }));
  };

  // Handle action card clicks
  const handleActionClick = (actionId: string) => {
    switch (actionId) {
      case 'create':
        openDialog('create');
        break;
      case 'delete':
        if (selectedCount > 0) openDialog('delete');
        break;
      case 'transfer':
        if (selectedCount > 0) openDialog('transfer');
        break;
      case 'clone':
        if (selectedCount > 0) openDialog('clone');
        break;
      case 'archive':
        if (selectedCount > 0) openDialog('archive');
        break;
      case 'unarchive':
        if (selectedCount > 0) openDialog('unarchive');
        break;
      case 'settings':
        if (selectedCount > 0) openDialog('settings');
        break;
      case 'members':
        if (selectedCount > 0) openDialog('members');
        break;
      case 'cicd':
        if (selectedCount > 0) openDialog('cicd');
        break;
      case 'issues':
        if (selectedCount > 0) openDialog('issues');
        break;
      case 'protection':
        if (selectedCount > 0) openDialog('protection');
        break;
      default:
        console.log('Action not implemented:', actionId);
    }
  };

  // Handle drag and drop transfer (simple transfer without progress dialog)
  const handleDragDropTransfer = async (targetGroup: any, draggedItems: any[]) => {
    // Extract numeric ID from target group
    const targetNamespaceId = targetGroup.id.replace(/^group-/, '');

    try {
      const response = await bulkAPI.bulkTransfer(draggedItems, targetNamespaceId);

      addHistoryAction({
        type: 'transfer',
        description: `Transferred ${draggedItems.length} items to ${targetGroup.name}`,
        items: draggedItems,
        metadata: { targetNamespace: targetNamespaceId },
        undoable: false,
      });

      clearSelection();
      setSnackbar({
        open: true,
        message: `Successfully transferred ${response.data.results?.success?.length || 0} items to ${targetGroup.name}`,
        severity: 'success',
      });

      // Refresh data
      fetchData();
    } catch (error: any) {
      setSnackbar({
        open: true,
        message: error.message || 'Transfer operation failed',
        severity: 'error',
      });
    }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', position: 'relative' }}>
      {/* Left Panel - Tree View */}
      <Paper
        sx={{
          width: 400,
          minWidth: 300,
          maxWidth: 500,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          borderRight: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              GitLab Resources
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={fetchData} disabled={dataLoading} size="small">
                {dataLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Archived Filter */}
          <FormControl size="small" sx={{ mt: 1.5, minWidth: 180 }}>
            <InputLabel id="archived-filter-label">프로젝트 필터</InputLabel>
            <Select
              labelId="archived-filter-label"
              value={showArchived}
              label="프로젝트 필터"
              onChange={(e) => handleArchivedFilterChange(e.target.value as ArchivedFilter)}
            >
              <MenuItem value="false">활성 프로젝트만</MenuItem>
              <MenuItem value="true">아카이브만</MenuItem>
              <MenuItem value="both">전체 (활성 + 아카이브)</MenuItem>
            </Select>
          </FormControl>

          {/* Selection Info */}
          {selectedCount > 0 && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Chip
                label={`${selectedCount} selected`}
                color="primary"
                size="small"
              />
              {selectedGroups.length > 0 && (
                <Chip
                  label={`${selectedGroups.length} groups`}
                  variant="outlined"
                  size="small"
                />
              )}
              {selectedProjects.length > 0 && (
                <Chip
                  label={`${selectedProjects.length} projects`}
                  variant="outlined"
                  size="small"
                />
              )}
              <IconButton size="small" onClick={clearSelection}>
                <ClearAllIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>

        {/* Tree View */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          {dataError ? (
            <Alert severity="error" sx={{ m: 2 }}>
              {dataError}
            </Alert>
          ) : (
            <GroupProjectTree
              selectedItems={selectedItems}
              onSelectionChange={selectItems}
              onItemToggle={toggleItem}
              onDrop={handleDragDropTransfer}
            />
          )}
        </Box>
      </Paper>

      {/* Right Panel - Actions */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Header */}
        <Paper sx={{ p: 2, m: 2, mb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Bulk Actions Center
            </Typography>

            {/* History Sidebar Toggle */}
            <Tooltip title="Action History">
              <IconButton onClick={() => setHistorySidebarOpen(!historySidebarOpen)} size="small">
                <Badge badgeContent={historyActions.length} color="primary">
                  <HistoryIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        {/* Action Cards */}
        <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
          <BulkActionCards
            onActionClick={handleActionClick}
            selectedCount={selectedCount}
            selectedProjectsCount={selectedProjects.length}
            selectedGroupsCount={selectedGroups.length}
          />
        </Box>
      </Box>

      {/* History Sidebar */}
      <ActionHistorySidebar
        open={historySidebarOpen}
        onClose={() => setHistorySidebarOpen(false)}
        actions={historyActions as any[]}
      />

      {/* Dialogs */}
      <BulkImportDialog
        open={dialogs.create}
        onClose={() => closeDialog('create')}
        selectedGroup={selectedGroupForImport}
        onSuccess={() => {
          closeDialog('create');
          fetchData();
        }}
      />

      <BulkDeleteDialog
        open={dialogs.delete}
        onClose={() => closeDialog('delete')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          clearSelection();
          fetchData();
        }}
      />

      <BulkTransferDialog
        open={dialogs.transfer}
        onClose={() => closeDialog('transfer')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          clearSelection();
          fetchData();
        }}
      />

      <BulkArchiveDialog
        open={dialogs.archive}
        onClose={() => closeDialog('archive')}
        selectedItems={selectedItems.map(item => ({
          ...item,
          full_path: item.path || item.fullPath || item.name
        }))}
        onSuccess={() => {
          clearSelection();
          fetchData();
        }}
      />

      <BulkUnarchiveDialog
        open={dialogs.unarchive}
        onClose={() => closeDialog('unarchive')}
        selectedItems={selectedItems.map(item => ({
          ...item,
          full_path: item.path || item.name
        }))}
        onSuccess={() => {
          clearSelection();
          fetchData();
        }}
      />

      <BulkCloneDialog
        open={dialogs.clone}
        onClose={() => closeDialog('clone')}
        selectedItems={selectedItems.map(item => ({
          ...item,
          full_path: item.path || item.name
        }))}
        onSuccess={() => {
          clearSelection();
          fetchData();
        }}
      />

      <BulkSettingsDialog
        open={dialogs.settings}
        onClose={() => closeDialog('settings')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          closeDialog('settings');
          fetchData();
        }}
      />

      <BulkMembersDialog
        open={dialogs.members}
        onClose={() => closeDialog('members')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          closeDialog('members');
          fetchData();
        }}
      />

      <BulkCICDDialog
        open={dialogs.cicd}
        onClose={() => closeDialog('cicd')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          closeDialog('cicd');
          fetchData();
        }}
      />

      <BulkIssuesDialog
        open={dialogs.issues}
        onClose={() => closeDialog('issues')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          closeDialog('issues');
          fetchData();
        }}
      />

      <BulkProtectionDialog
        open={dialogs.protection}
        onClose={() => closeDialog('protection')}
        selectedItems={selectedItems as any[]}
        onSuccess={() => {
          closeDialog('protection');
          fetchData();
        }}
      />

      {/* Progress Dialog */}
      {currentOperation && (
        <ProgressDialog
          open={true}
          title={`Bulk ${currentOperation.type} Operation`}
          message={`Processing ${currentOperation.progress} of ${currentOperation.total} items`}
          progress={(currentOperation.progress / currentOperation.total) * 100}
          onClose={() => {}}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default BulkActionsCenterRedux;
