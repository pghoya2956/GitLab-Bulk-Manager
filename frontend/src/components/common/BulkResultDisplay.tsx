/**
 * BulkResultDisplay - 대량 작업 결과 표시 컴포넌트
 * 성공/실패 아이템 목록, 통계, 상태 메시지 표시
 */

import React from 'react';
import {
  Box,
  Alert,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  ExpandMore,
} from '@mui/icons-material';
import { BulkOperationResult } from '../../utils/responseParser';

export interface BulkResultDisplayProps {
  result: BulkOperationResult;
  loading?: boolean;
  showDetails?: boolean;
  maxItemsBeforeCollapse?: number;
  customMessages?: {
    success?: string;
    partial?: string;
    error?: string;
    empty?: string;
  };
  renderItem?: (item: any, type: 'success' | 'failed' | 'skipped') => React.ReactNode;
}

export const BulkResultDisplay: React.FC<BulkResultDisplayProps> = ({
  result,
  loading = false,
  showDetails = true,
  maxItemsBeforeCollapse = 5,
  customMessages = {},
  renderItem,
}) => {
  const getSeverity = (): 'success' | 'warning' | 'error' | 'info' => {
    if (result.allSuccessful) return 'success';
    if (result.hasErrors && result.success.length === 0) return 'error';
    if (result.hasErrors) return 'warning';
    return 'info';
  };

  const getMessage = (): string => {
    if (result.allSuccessful) {
      return customMessages.success || '모든 작업이 성공적으로 완료되었습니다.';
    }
    if (result.hasErrors && result.success.length === 0) {
      return customMessages.error || '모든 작업이 실패했습니다.';
    }
    if (result.hasErrors) {
      return customMessages.partial || '일부 작업이 실패했습니다.';
    }
    return customMessages.empty || '처리된 항목이 없습니다.';
  };


  const renderItemDefault = (item: any, type: 'success' | 'failed' | 'skipped') => {
    const icon = type === 'success' ? (
      <CheckCircle color="success" />
    ) : type === 'failed' ? (
      <Error color="error" />
    ) : (
      <Warning color="warning" />
    );

    return (
      <ListItem key={`${item.type}-${item.id}`}>
        <ListItemIcon>{icon}</ListItemIcon>
        <ListItemText
          primary={item.name || item.id}
          secondary={
            type === 'failed' && item.error
              ? item.error
              : item.type
              ? `${item.type === 'group' ? '그룹' : '프로젝트'}`
              : undefined
          }
        />
      </ListItem>
    );
  };

  const renderList = (
    items: any[],
    type: 'success' | 'failed' | 'skipped',
    title: string,
    color: 'success' | 'error' | 'warning'
  ) => {
    if (items.length === 0) return null;

    const content = (
      <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
        {items.map((item) =>
          renderItem ? renderItem(item, type) : renderItemDefault(item, type)
        )}
      </List>
    );

    if (items.length > maxItemsBeforeCollapse) {
      return (
        <Accordion defaultExpanded={type === 'failed'}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" color={`${color}.main`}>
                {title}
              </Typography>
              <Chip label={items.length} size="small" color={color} />
            </Box>
          </AccordionSummary>
          <AccordionDetails>{content}</AccordionDetails>
        </Accordion>
      );
    }

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="subtitle2" color={`${color}.main`}>
            {title}
          </Typography>
          <Chip label={items.length} size="small" color={color} />
        </Box>
        {content}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="body2" gutterBottom>
          처리 중...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* 요약 알림 */}
      <Alert severity={getSeverity()} sx={{ mb: 2 }}>
        <Typography variant="subtitle2">{getMessage()}</Typography>
        <Typography variant="body2">
          전체: {result.total}개 | 성공: {result.summary.successCount}개 | 실패:{' '}
          {result.summary.failedCount}개
          {result.summary.skippedCount > 0 && ` | 건너뜀: ${result.summary.skippedCount}개`}
        </Typography>
      </Alert>

      {/* 상세 결과 */}
      {showDetails && (
        <Box>
          {renderList(result.success, 'success', '성공한 항목', 'success')}
          {renderList(result.failed, 'failed', '실패한 항목', 'error')}
          {renderList(result.skipped, 'skipped', '건너뛴 항목', 'warning')}
        </Box>
      )}
    </Box>
  );
};

/**
 * 간단한 결과 요약 카드
 */
export interface ResultSummaryCardProps {
  title: string;
  count: number;
  total: number;
  color?: 'success' | 'error' | 'warning' | 'info';
  icon?: React.ReactNode;
}

export const ResultSummaryCard: React.FC<ResultSummaryCardProps> = ({
  title,
  count,
  total,
  color = 'info',
  icon,
}) => {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <Paper
      sx={{
        p: 2,
        borderLeft: 4,
        borderLeftColor: `${color}.main`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon && <Box sx={{ color: `${color}.main` }}>{icon}</Box>}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h6">
            {count} / {total}
          </Typography>
        </Box>
        <Chip label={`${percentage}%`} color={color} size="small" />
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ mt: 1, height: 4, borderRadius: 2 }}
      />
    </Paper>
  );
};

export default BulkResultDisplay;