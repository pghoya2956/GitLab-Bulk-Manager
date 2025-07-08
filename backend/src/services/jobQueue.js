import Bull from 'bull';
import svnMigrationService from './svnMigration.js';

// Redis 연결 설정 (환경 변수에서 읽기)
const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
  }
};

// 큐 생성
const migrationQueue = new Bull('svn-migration-queue', redisConfig);
const syncQueue = new Bull('svn-sync-queue', redisConfig);

// 동시 작업 수 제한
const CONCURRENT_MIGRATIONS = parseInt(process.env.MAX_CONCURRENT_MIGRATIONS) || 2;
const CONCURRENT_SYNCS = parseInt(process.env.MAX_CONCURRENT_SYNCS) || 3;

class JobQueueService {
  constructor() {
    this.setupQueues();
  }

  setupQueues() {
    // 마이그레이션 큐 프로세서
    migrationQueue.process(CONCURRENT_MIGRATIONS, async (job) => {
      console.log(`Processing migration job ${job.id} for ${job.data.svnUrl}`);
      
      try {
        if (job.data.type === 'resume') {
          await svnMigrationService.resumeMigration(job.data);
        } else {
          await svnMigrationService.executeMigration(job.data);
        }
        return { success: true, migrationId: job.data.migrationId };
      } catch (error) {
        console.error(`Migration job ${job.id} failed:`, error);
        throw error;
      }
    });

    // 동기화 큐 프로세서
    syncQueue.process(CONCURRENT_SYNCS, async (job) => {
      console.log(`Processing sync job ${job.id} for migration ${job.data.migrationId}`);
      
      try {
        await svnMigrationService.executeSync(job.data);
        return { success: true, migrationId: job.data.migrationId };
      } catch (error) {
        console.error(`Sync job ${job.id} failed:`, error);
        throw error;
      }
    });

    // 이벤트 리스너
    this.setupEventListeners(migrationQueue, 'migration');
    this.setupEventListeners(syncQueue, 'sync');
  }

  setupEventListeners(queue, type) {
    queue.on('completed', (job, result) => {
      console.log(`${type} job ${job.id} completed:`, result);
    });

    queue.on('failed', (job, err) => {
      console.error(`${type} job ${job.id} failed:`, err.message);
    });

    queue.on('stalled', (job) => {
      console.warn(`${type} job ${job.id} stalled`);
    });

    queue.on('progress', (job, progress) => {
      console.log(`${type} job ${job.id} progress:`, progress);
    });
  }

  // 마이그레이션 작업 추가
  async addMigrationJob(data) {
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000
      },
      removeOnComplete: false,
      removeOnFail: false
    };

    const job = await migrationQueue.add(data, jobOptions);
    console.log(`Added migration job ${job.id} for ${data.svnUrl}`);
    return job;
  }

  // 동기화 작업 추가
  async addSyncJob(data) {
    const jobOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000
      },
      removeOnComplete: false,
      removeOnFail: false
    };

    const job = await syncQueue.add(data, jobOptions);
    console.log(`Added sync job ${job.id} for migration ${data.migrationId}`);
    return job;
  }

  // 작업 취소
  async cancelMigrationJobs(migrationId) {
    let cancelledCount = 0;
    
    // 대기 중인 작업 찾기
    const waitingJobs = await migrationQueue.getWaiting();
    const activeJobs = await migrationQueue.getActive();
    
    const jobsToCancel = [...waitingJobs, ...activeJobs].filter(
      job => job.data.migrationId === migrationId
    );

    for (const job of jobsToCancel) {
      try {
        await job.remove();
        cancelledCount++;
        console.log(`Cancelled job ${job.id} for migration ${migrationId}`);
      } catch (error) {
        console.error(`Failed to cancel job ${job.id}:`, error);
      }
    }

    // 동기화 작업도 취소
    const syncWaitingJobs = await syncQueue.getWaiting();
    const syncActiveJobs = await syncQueue.getActive();
    
    const syncJobsToCancel = [...syncWaitingJobs, ...syncActiveJobs].filter(
      job => job.data.migrationId === migrationId
    );

    for (const job of syncJobsToCancel) {
      try {
        await job.remove();
        cancelledCount++;
        console.log(`Cancelled sync job ${job.id} for migration ${migrationId}`);
      } catch (error) {
        console.error(`Failed to cancel sync job ${job.id}:`, error);
      }
    }
    
    return { cancelledCount };
  }

  // 큐 상태 조회
  async getQueueStatus() {
    const [
      migrationWaiting,
      migrationActive,
      migrationCompleted,
      migrationFailed,
      syncWaiting,
      syncActive,
      syncCompleted,
      syncFailed
    ] = await Promise.all([
      migrationQueue.getWaitingCount(),
      migrationQueue.getActiveCount(),
      migrationQueue.getCompletedCount(),
      migrationQueue.getFailedCount(),
      syncQueue.getWaitingCount(),
      syncQueue.getActiveCount(),
      syncQueue.getCompletedCount(),
      syncQueue.getFailedCount()
    ]);

    // 실제 마이그레이션 테이블의 상태도 확인
    const migrationStatuses = await svnMigrationService.getMigrationStatusCounts();

    return {
      migration: {
        waiting: migrationWaiting,
        active: migrationActive,
        completed: migrationCompleted,
        failed: migrationFailed,
        // 실제 테이블의 실패 수와 동기화
        actualFailed: migrationStatuses.failed || 0
      },
      sync: {
        waiting: syncWaiting,
        active: syncActive,
        completed: syncCompleted,
        failed: syncFailed
      },
      // 마이그레이션 테이블 상태 요약
      migrationTable: migrationStatuses
    };
  }

  // 작업 조회
  async getJob(jobId, queueType = 'migration') {
    const queue = queueType === 'migration' ? migrationQueue : syncQueue;
    return await queue.getJob(jobId);
  }

  // 작업 재시도
  async retryJob(jobId, queueType = 'migration') {
    const job = await this.getJob(jobId, queueType);
    if (job && job.failedReason) {
      await job.retry();
      return true;
    }
    return false;
  }

  // 큐 정리
  async cleanQueues() {
    // 완료된 작업 정리 (7일 이상 된 것)
    const grace = 7 * 24 * 60 * 60 * 1000; // 7 days
    await migrationQueue.clean(grace, 'completed');
    await migrationQueue.clean(grace, 'failed');
    await syncQueue.clean(grace, 'completed');
    await syncQueue.clean(grace, 'failed');
  }

  // 실패한 작업 즉시 정리
  async cleanFailedJobs() {
    const migrationFailed = await migrationQueue.getFailedCount();
    const syncFailed = await syncQueue.getFailedCount();
    
    // 실패한 작업들의 ID 수집
    const failedMigrationJobs = await migrationQueue.getFailed();
    const failedSyncJobs = await syncQueue.getFailed();
    const failedJobIds = [
      ...failedMigrationJobs.map(job => job.id),
      ...failedSyncJobs.map(job => job.id)
    ];
    
    // 실패한 작업들 즉시 정리 (grace period 0)
    await migrationQueue.clean(0, 'failed');
    await syncQueue.clean(0, 'failed');
    
    // stalled 작업들도 정리
    const stalledMigration = await migrationQueue.getStalledCount();
    const stalledSync = await syncQueue.getStalledCount();
    
    await migrationQueue.clean(0, 'stalled');
    await syncQueue.clean(0, 'stalled');
    
    // 데이터베이스 상태 동기화
    if (failedJobIds.length > 0) {
      await svnMigrationService.syncFailedJobStatuses(failedJobIds);
    }
    
    return {
      cleaned: {
        migration: {
          failed: migrationFailed,
          stalled: stalledMigration
        },
        sync: {
          failed: syncFailed,
          stalled: stalledSync
        }
      }
    };
  }

  // 큐 종료 (graceful shutdown)
  async close() {
    await migrationQueue.close();
    await syncQueue.close();
  }
}

// 메모리 내 큐 구현 (Redis가 없을 경우 폴백)
class InMemoryJobQueue {
  constructor() {
    this.jobs = new Map();
    this.jobCounter = 0;
    this.processing = new Set();
  }

  async addMigrationJob(data) {
    const job = {
      id: ++this.jobCounter,
      data,
      status: 'waiting',
      createdAt: new Date()
    };
    
    this.jobs.set(job.id, job);
    
    // 비동기로 처리 시작
    setTimeout(() => this.processJob(job), 100);
    
    return job;
  }

  async addSyncJob(data) {
    return this.addMigrationJob({ ...data, type: 'sync' });
  }

  async processJob(job) {
    if (this.processing.has(job.id)) return;
    
    this.processing.add(job.id);
    job.status = 'active';
    
    try {
      if (job.data.type === 'sync') {
        await svnMigrationService.executeSync(job.data);
      } else if (job.data.type === 'resume') {
        await svnMigrationService.resumeMigration(job.data);
      } else {
        await svnMigrationService.executeMigration(job.data);
      }
      
      job.status = 'completed';
      job.completedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.failedReason = error.message;
      job.failedAt = new Date();
    } finally {
      this.processing.delete(job.id);
    }
  }

  async cancelMigrationJobs(migrationId) {
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.data.migrationId === migrationId && 
          (job.status === 'waiting' || job.status === 'active')) {
        job.status = 'cancelled';
        this.processing.delete(jobId);
      }
    }
  }

  async getQueueStatus() {
    const jobs = Array.from(this.jobs.values());
    
    const count = (status) => jobs.filter(j => j.status === status).length;
    
    return {
      migration: {
        waiting: count('waiting'),
        active: count('active'),
        completed: count('completed'),
        failed: count('failed')
      },
      sync: { waiting: 0, active: 0, completed: 0, failed: 0 }
    };
  }

  async getJob(jobId) {
    return this.jobs.get(parseInt(jobId));
  }

  async retryJob(jobId) {
    const job = this.jobs.get(parseInt(jobId));
    if (job && job.status === 'failed') {
      job.status = 'waiting';
      delete job.failedReason;
      delete job.failedAt;
      setTimeout(() => this.processJob(job), 100);
      return true;
    }
    return false;
  }

  async cleanQueues() {
    // 메모리 내 구현에서는 오래된 작업 정리
    const grace = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') &&
          (now - job.createdAt.getTime() > grace)) {
        this.jobs.delete(jobId);
      }
    }
  }

  async cleanFailedJobs() {
    let failedCount = 0;
    let stalledCount = 0;
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'failed') {
        this.jobs.delete(jobId);
        failedCount++;
      } else if (job.status === 'stalled') {
        this.jobs.delete(jobId);
        stalledCount++;
      }
    }
    
    return {
      cleaned: {
        migration: {
          failed: failedCount,
          stalled: stalledCount
        },
        sync: {
          failed: 0,
          stalled: 0
        }
      }
    };
  }

  async close() {
    // 메모리 내 구현에서는 특별히 할 일 없음
  }
}

// Redis 사용 가능 여부에 따라 적절한 구현 선택
let jobQueueService;

try {
  // Bull/Redis 사용 시도
  jobQueueService = new JobQueueService();
  console.log('Using Redis-based job queue');
} catch (error) {
  console.warn('Redis not available, using in-memory job queue:', error.message);
  jobQueueService = new InMemoryJobQueue();
}

export default jobQueueService;