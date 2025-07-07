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

const steps = ['SVN 연결', '사용자 매핑', '미리보기', '마이그레이션'];

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

  const {
    extractUsers,
    previewMigration,
    startMigration,
    isLoading,
    error,
  } = useSvnMigration();

  const handleNext = async () => {
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
        const result = await startMigration({
          ...connectionData,
          authorsMapping,
          gitlabProjectId: selectedProject?.id || selectedGroup?.id,
          projectName: connectionData.projectName,
          projectPath: connectionData.projectPath,
        });
        setMigrationId(result.migrationId);
        setActiveStep(3);
      } catch (err) {
        console.error('Failed to start migration:', err);
      }
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
    if (activeStep === 3 && migrationId) {
      // 마이그레이션 진행 중에는 확인 필요
      if (window.confirm('마이그레이션이 진행 중입니다. 정말 닫으시겠습니까?')) {
        onClose();
        handleReset();
      }
    } else {
      onClose();
      handleReset();
    }
  };

  const getStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <SvnConnectionForm
            onSuccess={(data) => {
              setConnectionData(data);
              handleNext();
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
      case 3:
        return (
          <MigrationProgress
            migrationId={migrationId!}
            onComplete={() => {
              onClose();
              handleReset();
            }}
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
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={handleBack} disabled={isLoading}>
            이전
          </Button>
        )}
        {activeStep < 2 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={
              isLoading ||
              (activeStep === 0 && !connectionData) ||
              (activeStep === 1 && Object.keys(authorsMapping).length === 0)
            }
          >
            다음
          </Button>
        )}
        {activeStep === 2 && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={isLoading || !preview}
          >
            마이그레이션 시작
          </Button>
        )}
        {activeStep === 3 && (
          <Button onClick={handleClose} variant="contained">
            닫기
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SvnMigrationDialog;