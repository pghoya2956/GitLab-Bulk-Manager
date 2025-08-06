import React, { useState } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import SecurityIcon from '@mui/icons-material/Security';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import LabelIcon from '@mui/icons-material/Label';
import BackupIcon from '@mui/icons-material/Backup';
import RestoreIcon from '@mui/icons-material/Restore';

interface BulkActionsMenuProps {
  anchorEl: null | HTMLElement;
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onBulkAction: (action: string, params?: any) => void;
}

export const BulkActionsMenu: React.FC<BulkActionsMenuProps> = ({
  anchorEl,
  open,
  onClose,
  selectedCount,
  onBulkAction,
}) => {
  const [dialogOpen, setDialogOpen] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [accessLevel, setAccessLevel] = useState('developer');
  const [labels, setLabels] = useState('');

  const handleAction = (action: string) => {
    switch (action) {
      case 'delete':
      case 'archive':
      case 'unarchive':
      case 'clone':
      case 'backup':
      case 'restore':
        onBulkAction(action);
        onClose();
        break;
      case 'transfer':
      case 'visibility':
      case 'permissions':
      case 'labels':
        setDialogOpen(action);
        onClose();
        break;
    }
  };

  const handleDialogConfirm = () => {
    switch (dialogOpen) {
      case 'transfer':
        onBulkAction('transfer', { target: transferTarget });
        break;
      case 'visibility':
        onBulkAction('visibility', { level: visibility });
        break;
      case 'permissions':
        onBulkAction('permissions', { level: accessLevel });
        break;
      case 'labels':
        onBulkAction('labels', { labels: labels.split(',').map(l => l.trim()) });
        break;
    }
    setDialogOpen(null);
  };

  return (
    <>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={onClose}
        PaperProps={{
          sx: { width: 280 }
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {selectedCount}개 항목 선택됨
          </Typography>
        </Box>
        <Divider />
        
        {/* Transfer Operations */}
        <MenuItem onClick={() => handleAction('transfer')}>
          <ListItemIcon>
            <TransferWithinAStationIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="다른 그룹으로 이동" />
        </MenuItem>
        
        <MenuItem onClick={() => handleAction('clone')}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="복제" />
        </MenuItem>
        
        <Divider />
        
        {/* Visibility & Permissions */}
        <MenuItem onClick={() => handleAction('visibility')}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="가시성 변경" />
        </MenuItem>
        
        <MenuItem onClick={() => handleAction('permissions')}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="권한 일괄 변경" />
        </MenuItem>
        
        <MenuItem onClick={() => handleAction('labels')}>
          <ListItemIcon>
            <LabelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="라벨 추가/제거" />
        </MenuItem>
        
        <Divider />
        
        {/* Archive Operations */}
        <MenuItem onClick={() => handleAction('archive')}>
          <ListItemIcon>
            <ArchiveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="아카이브" />
        </MenuItem>
        
        <MenuItem onClick={() => handleAction('unarchive')}>
          <ListItemIcon>
            <UnarchiveIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="아카이브 해제" />
        </MenuItem>
        
        <Divider />
        
        {/* Backup & Restore */}
        <MenuItem onClick={() => handleAction('backup')}>
          <ListItemIcon>
            <BackupIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="백업 (Export)" />
        </MenuItem>
        
        <MenuItem onClick={() => handleAction('restore')}>
          <ListItemIcon>
            <RestoreIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="복원 (Import)" />
        </MenuItem>
        
        <Divider />
        
        {/* Delete */}
        <MenuItem onClick={() => handleAction('delete')} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText primary="삭제" />
        </MenuItem>
      </Menu>

      {/* Transfer Dialog */}
      <Dialog open={dialogOpen === 'transfer'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>그룹 이동</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="대상 그룹 경로"
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            placeholder="예: my-group/sub-group"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>취소</Button>
          <Button onClick={handleDialogConfirm} variant="contained">이동</Button>
        </DialogActions>
      </Dialog>

      {/* Visibility Dialog */}
      <Dialog open={dialogOpen === 'visibility'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>가시성 변경</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>가시성</InputLabel>
            <Select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              label="가시성"
            >
              <MenuItem value="private">Private</MenuItem>
              <MenuItem value="internal">Internal</MenuItem>
              <MenuItem value="public">Public</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>취소</Button>
          <Button onClick={handleDialogConfirm} variant="contained">변경</Button>
        </DialogActions>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={dialogOpen === 'permissions'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>권한 일괄 변경</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>기본 액세스 레벨</InputLabel>
            <Select
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              label="기본 액세스 레벨"
            >
              <MenuItem value="guest">Guest</MenuItem>
              <MenuItem value="reporter">Reporter</MenuItem>
              <MenuItem value="developer">Developer</MenuItem>
              <MenuItem value="maintainer">Maintainer</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>취소</Button>
          <Button onClick={handleDialogConfirm} variant="contained">변경</Button>
        </DialogActions>
      </Dialog>

      {/* Labels Dialog */}
      <Dialog open={dialogOpen === 'labels'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>라벨 추가</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="라벨 (쉼표로 구분)"
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="예: production, critical, team-a"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>취소</Button>
          <Button onClick={handleDialogConfirm} variant="contained">추가</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};