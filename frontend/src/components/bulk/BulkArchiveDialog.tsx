/**
 * BulkArchiveDialog - 순차 처리 버전
 * 항목별 실시간 진행률 표시
 */

import React, { useState } from 'react';
import { Alert, Typography } from '@mui/material';
import { Archive } from '@mui/icons-material';

// Base Components
import { BaseBulkDialog } from '../common/BaseBulkDialog';
import { BulkItemList } from '../common/BulkItemList';
import { BulkProgressDialog } from '../common/BulkProgressDialog';
import { DialogActionButtons } from '../common/BulkActionButtons';

// Hooks
import { useSequentialBulkOperation } from '../../hooks/useSequentialBulkOperation';
import { ItemFilter } from '../../utils/itemFilter';
import { useHistory } from '../../store/hooks';
import { gitlabService } from '../../services/gitlab';
import { IdConverter } from '../../utils/idConverter';

interface BulkArchiveDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: (result?: any) => void;
}

export const BulkArchiveDialog: React.FC<BulkArchiveDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [showProgress, setShowProgress] = useState(false);

  // 그룹과 프로젝트 분리 (그룹은 보관 불가)
  const { groups, projects } = ItemFilter.separateByType(selectedItems);

  // Redux hooks
  const { addHistoryAction } = useHistory();

  // 순차 처리 훅
  const sequentialOp = useSequentialBulkOperation({
    delayBetweenItems: 500,
    onComplete: (result) => {
      // Add to history
      addHistoryAction({
        type: 'archive',
        description: `Archived ${result.success.length} projects`,
        items: projects,
        timestamp: new Date().toISOString(),
        undoable: true,
        undoAction: async () => {
          // Unarchive all archived projects
          for (const item of result.success) {
            const numericId = IdConverter.toNumeric(item.id);
            await gitlabService.unarchiveProject(numericId);
          }
        },
      });

      if (onSuccess) {
        onSuccess(result);
      }
    },
  });

  const handleArchive = async () => {
    if (projects.length === 0) return;

    setShowProgress(true);

    // 순차 처리 시작
    await sequentialOp.execute(
      projects.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as 'group' | 'project',
        full_path: p.full_path,
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        await gitlabService.archiveProject(numericId);
      }
    );
  };

  const handleClose = () => {
    if (sequentialOp.isRunning) return;
    sequentialOp.reset();
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
        title="프로젝트 보관 중"
        subtitle={`${projects.length}개 프로젝트를 보관합니다`}
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
      title="프로젝트 보관"
      subtitle={projects.length > 0
        ? `${projects.length}개 프로젝트를 보관합니다`
        : '보관할 프로젝트가 없습니다'
      }
      icon={<Archive color="action" />}
      maxWidth="sm"
      actions={
        projects.length > 0 && (
          <DialogActionButtons
            onCancel={handleClose}
            onConfirm={handleArchive}
            confirmLabel="보관"
            confirmColor="warning"
            confirmIcon={<Archive />}
            disabled={projects.length === 0}
          />
        )
      }
    >
      {/* 그룹 경고 */}
      {groups.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>주의:</strong> 그룹은 보관할 수 없습니다.
            선택된 {groups.length}개 그룹은 건너뛰고 프로젝트만 보관됩니다.
          </Typography>
        </Alert>
      )}

      {/* 프로젝트 없음 */}
      {projects.length === 0 && (
        <Alert severity="error">
          보관할 수 있는 프로젝트가 선택되지 않았습니다.
          프로젝트를 선택한 후 다시 시도해주세요.
        </Alert>
      )}

      {/* 보관할 프로젝트 목록 */}
      {projects.length > 0 && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              보관된 프로젝트는 읽기 전용이 되며, 리포지토리 접근은 가능하지만
              푸시나 이슈 생성 등의 작업은 불가능합니다.
            </Typography>
          </Alert>

          <BulkItemList
            items={projects}
            title={`보관할 프로젝트 (${projects.length}개)`}
            maxHeight={300}
            showStats={false}
          />
        </>
      )}
    </BaseBulkDialog>
  );
};
