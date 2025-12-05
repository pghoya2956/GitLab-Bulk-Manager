/**
 * BulkProtectionDialog
 * Branch Protection Rules와 MR Approval Rules를 설정하는 다이얼로그
 */

import React, { useState } from 'react';
import {
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  TextField,
  FormControl,
  FormControlLabel,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  IconButton,
  Paper,
  Divider,
} from '@mui/material';
import {
  Security as SecurityIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Shield as ShieldIcon,
  CheckCircle as ApprovalIcon,
} from '@mui/icons-material';

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
import { ItemFilter } from '../../utils/itemFilter';

// Access Level Constants
const ACCESS_LEVELS = {
  NO_ACCESS: 0,
  DEVELOPER: 30,
  MAINTAINER: 40,
  ADMIN: 60,
};

const ACCESS_LEVEL_OPTIONS = [
  { value: ACCESS_LEVELS.NO_ACCESS, label: 'No access' },
  { value: ACCESS_LEVELS.DEVELOPER, label: 'Developers + Maintainers' },
  { value: ACCESS_LEVELS.MAINTAINER, label: 'Maintainers' },
  { value: ACCESS_LEVELS.ADMIN, label: 'Admins (GitLab self-managed only)' },
];

interface BranchRule {
  name: string;
  push_access_level: number;
  merge_access_level: number;
  unprotect_access_level: number;
  allow_force_push: boolean;
  code_owner_approval_required: boolean;
}

interface ApprovalRule {
  name: string;
  approvals_required: number;
  rule_type: 'any_approver' | 'regular';
  applies_to_all_protected_branches: boolean;
}

interface BulkProtectionDialogProps {
  open: boolean;
  onClose: () => void;
  selectedItems: Array<{
    id: string;
    name: string;
    type: 'group' | 'project';
    full_path?: string;
  }>;
  onSuccess?: (result?: unknown) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
  </div>
);

export const BulkProtectionDialog: React.FC<BulkProtectionDialogProps> = ({
  open,
  onClose,
  selectedItems,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  // Branch Protection State
  const [branchRules, setBranchRules] = useState<BranchRule[]>([
    {
      name: 'main',
      push_access_level: ACCESS_LEVELS.MAINTAINER,
      merge_access_level: ACCESS_LEVELS.MAINTAINER,
      unprotect_access_level: ACCESS_LEVELS.MAINTAINER,
      allow_force_push: false,
      code_owner_approval_required: false,
    },
  ]);
  const [deleteExistingBranches, setDeleteExistingBranches] = useState(false);

  // Approval Rules State
  const [approvalRules, setApprovalRules] = useState<ApprovalRule[]>([
    {
      name: 'Default Approval',
      approvals_required: 1,
      rule_type: 'any_approver',
      applies_to_all_protected_branches: true,
    },
  ]);
  const [deleteExistingApprovals, setDeleteExistingApprovals] = useState(false);

  // Filter projects only
  const { projects } = ItemFilter.separateByType(selectedItems);

  // Redux hooks
  const { addHistoryAction } = useHistory();

  // Sequential operation hook
  const sequentialOp = useSequentialBulkOperation({
    delayBetweenItems: 500,
    onComplete: (result) => {
      const actionType = activeTab === 0 ? 'protected-branches' : 'approval-rules';
      addHistoryAction({
        type: actionType,
        description: `${activeTab === 0 ? 'Protected branches' : 'Approval rules'} updated for ${result.success.length} projects`,
        items: projects,
        metadata: { rules: activeTab === 0 ? branchRules : approvalRules },
        timestamp: new Date().toISOString(),
        undoable: false,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    },
  });

  // Branch Rule Handlers
  const addBranchRule = () => {
    setBranchRules([
      ...branchRules,
      {
        name: '',
        push_access_level: ACCESS_LEVELS.MAINTAINER,
        merge_access_level: ACCESS_LEVELS.MAINTAINER,
        unprotect_access_level: ACCESS_LEVELS.MAINTAINER,
        allow_force_push: false,
        code_owner_approval_required: false,
      },
    ]);
  };

  const updateBranchRule = (index: number, field: keyof BranchRule, value: any) => {
    const updated = [...branchRules];
    updated[index] = { ...updated[index], [field]: value };
    setBranchRules(updated);
  };

  const removeBranchRule = (index: number) => {
    setBranchRules(branchRules.filter((_, i) => i !== index));
  };

  // Approval Rule Handlers
  const addApprovalRule = () => {
    setApprovalRules([
      ...approvalRules,
      {
        name: '',
        approvals_required: 1,
        rule_type: 'any_approver',
        applies_to_all_protected_branches: true,
      },
    ]);
  };

  const updateApprovalRule = (index: number, field: keyof ApprovalRule, value: any) => {
    const updated = [...approvalRules];
    updated[index] = { ...updated[index], [field]: value };
    setApprovalRules(updated);
  };

  const removeApprovalRule = (index: number) => {
    setApprovalRules(approvalRules.filter((_, i) => i !== index));
  };

  // Apply Branch Protection
  const handleApplyBranchProtection = async () => {
    if (projects.length === 0) return;
    if (branchRules.length === 0 || branchRules.some(r => !r.name.trim())) return;

    setShowProgress(true);

    await sequentialOp.execute(
      projects.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as 'group' | 'project',
        full_path: p.full_path || '',
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        await gitlabService.bulkSetProtectedBranches(
          [numericId],
          branchRules.map(r => ({
            name: r.name,
            push_access_level: r.push_access_level,
            merge_access_level: r.merge_access_level,
            unprotect_access_level: r.unprotect_access_level,
            allow_force_push: r.allow_force_push,
            code_owner_approval_required: r.code_owner_approval_required,
          })),
          deleteExistingBranches
        );
      }
    );
  };

  // Apply Approval Rules
  const handleApplyApprovalRules = async () => {
    if (projects.length === 0) return;
    if (approvalRules.length === 0 || approvalRules.some(r => !r.name.trim())) return;

    setShowProgress(true);

    await sequentialOp.execute(
      projects.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type as 'group' | 'project',
        full_path: p.full_path || '',
      })),
      async (item) => {
        const numericId = IdConverter.toNumeric(item.id);
        await gitlabService.bulkSetApprovalRules(
          [numericId],
          approvalRules,
          deleteExistingApprovals
        );
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

  // Validation
  const isBranchValid = branchRules.length > 0 && branchRules.every(r => r.name.trim());
  const isApprovalValid = approvalRules.length > 0 && approvalRules.every(r => r.name.trim());

  // Progress Dialog
  if (showProgress) {
    return (
      <BulkProgressDialog
        open={open}
        onClose={handleClose}
        title={activeTab === 0 ? '브랜치 보호 규칙 적용 중' : 'MR 승인 규칙 적용 중'}
        subtitle={`${projects.length}개 프로젝트에 규칙을 적용합니다`}
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
      title="보호 규칙 설정"
      subtitle={`${projects.length}개 프로젝트에 보호 규칙을 적용합니다`}
      icon={<SecurityIcon color="primary" />}
      maxWidth="md"
      actions={
        <DialogActionButtons
          onCancel={handleClose}
          onConfirm={activeTab === 0 ? handleApplyBranchProtection : handleApplyApprovalRules}
          confirmLabel="적용"
          confirmColor="primary"
          confirmIcon={<SecurityIcon />}
          disabled={
            projects.length === 0 ||
            (activeTab === 0 ? !isBranchValid : !isApprovalValid)
          }
        />
      }
    >
      {/* Warning for groups */}
      {selectedItems.some(item => item.type === 'group') && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>주의:</strong> 보호 규칙은 프로젝트에만 적용됩니다.
            선택된 그룹은 건너뜁니다.
          </Typography>
        </Alert>
      )}

      {/* No projects selected */}
      {projects.length === 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          보호 규칙을 적용할 프로젝트가 선택되지 않았습니다.
          프로젝트를 선택한 후 다시 시도해주세요.
        </Alert>
      )}

      {projects.length > 0 && (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
            <Tab icon={<ShieldIcon />} label="브랜치 보호" iconPosition="start" />
            <Tab icon={<ApprovalIcon />} label="MR 승인 규칙" iconPosition="start" />
          </Tabs>

          {/* Branch Protection Tab */}
          <TabPanel value={activeTab} index={0}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                브랜치 보호 규칙을 설정하여 특정 브랜치에 대한 푸시/머지 권한을 제어합니다.
                와일드카드 패턴(예: release/*)도 지원됩니다.
              </Typography>
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={deleteExistingBranches}
                  onChange={(e) => setDeleteExistingBranches(e.target.checked)}
                />
              }
              label="기존 보호 규칙 삭제 후 적용"
              sx={{ mb: 2 }}
            />

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  브랜치 보호 규칙
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addBranchRule}
                >
                  규칙 추가
                </Button>
              </Box>

              {branchRules.map((rule, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2">규칙 #{index + 1}</Typography>
                    {branchRules.length > 1 && (
                      <IconButton size="small" onClick={() => removeBranchRule(index)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <TextField
                    fullWidth
                    label="브랜치 이름 (와일드카드 지원)"
                    value={rule.name}
                    onChange={(e) => updateBranchRule(index, 'name', e.target.value)}
                    placeholder="예: main, develop, release/*"
                    size="small"
                    sx={{ mb: 2 }}
                    error={!rule.name.trim()}
                    helperText={!rule.name.trim() ? '브랜치 이름을 입력하세요' : ''}
                  />

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>푸시 권한</InputLabel>
                      <Select
                        value={rule.push_access_level}
                        label="푸시 권한"
                        onChange={(e) => updateBranchRule(index, 'push_access_level', e.target.value)}
                      >
                        {ACCESS_LEVEL_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>머지 권한</InputLabel>
                      <Select
                        value={rule.merge_access_level}
                        label="머지 권한"
                        onChange={(e) => updateBranchRule(index, 'merge_access_level', e.target.value)}
                      >
                        {ACCESS_LEVEL_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={rule.allow_force_push}
                          onChange={(e) => updateBranchRule(index, 'allow_force_push', e.target.checked)}
                          size="small"
                        />
                      }
                      label="Force Push 허용"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={rule.code_owner_approval_required}
                          onChange={(e) => updateBranchRule(index, 'code_owner_approval_required', e.target.checked)}
                          size="small"
                        />
                      }
                      label="코드 오너 승인 필수"
                    />
                  </Box>
                </Paper>
              ))}
            </Paper>
          </TabPanel>

          {/* Approval Rules Tab */}
          <TabPanel value={activeTab} index={1}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                MR 승인 규칙을 설정하여 Merge Request가 머지되기 전에 필요한 승인 수를 지정합니다.
                이 기능은 GitLab Premium 이상에서 전체 기능을 사용할 수 있습니다.
              </Typography>
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={deleteExistingApprovals}
                  onChange={(e) => setDeleteExistingApprovals(e.target.checked)}
                />
              }
              label="기존 승인 규칙 삭제 후 적용"
              sx={{ mb: 2 }}
            />

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  MR 승인 규칙
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={addApprovalRule}
                >
                  규칙 추가
                </Button>
              </Box>

              {approvalRules.map((rule, index) => (
                <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle2">규칙 #{index + 1}</Typography>
                    {approvalRules.length > 1 && (
                      <IconButton size="small" onClick={() => removeApprovalRule(index)} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Box>

                  <TextField
                    fullWidth
                    label="규칙 이름"
                    value={rule.name}
                    onChange={(e) => updateApprovalRule(index, 'name', e.target.value)}
                    placeholder="예: Security Review, Lead Approval"
                    size="small"
                    sx={{ mb: 2 }}
                    error={!rule.name.trim()}
                    helperText={!rule.name.trim() ? '규칙 이름을 입력하세요' : ''}
                  />

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      type="number"
                      label="필요 승인 수"
                      value={rule.approvals_required}
                      onChange={(e) => updateApprovalRule(index, 'approvals_required', parseInt(e.target.value) || 1)}
                      inputProps={{ min: 1, max: 10 }}
                      size="small"
                      sx={{ width: 150 }}
                    />

                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>규칙 유형</InputLabel>
                      <Select
                        value={rule.rule_type}
                        label="규칙 유형"
                        onChange={(e) => updateApprovalRule(index, 'rule_type', e.target.value)}
                      >
                        <MenuItem value="any_approver">모든 사용자 승인 가능</MenuItem>
                        <MenuItem value="regular">특정 사용자/그룹만</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={rule.applies_to_all_protected_branches}
                        onChange={(e) => updateApprovalRule(index, 'applies_to_all_protected_branches', e.target.checked)}
                        size="small"
                      />
                    }
                    label="모든 보호 브랜치에 적용"
                  />
                </Paper>
              ))}
            </Paper>
          </TabPanel>

          <Divider sx={{ my: 2 }} />

          {/* Selected Projects Preview */}
          <BulkItemList
            items={projects}
            title={`적용 대상 프로젝트 (${projects.length}개)`}
            maxHeight={150}
            showStats={false}
          />
        </>
      )}
    </BaseBulkDialog>
  );
};

export default BulkProtectionDialog;
