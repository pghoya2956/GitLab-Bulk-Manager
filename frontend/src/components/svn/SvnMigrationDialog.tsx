import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  Box,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import SvnConnectionForm from './SvnConnectionForm';
import MigrationPreview from './MigrationPreview';
import AuthorsMappingEditor from './AuthorsMappingEditor';
import MigrationProgress from './MigrationProgress';
import { useSvnMigration } from '../../hooks/useSvnMigration';
interface SvnMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedGroup?: any;
  selectedProject?: any;
}

const steps = ['SVN 연결', '사용자 매핑', '미리보기'];

const SvnMigrationDialog: React.FC<SvnMigrationDialogProps> = ({
  open,
  onClose,
  selectedGroup,
  selectedProject,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [connectionData, setConnectionData] = useState<any>(null);
  const [authorsMapping, setAuthorsMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null);
  const [migrationId, setMigrationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    extractUsers,
    previewMigration,
    startMigration,
    isLoading,
    error,
  } = useSvnMigration();

  const handleNext = async () => {
    setIsProcessing(true);
    try {
      if (activeStep === 0 && connectionData) {
        // SVN 연결 후 사용자 추출
        try {
          const users = await extractUsers(connectionData.svnUrl);
          // 기본 매핑 설정 (사용자명 그대로)
          const defaultMapping: Record<string, string> = {};
          users.forEach((user: string) => {
            defaultMapping[user] = `${user} <${user}@example.com>`;
          });
          setAuthorsMapping(defaultMapping);
          setActiveStep(1);
        } catch (err) {
          console.error('Failed to extract users:', err);
        }
      } else if (activeStep === 1) {
        // 사용자 매핑 후 미리보기
        try {
          const previewData = await previewMigration({
            ...connectionData,
            authorsMapping,
          });
          setPreview(previewData);
          setActiveStep(2);
        } catch (err) {
          console.error('Failed to preview migration:', err);
        }
      } else if (activeStep === 2) {
        // 미리보기 후 마이그레이션 시작
        try {
          console.log('Migration data before sending:', {
            projectName: connectionData.projectName,
            projectPath: connectionData.projectPath,
            connectionData
          });
          
          const result = await startMigration({
            ...connectionData,
            authorsMapping,
            gitlabProjectId: connectionData.targetGroupId || selectedProject?.id || selectedGroup?.id,
            projectName: connectionData.projectName,
            projectPath: connectionData.projectPath,
          });
          setMigrationId(result.migrationId);
          
          // 백그라운드에서 실행되므로 바로 다이얼로그 닫기
          alert(`마이그레이션이 백그라운드에서 시작되었습니다.\n작업 ID: ${result.migrationId}\n\n진행 상황은 마이그레이션 모니터에서 확인하세요.`);
          onClose();
          handleReset();
        } catch (err) {
          console.error('Failed to start migration:', err);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setConnectionData(null);
    setAuthorsMapping({});
    setPreview(null);
    setMigrationId(null);
  };

  const handleClose = () => {
    onClose();
    handleReset();
  };

  const getStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <SvnConnectionForm
            onSuccess={(data) => {
              setConnectionData(data);
              // Don't automatically call handleNext here
            }}
            selectedGroup={selectedGroup}
            selectedProject={selectedProject}
          />
        );
      case 1:
        return (
          <AuthorsMappingEditor
            authorsMapping={authorsMapping}
            onChange={setAuthorsMapping}
          />
        );
      case 2:
        return (
          <MigrationPreview
            preview={preview}
            connectionData={connectionData}
            authorsMapping={authorsMapping}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        SVN to Git 마이그레이션
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {getStepContent()}
      </DialogContent>
      <DialogActions>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isLoading || isProcessing}>
            이전
          </Button>
        )}
        {activeStep === 0 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isLoading || isProcessing || !connectionData}
            startIcon={isProcessing ? <CircularProgress size={20} /> : null}
          >
            {isProcessing ? '처리 중...' : '다음'}
          </Button>
        )}
        {activeStep === 1 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              isLoading || isProcessing ||
              Object.keys(authorsMapping).length === 0
            }
            startIcon={isProcessing ? <CircularProgress size={20} /> : null}
          >
            {isProcessing ? '처리 중...' : '다음'}
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={isLoading || isProcessing || !preview}
            startIcon={isProcessing ? <CircularProgress size={20} /> : null}
          >
            {isProcessing ? '시작 중...' : '마이그레이션 시작'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SvnMigrationDialog;