/**
 * BulkCloneDialog - 순차 처리 버전
 * 항목별 실시간 진행률 표시
 */

import React, { useState } from 'react';
import {
  Alert,
  Typography,
  Box,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
} from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

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

interface BulkCloneDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path: string;
  }>;
  onSuccess?: (result?: unknown) => void;
}

export const BulkCloneDialog: React.FC<BulkCloneDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [namingOption, setNamingOption] = useState<'suffix' | 'custom'>('suffix');
  const [suffix, setSuffix] = useState('_copy');
  const [customName, setCustomName] = useState('');
  const [showProgress, setShowProgress] = useState(false);

  // Redux hooks
  const { addHistoryAction } = useHistory();

  // 순차 처리 훅
  const sequentialOp = useSequentialBulkOperation({
    delayBetweenItems: 500,
    onComplete: (result) => {
      // Add to history
      const nameModifier = namingOption === 'suffix' ? suffix : customName;
      addHistoryAction({
        type: 'clone',
        description: `Cloned ${result.success.length} items with modifier "${nameModifier}"`,
        items: selectedItems,
        metadata: { nameModifier },
        timestamp: new Date().toISOString(),
        undoable: false,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    },
  });

  const handleClone = async () => {
    if (namingOption === 'custom' && !customName.trim()) return;
    if (selectedItems.length === 0) return;

    const nameModifier = namingOption === 'suffix' ? suffix : customName;
    setShowProgress(true);

    // 순차 처리 시작
    await sequentialOp.execute(
      selectedItems.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        full_path: item.full_path,
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        if (item.type === 'project') {
          await gitlabService.cloneProject(numericId, nameModifier);
        } else {
          await gitlabService.cloneGroup(numericId, nameModifier);
        }
      }
    );
  };

  const handleClose = () => {
    if (sequentialOp.isRunning) return;
    sequentialOp.reset();
    setNamingOption('suffix');
    setSuffix('_copy');
    setCustomName('');
    setShowProgress(false);
    onClose();
  };

  const handleProgressComplete = () => {
    setShowProgress(false);
    handleClose();
  };

  // 미리보기용 이름 생성
  const getPreviewName = (itemName: string) => {
    if (namingOption === 'suffix') {
      return `${itemName}${suffix}`;
    }
    return customName || '새 이름';
  };

  // 진행 다이얼로그 표시 중이면
  if (showProgress) {
    return (
      <BulkProgressDialog
        open={open}
        onClose={handleClose}
        title="항목 복제 중"
        subtitle={`${selectedItems.length}개 항목을 복제합니다`}
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
      title="항목 복제"
      subtitle={`${selectedItems.length}개 항목을 복제합니다`}
      icon={<ContentCopy color="action" />}
      maxWidth="sm"
      actions={
        <DialogActionButtons
          onCancel={handleClose}
          onConfirm={handleClone}
          confirmLabel="복제"
          confirmColor="primary"
          confirmIcon={<ContentCopy />}
          disabled={
            selectedItems.length === 0 ||
            (namingOption === 'custom' && !customName.trim())
          }
        />
      }
    >
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          선택한 프로젝트와 그룹을 복제합니다.
          복제된 항목은 원본과 동일한 설정을 가지지만 독립적으로 관리됩니다.
        </Typography>
      </Alert>

      {/* 이름 설정 */}
      <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
        <FormLabel component="legend">복제 이름 설정</FormLabel>
        <RadioGroup
          value={namingOption}
          onChange={(e) => setNamingOption(e.target.value as 'suffix' | 'custom')}
        >
          <FormControlLabel
            value="suffix"
            control={<Radio />}
            label="접미사 추가"
          />
          {namingOption === 'suffix' && (
            <TextField
              fullWidth
              size="small"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="_copy"
              sx={{ ml: 4, mb: 1 }}
              helperText="예: project_name → project_name_copy"
            />
          )}

          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="사용자 정의 이름"
          />
          {namingOption === 'custom' && (
            <TextField
              fullWidth
              size="small"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="새 이름 입력"
              sx={{ ml: 4, mb: 1 }}
              helperText="모든 복제 항목에 이 이름이 사용됩니다"
              error={namingOption === 'custom' && !customName.trim()}
            />
          )}
        </RadioGroup>
      </FormControl>

      {/* 복제 미리보기 */}
      <BulkItemList
        items={selectedItems.map(item => ({
          ...item,
          name: (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <span>{item.name}</span>
              <span>→</span>
              <span style={{ fontWeight: 'bold' }}>
                {getPreviewName(item.name)}
              </span>
            </Box>
          ) as unknown as string
        }))}
        title="복제될 항목 목록"
        maxHeight={200}
        showStats
      />
    </BaseBulkDialog>
  );
};