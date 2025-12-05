/**
 * BulkActionCards - 액션 카드 그리드 컴포넌트
 * 카테고리별로 그룹화된 액션 카드들을 표시
 */

import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DriveFileMove as MoveIcon,
  ContentCopy as CloneIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon,
  Visibility as VisibilityIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
  Rule as RuleIcon,
  Group as GroupIcon,
  Code as CodeIcon,
  BugReport as BugReportIcon,
  Webhook as WebhookIcon,
} from '@mui/icons-material';

export interface ActionCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  category: 'resource' | 'settings' | 'advanced';
  description: string;
  implemented: boolean;
}

interface BulkActionCardsProps {
  onActionClick?: (actionId: string) => void;
  selectedCount?: number;
}

// 액션 카드 정의를 상수로 분리
export const ACTION_CARDS: ActionCard[] = [
  // Resource Management
  {
    id: 'create',
    title: '생성',
    icon: <AddIcon />,
    color: '#4CAF50',
    category: 'resource',
    description: 'YAML 기반 대량 생성',
    implemented: true,
  },
  {
    id: 'delete',
    title: '삭제',
    icon: <DeleteIcon />,
    color: '#F44336',
    category: 'resource',
    description: '선택 항목 일괄 삭제',
    implemented: true,
  },
  {
    id: 'transfer',
    title: '이동',
    icon: <MoveIcon />,
    color: '#FF9800',
    category: 'resource',
    description: '다른 그룹으로 이동',
    implemented: true,
  },
  {
    id: 'clone',
    title: '복제',
    icon: <CloneIcon />,
    color: '#9C27B0',
    category: 'resource',
    description: '구조와 설정 복제',
    implemented: true,
  },
  {
    id: 'archive',
    title: '아카이브',
    icon: <ArchiveIcon />,
    color: '#607D8B',
    category: 'resource',
    description: '프로젝트 아카이브',
    implemented: true,
  },
  {
    id: 'unarchive',
    title: '아카이브 해제',
    icon: <UnarchiveIcon />,
    color: '#795548',
    category: 'resource',
    description: '아카이브 해제',
    implemented: true,
  },
  // Settings & Configuration
  {
    id: 'settings',
    title: '설정 변경',
    icon: <VisibilityIcon />,
    color: '#2196F3',
    category: 'settings',
    description: '가시성, 설명 등',
    implemented: true,
  },
  {
    id: 'members',
    title: '멤버 관리',
    icon: <GroupIcon />,
    color: '#00BCD4',
    category: 'settings',
    description: '멤버 추가/제거/권한',
    implemented: true,
  },
  {
    id: 'protection',
    title: '보호 규칙',
    icon: <ShieldIcon />,
    color: '#FF5722',
    category: 'settings',
    description: '브랜치/태그 보호',
    implemented: false,
  },
  {
    id: 'cicd',
    title: 'CI/CD 설정',
    icon: <CodeIcon />,
    color: '#3F51B5',
    category: 'settings',
    description: '파이프라인 설정 동기화',
    implemented: true,
  },
  // Advanced Features
  {
    id: 'security',
    title: '보안 스캔',
    icon: <SecurityIcon />,
    color: '#E91E63',
    category: 'advanced',
    description: '취약점 스캔',
    implemented: false,
  },
  {
    id: 'compliance',
    title: '컴플라이언스',
    icon: <RuleIcon />,
    color: '#009688',
    category: 'advanced',
    description: '규정 준수 체크',
    implemented: false,
  },
  {
    id: 'issues',
    title: '이슈/MR',
    icon: <BugReportIcon />,
    color: '#FFC107',
    category: 'advanced',
    description: '이슈 및 MR 관리',
    implemented: true,
  },
  {
    id: 'webhooks',
    title: '웹훅',
    icon: <WebhookIcon />,
    color: '#673AB7',
    category: 'advanced',
    description: '웹훅 일괄 설정',
    implemented: false,
  },
];

const CATEGORY_TITLES = {
  resource: '리소스 관리',
  settings: '설정 및 구성',
  advanced: '고급 기능',
} as const;

export const BulkActionCards: React.FC<BulkActionCardsProps> = ({
  onActionClick,
  selectedCount = 0,
}) => {
  // 카테고리별로 카드 그룹화
  const cardsByCategory = ACTION_CARDS.reduce((acc, card) => {
    if (!acc[card.category]) acc[card.category] = [];
    acc[card.category].push(card);
    return acc;
  }, {} as Record<string, ActionCard[]>);

  const renderCard = (card: ActionCard) => (
    <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={card.id}>
      <Card
        sx={{
          height: '100%',
          opacity: card.implemented ? 1 : 0.5,
          transition: 'all 0.3s',
          '&:hover': card.implemented ? {
            transform: 'translateY(-4px)',
            boxShadow: 3,
          } : {},
        }}
      >
        <CardActionArea
          onClick={() => card.implemented && onActionClick?.(card.id)}
          disabled={!card.implemented || (selectedCount === 0 && card.id !== 'create')}
          sx={{ height: '100%' }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box
                sx={{
                  color: card.color,
                  display: 'flex',
                  alignItems: 'center',
                  mr: 2,
                }}
              >
                {card.icon}
              </Box>
              <Typography variant="h6">{card.title}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {card.description}
            </Typography>
            {!card.implemented && (
              <Chip label="준비중" size="small" sx={{ mt: 1 }} />
            )}
            {card.implemented && selectedCount === 0 && card.id !== 'create' && (
              <Chip 
                label="항목 선택 필요" 
                size="small" 
                color="warning" 
                sx={{ mt: 1 }} 
              />
            )}
          </CardContent>
        </CardActionArea>
      </Card>
    </Grid>
  );

  const renderCategory = (category: keyof typeof CATEGORY_TITLES) => {
    const cards = cardsByCategory[category];
    if (!cards || cards.length === 0) return null;

    return (
      <Box key={category} sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
          {CATEGORY_TITLES[category]}
        </Typography>
        <Grid container spacing={2}>
          {cards.map(renderCard)}
        </Grid>
      </Box>
    );
  };

  return (
    <Box>
      {Object.keys(CATEGORY_TITLES).map(category => 
        renderCategory(category as keyof typeof CATEGORY_TITLES)
      )}
    </Box>
  );
};