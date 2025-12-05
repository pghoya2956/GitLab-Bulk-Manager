/**
 * BulkTransferDialog - 순차 처리 버전
 * 항목별 실시간 진행률 표시
 */

import { useState, useEffect } from 'react';
import { Alert, Typography, Box, Autocomplete, TextField } from '@mui/material';
import { MoveUp } from '@mui/icons-material';
import type { GitLabGroup, GitLabProject } from '../../types/gitlab';

// Base Components
import { BaseBulkDialog } from '../common/BaseBulkDialog';
import { BulkItemList } from '../common/BulkItemList';
import { BulkProgressDialog } from '../common/BulkProgressDialog';
import { DialogActionButtons } from '../common/BulkActionButtons';

// Hooks
import { useSequentialBulkOperation } from '../../hooks/useSequentialBulkOperation';
import { useGroups } from '../../hooks/useGitLabData';
import { useHistory } from '../../store/hooks';
import { gitlabService } from '../../services/gitlab';
import { IdConverter } from '../../utils/idConverter';

interface BulkTransferDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<(GitLabGroup | GitLabProject) & { type: 'group' | 'project'; full_path?: string }>;
  targetNamespace?: { id: string | number; name?: string; full_path?: string; path?: string };
  onSuccess?: (result?: unknown) => void;
}

interface Namespace {
  id: number;
  name: string;
  full_path: string;
  kind: string;
}

export function BulkTransferDialog({
  open,
  onClose,
  selectedItems,
  targetNamespace,
  onSuccess,
}: BulkTransferDialogProps) {
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // Redux hooks
  const { addHistoryAction } = useHistory();

  // 순차 처리 훅
  const sequentialOp = useSequentialBulkOperation({
    delayBetweenItems: 500,
    onComplete: (result) => {
      // Add to history
      addHistoryAction({
        type: 'transfer',
        description: `Transferred ${result.success.length} items to ${selectedNamespace?.full_path}`,
        items: selectedItems,
        metadata: { targetNamespace: selectedNamespace },
        timestamp: new Date().toISOString(),
        undoable: false,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    },
  });

  const { data: groups, loading: loadingNamespaces } = useGroups({
    cache: true,
    ttl: 10 * 60 * 1000
  });

  // 네임스페이스 목록 준비
  const namespaces: Namespace[] = (groups || []).map(group => ({
    id: group.id,
    name: group.name,
    full_path: group.full_path,
    kind: 'group'
  }));

  // targetNamespace가 제공된 경우 자동 설정
  useEffect(() => {
    if (targetNamespace && open) {
      const numericId = typeof targetNamespace.id === 'string' && targetNamespace.id.includes('-')
        ? parseInt(targetNamespace.id.split('-').pop() || '0')
        : Number(targetNamespace.id);

      setSelectedNamespace({
        id: numericId,
        name: targetNamespace.name || targetNamespace.full_path || '',
        full_path: targetNamespace.full_path || targetNamespace.path || '',
        kind: 'group'
      });
    }
  }, [targetNamespace, open]);

  const handleTransfer = async () => {
    if (!selectedNamespace || selectedItems.length === 0) return;

    setShowProgress(true);

    // 순차 처리 시작
    await sequentialOp.execute(
      selectedItems.map(item => ({
        id: String(item.id),
        name: item.name,
        type: item.type as 'group' | 'project',
        full_path: item.full_path || item.path || '',
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        if (item.type === 'project') {
          await gitlabService.transferProject(numericId, selectedNamespace.id);
        } else {
          await gitlabService.transferGroup(numericId, selectedNamespace.id);
        }
      }
    );
  };

  const handleClose = () => {
    if (sequentialOp.isRunning) return;
    sequentialOp.reset();
    setSelectedNamespace(null);
    setShowProgress(false);
    onClose();
  };

  const handleProgressComplete = () => {
    setShowProgress(false);
    handleClose();
  };

  // 진행 다이얼로그 표시 중이면
  if (showProgress) {
    return (
      <BulkProgressDialog
        open={open}
        onClose={handleClose}
        title="네임스페이스 이동 중"
        subtitle={`${selectedItems.length}개 항목을 ${selectedNamespace?.full_path || '대상 네임스페이스'}로 이동합니다`}
        items={sequentialOp.items}
        currentIndex={sequentialOp.currentIndex}
        progress={sequentialOp.progress}
        completed={sequentialOp.completed}
        failed={sequentialOp.failed}
        total={sequentialOp.total}
        isRunning={sequentialOp.isRunning}
        isPaused={sequentialOp.isPaused}
        isCancelled={sequentialOp.isCancelled}
        startTime={sequentialOp.startTime}
        onCancel={sequentialOp.cancel}
        onPause={sequentialOp.pause}
        onResume={sequentialOp.resume}
        onComplete={handleProgressComplete}
      />
    );
  }

  return (
    <BaseBulkDialog
      open={open}
      onClose={handleClose}
      title="일괄 네임스페이스 이동"
      subtitle={`${selectedItems.length}개 항목을 다른 네임스페이스로 이동합니다`}
      icon={<MoveUp color="primary" />}
      maxWidth="md"
      actions={
        <DialogActionButtons
          onCancel={handleClose}
          onConfirm={handleTransfer}
          confirmLabel="이동"
          confirmColor="primary"
          confirmIcon={<MoveUp />}
          disabled={!selectedNamespace || selectedItems.length === 0}
        />
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          선택한 항목을 다른 네임스페이스(그룹)로 이동합니다.
        </Typography>
      </Alert>

      <Box sx={{ mb: 3 }}>
        <Autocomplete
          options={namespaces}
          getOptionLabel={(option) => `${option.name} (${option.full_path})`}
          value={selectedNamespace}
          onChange={(_, newValue) => setSelectedNamespace(newValue)}
          loading={loadingNamespaces}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="대상 네임스페이스"
              placeholder="이동할 네임스페이스를 선택하세요"
              variant="outlined"
              fullWidth
            />
          )}
        />
      </Box>

      <BulkItemList
        items={selectedItems}
        title="이동할 항목"
        searchable={selectedItems.length > 10}
        maxHeight={300}
        showStats
      />
    </BaseBulkDialog>
  );
}