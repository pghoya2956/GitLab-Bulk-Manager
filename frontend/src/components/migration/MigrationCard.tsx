import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ArrowPathIcon,
  PauseIcon,
  InformationCircleIcon,
  XMarkIcon,
  PlayIcon,
  ArrowPathRoundedSquareIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../design-system/components';
import { Button } from '../../design-system/components';

interface MigrationCardProps {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled' | 'syncing';
  sourceUrl: string;
  targetProject: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
    isEstimated?: boolean;
  };
  startedAt: Date;
  estimatedTime?: number;
  error?: string;
  totalCommits?: number;
  lastRevision?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onDetails?: () => void;
  onSync?: () => void;
  onRetry?: () => void;
}

export const MigrationCard: React.FC<MigrationCardProps> = ({
  id,
  status,
  sourceUrl,
  targetProject,
  progress,
  startedAt,
  estimatedTime,
  error,
  totalCommits,
  lastRevision,
  onPause,
  onResume,
  onCancel,
  onDetails,
  onSync,
  onRetry,
}) => {
  const statusConfig = {
    pending: {
      icon: ArrowPathIcon,
      color: 'gray',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      iconClass: 'text-gray-400',
      label: '대기 중',
    },
    running: {
      icon: ArrowPathIcon,
      color: 'blue',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      iconClass: 'text-blue-400 animate-spin',
      label: '진행 중',
    },
    syncing: {
      icon: ArrowPathRoundedSquareIcon,
      color: 'purple',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      iconClass: 'text-purple-400 animate-spin',
      label: '동기화 중',
    },
    completed: {
      icon: CheckCircleIcon,
      color: 'green',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      iconClass: 'text-green-400',
      label: '완료',
    },
    failed: {
      icon: XCircleIcon,
      color: 'red',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      iconClass: 'text-red-400',
      label: '실패',
    },
    paused: {
      icon: PauseIcon,
      color: 'yellow',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      iconClass: 'text-yellow-400',
      label: '일시정지',
    },
    cancelled: {
      icon: XMarkIcon,
      color: 'orange',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      iconClass: 'text-orange-400',
      label: '취소됨',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const getSourceName = (url: string) => {
    const parts = url.split('/');
    return parts[parts.length - 1] || url;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card 
        variant="gradient" 
        hoverable={false}
        className={`border ${config.borderColor} hover:shadow-glow transition-all duration-300`}
      >
        <CardHeader
          action={
            <div className="flex items-center space-x-2">
              {status === 'running' && onPause && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPause}
                  leftIcon={<PauseIcon className="w-4 h-4" />}
                />
              )}
              {(status === 'paused' || status === 'cancelled') && onResume && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onResume}
                  leftIcon={<PlayIcon className="w-4 h-4" />}
                />
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onDetails}
                leftIcon={<InformationCircleIcon className="w-4 h-4" />}
              />
              {(status === 'running' || status === 'paused') && onCancel && (
                <Button
                  variant="danger"
                  size="icon"
                  onClick={onCancel}
                  leftIcon={<XMarkIcon className="w-4 h-4" />}
                />
              )}
            </div>
          }
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <StatusIcon className={`w-6 h-6 ${config.iconClass}`} />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate">
                {targetProject}
              </CardTitle>
              <p className="text-sm text-gray-400 truncate">
                {getSourceName(sourceUrl)}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {/* Progress section */}
          {(status === 'running' || status === 'paused' || status === 'syncing') && progress && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">
                  {progress.current.toLocaleString()} / {progress.total.toLocaleString()} 커밋
                  {progress.isEstimated && ' (추정)'}
                </span>
                <span className="text-sm font-semibold text-white">
                  {progress.percentage}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="relative h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                />
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              </div>
            </div>
          )}

          {/* Completion info */}
          {status === 'completed' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">총 커밋</span>
                <span className="text-white font-medium">{totalCommits?.toLocaleString() || '-'}</span>
              </div>
              {lastRevision && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">최종 리비전</span>
                  <span className="text-white font-medium">r{lastRevision}</span>
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {status === 'failed' && error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </CardBody>

        <CardFooter>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {formatDistanceToNow(startedAt, { locale: ko, addSuffix: true })} 시작
            </span>
            {estimatedTime && status === 'running' && (
              <span className="text-gray-400">
                약 {Math.round(estimatedTime)}분 남음
              </span>
            )}
            {status === 'completed' && onSync && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSync}
                leftIcon={<ArrowPathRoundedSquareIcon className="w-4 h-4" />}
              >
                동기화
              </Button>
            )}
            {(status === 'failed' || status === 'cancelled') && onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                leftIcon={<ArrowPathIcon className="w-4 h-4" />}
              >
                재시도
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};