import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowPathIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon,
  PlusIcon,
  ArrowPathRoundedSquareIcon,
  TrashIcon,
  FunnelIcon,
  ChevronDownIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';
import { gitlabService } from '../services/gitlab';
import { StatsCard, Button, Card } from '../design-system/components';
import { MigrationCard } from '../components/migration/MigrationCard';
import MigrationProgress from '../components/svn/MigrationProgress';
import ResumeMigrationDialog from '../components/svn/ResumeMigrationDialog';

interface Migration {
  id: string;
  svn_url: string;
  gitlab_project_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'syncing' | 'cancelled';
  created_at: string;
  updated_at: string;
  last_synced_revision?: string;
  metadata?: {
    project_name?: string;
    project_path?: string;
    error?: string;
    jobId?: string;
    totalCommits?: number;
    lastRevision?: string;
    currentRevision?: number;
    totalRevisions?: number;
    percentage?: number;
    isEstimated?: boolean;
  };
  job?: {
    progress?: number;
  };
}

const MigrationMonitorNew: React.FC = () => {
  const navigate = useNavigate();
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [selectedMigrationForResume, setSelectedMigrationForResume] = useState<Migration | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadMigrations = async () => {
    setLoading(true);
    try {
      const [migrationsData, queueData] = await Promise.all([
        gitlabService.getMigrations(),
        gitlabService.getJobQueueStatus(),
      ]);
      setMigrations(migrationsData);
      setQueueStatus(queueData);
    } catch (error) {
      console.error('Failed to load migrations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMigrations();
    const interval = setInterval(loadMigrations, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (migrationId: string) => {
    if (window.confirm('이 마이그레이션을 삭제하시겠습니까?')) {
      try {
        await gitlabService.deleteMigration(migrationId);
        await loadMigrations();
      } catch (error) {
        console.error('Failed to delete migration:', error);
      }
    }
  };

  const handleSync = async (migrationId: string) => {
    try {
      await gitlabService.syncMigration(migrationId);
      await loadMigrations();
    } catch (error) {
      console.error('Failed to sync migration:', error);
    }
  };

  const handleStop = async (migrationId: string) => {
    if (window.confirm('실행 중인 마이그레이션을 중지하시겠습니까?')) {
      try {
        await gitlabService.stopMigration(migrationId);
        await loadMigrations();
      } catch (error) {
        console.error('Failed to stop migration:', error);
      }
    }
  };

  const handleShowDetails = (migrationId: string) => {
    setSelectedMigration(migrationId);
    setDetailsOpen(true);
  };

  const handleResume = (migration: Migration) => {
    setSelectedMigrationForResume(migration);
    setResumeDialogOpen(true);
  };

  const handleResumeComplete = () => {
    setResumeDialogOpen(false);
    setSelectedMigrationForResume(null);
    loadMigrations();
  };

  // Calculate stats
  const stats = {
    active: migrations.filter(m => m.status === 'running' || m.status === 'syncing').length,
    completed: migrations.filter(m => m.status === 'completed').length,
    failed: migrations.filter(m => m.status === 'failed').length,
    pending: migrations.filter(m => m.status === 'pending').length,
  };

  const previousStats = {
    active: 1,
    completed: 42,
    failed: 3,
    pending: 2,
  };

  // Filter migrations
  const filteredMigrations = migrations.filter(m => {
    if (filterStatus === 'all') return true;
    return m.status === filterStatus;
  });

  // Sort migrations: active first, then by date
  const sortedMigrations = [...filteredMigrations].sort((a, b) => {
    const statusOrder = { running: 0, syncing: 1, pending: 2, failed: 3, cancelled: 4, completed: 5 };
    const aOrder = statusOrder[a.status] ?? 99;
    const bOrder = statusOrder[b.status] ?? 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="px-6 py-8 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 gradient-text">
              Migration Monitor
            </h1>
            <p className="text-gray-400">
              SVN에서 GitLab으로의 마이그레이션을 추적하고 관리합니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              leftIcon={<PlusIcon className="w-5 h-5" />}
              onClick={() => navigate('/groups-projects')}
            >
              새 마이그레이션
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadMigrations}
              disabled={loading}
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="진행 중"
            value={stats.active}
            change={{ 
              value: stats.active - previousStats.active, 
              trend: stats.active >= previousStats.active ? 'up' : 'down' 
            }}
            icon={<ArrowPathIcon className="w-5 h-5" />}
            color="blue"
          />
          <StatsCard
            title="완료됨"
            value={stats.completed}
            change={{ 
              value: stats.completed - previousStats.completed, 
              trend: stats.completed >= previousStats.completed ? 'up' : 'down' 
            }}
            icon={<CheckCircleIcon className="w-5 h-5" />}
            color="green"
          />
          <StatsCard
            title="실패"
            value={stats.failed}
            change={{ 
              value: Math.abs(stats.failed - previousStats.failed), 
              trend: stats.failed > previousStats.failed ? 'up' : 'down' 
            }}
            icon={<XCircleIcon className="w-5 h-5" />}
            color="red"
          />
          <StatsCard
            title="대기 중"
            value={stats.pending}
            change={{ 
              value: Math.abs(stats.pending - previousStats.pending), 
              trend: stats.pending > previousStats.pending ? 'up' : 'down' 
            }}
            icon={<ClockIcon className="w-5 h-5" />}
            color="orange"
          />
        </div>

        {/* Queue Status */}
        {queueStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-8"
          >
            <Card variant="glass">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">작업 큐 상태</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">실시간 업데이트</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">{queueStatus.migration.waiting}</div>
                  <div className="text-sm text-gray-400">대기 중</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{queueStatus.migration.active}</div>
                  <div className="text-sm text-gray-400">처리 중</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{queueStatus.migration.completed}</div>
                  <div className="text-sm text-gray-400">완료</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{queueStatus.migration.failed}</div>
                  <div className="text-sm text-gray-400">실패</div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Filters and View Mode */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant={filterStatus === 'all' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              전체 ({migrations.length})
            </Button>
            <Button
              variant={filterStatus === 'running' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('running')}
            >
              진행 중 ({stats.active})
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              완료 ({stats.completed})
            </Button>
            <Button
              variant={filterStatus === 'failed' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilterStatus('failed')}
            >
              실패 ({stats.failed})
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <Squares2X2Icon className="w-5 h-5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <ListBulletIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Migrations Grid/List */}
        {sortedMigrations.length === 0 ? (
          <Card variant="glass" className="text-center py-12">
            <p className="text-gray-400 mb-4">
              {filterStatus === 'all' 
                ? '진행 중인 마이그레이션이 없습니다.' 
                : `${filterStatus} 상태의 마이그레이션이 없습니다.`}
            </p>
            <Button
              variant="primary"
              leftIcon={<PlusIcon className="w-5 h-5" />}
              onClick={() => navigate('/groups-projects')}
            >
              첫 마이그레이션 시작하기
            </Button>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className={viewMode === 'grid' 
              ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' 
              : 'space-y-4'
            }
          >
            {sortedMigrations.map((migration, index) => (
              <motion.div
                key={migration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <MigrationCard
                  id={migration.id}
                  status={migration.status}
                  sourceUrl={migration.svn_url}
                  targetProject={migration.metadata?.project_name || `Project ${migration.gitlab_project_id}`}
                  progress={
                    (migration.status === 'running' || migration.status === 'syncing') && migration.metadata
                      ? {
                          current: migration.metadata.currentRevision || 0,
                          total: migration.metadata.totalRevisions || 0,
                          percentage: migration.metadata.percentage || 0,
                          isEstimated: migration.metadata.isEstimated,
                        }
                      : undefined
                  }
                  startedAt={new Date(migration.created_at)}
                  estimatedTime={migration.metadata?.totalRevisions 
                    ? Math.round((migration.metadata.totalRevisions - (migration.metadata.currentRevision || 0)) / 60)
                    : undefined
                  }
                  error={migration.metadata?.error}
                  totalCommits={migration.metadata?.totalCommits}
                  lastRevision={migration.metadata?.lastRevision || migration.last_synced_revision}
                  onPause={() => handleStop(migration.id)}
                  onCancel={() => handleDelete(migration.id)}
                  onDetails={() => handleShowDetails(migration.id)}
                  onSync={() => handleSync(migration.id)}
                  onRetry={() => handleResume(migration)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="fixed bottom-6 right-6">
            <div className="bg-gray-800 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-gray-300">업데이트 중...</span>
            </div>
          </div>
        )}
      </div>

      {/* Details Dialog */}
      {detailsOpen && selectedMigration && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
          >
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-semibold">마이그레이션 상세 정보</h2>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
              <MigrationProgress
                migrationId={selectedMigration}
                onComplete={() => {
                  setDetailsOpen(false);
                  loadMigrations();
                }}
              />
            </div>
            <div className="p-6 border-t border-gray-700">
              <Button variant="ghost" onClick={() => setDetailsOpen(false)}>
                닫기
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Resume Dialog */}
      {selectedMigrationForResume && (
        <ResumeMigrationDialog
          open={resumeDialogOpen}
          onClose={() => setResumeDialogOpen(false)}
          migration={selectedMigrationForResume}
          onResume={handleResumeComplete}
        />
      )}
    </div>
  );
};

export default MigrationMonitorNew;