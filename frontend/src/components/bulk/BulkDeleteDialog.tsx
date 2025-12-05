/**
 * BulkDeleteDialog - 순차 처리 버전
 * 항목별 실시간 진행률 표시
 */

import { useState } from 'react';
import { Alert, Typography, Box, Checkbox } from '@mui/material';
import { Warning } from '@mui/icons-material';

// Base Components
import { BaseBulkDialog } from '../common/BaseBulkDialog';
import { BulkItemList } from '../common/BulkItemList';
import { BulkProgressDialog } from '../common/BulkProgressDialog';
import { DialogActionButtons } from '../common/BulkActionButtons';

// Hooks
import { useSequentialBulkOperation } from '../../hooks/useSequentialBulkOperation';
import { useHistory } from '../../store/hooks';
import { gitlabService } from '../../services/gitlab';
import { IdConverter } from '../../utils/idConverter';

interface BulkDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path?: string;
  }>;
  onSuccess?: (result?: any) => void;
}

export function BulkDeleteDialog({
  open,
  onClose,
  selectedItems,
  onSuccess,
}: BulkDeleteDialogProps) {
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  // Redux hooks
  const { addHistoryAction } = useHistory();

  // 순차 처리 훅
  const sequentialOp = useSequentialBulkOperation({
    delayBetweenItems: 500,
    onComplete: (result) => {
      // Add to history (삭제는 되돌릴 수 없음)
      addHistoryAction({
        type: 'delete',
        description: `Deleted ${result.success.length} items`,
        items: selectedItems,
        timestamp: new Date().toISOString(),
        undoable: false,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    },
  });

  // 프로젝트를 먼저 삭제하고, 그 다음 그룹 삭제 (의존성 순서)
  const sortedItems = [...selectedItems].sort((a, b) => {
    if (a.type === 'project' && b.type === 'group') return -1;
    if (a.type === 'group' && b.type === 'project') return 1;
    return 0;
  });

  const handleDelete = async () => {
    if (!confirmChecked) return;

    setShowProgress(true);

    // 순차 처리 시작
    await sequentialOp.execute(
      sortedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type as 'group' | 'project',
        full_path: item.full_path,
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        if (item.type === 'project') {
          await gitlabService.deleteProject(numericId);
        } else {
          await gitlabService.deleteGroup(numericId);
        }
      }
    );
  };

  const handleClose = () => {
    if (sequentialOp.isRunning) return;
    sequentialOp.reset();
    setConfirmChecked(false);
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
        title="삭제 중"
        subtitle={`${selectedItems.length}개 항목을 삭제합니다`}
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
      title="일괄 삭제"
      subtitle={`${selectedItems.length}개 항목을 영구적으로 삭제합니다`}
      icon={<Warning color="error" />}
      maxWidth="md"
      actions={
        <DialogActionButtons
          onCancel={handleClose}
          onConfirm={handleDelete}
          confirmLabel="삭제"
          confirmColor="error"
          confirmIcon={<Warning />}
          disabled={!confirmChecked || selectedItems.length === 0}
        />
      }
    >
      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>주의:</strong> 이 작업은 되돌릴 수 없습니다.
          선택한 모든 항목이 영구적으로 삭제됩니다.
        </Typography>
      </Alert>

      <BulkItemList
        items={selectedItems}
        title="삭제할 항목"
        searchable={selectedItems.length > 10}
        maxHeight={300}
        showStats
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
        <Checkbox
          checked={confirmChecked}
          onChange={(e) => setConfirmChecked(e.target.checked)}
        />
        <Typography variant="body2">
          위 항목을 모두 삭제하는 것을 확인합니다.
        </Typography>
      </Box>
    </BaseBulkDialog>
  );
}
