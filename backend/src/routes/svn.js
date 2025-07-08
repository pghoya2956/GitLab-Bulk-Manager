import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import svnMigrationService from '../services/svnMigration.js';
import jobQueueService from '../services/jobQueue.js';
import websocketService from '../services/websocket.js';
import { v4 as uuidv4 } from 'uuid';
import yaml from 'js-yaml';

const router = express.Router();

// SVN 연결 테스트
router.post('/test-connection', authenticateToken, async (req, res) => {
  try {
    const { svnUrl, svnUsername, svnPassword } = req.body;
    
    // SVN 인증 정보를 세션에 저장
    req.session.svnCredentials = req.session.svnCredentials || {};
    req.session.svnCredentials[svnUrl] = { username: svnUsername, password: svnPassword };
    
    const result = await svnMigrationService.testConnection(svnUrl, svnUsername, svnPassword);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('SVN connection test failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// SVN 사용자 목록 추출
router.get('/extract-users', authenticateToken, async (req, res) => {
  try {
    const { svnUrl } = req.query;
    const credentials = req.session.svnCredentials?.[svnUrl];
    
    if (!credentials) {
      return res.status(401).json({ success: false, error: 'SVN credentials not found in session' });
    }
    
    const users = await svnMigrationService.extractUsers(svnUrl, credentials.username, credentials.password);
    res.json({ success: true, data: users });
  } catch (error) {
    console.error('Failed to extract SVN users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 마이그레이션 미리보기
router.post('/preview', authenticateToken, async (req, res) => {
  try {
    const { svnUrl, layout, authorsMapping } = req.body;
    const credentials = req.session.svnCredentials?.[svnUrl];
    
    if (!credentials) {
      return res.status(401).json({ success: false, error: 'SVN credentials not found in session' });
    }
    
    const preview = await svnMigrationService.previewMigration(
      svnUrl, 
      credentials.username, 
      credentials.password,
      layout,
      authorsMapping
    );
    
    res.json({ success: true, data: preview });
  } catch (error) {
    console.error('Migration preview failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 단일 마이그레이션 시작
router.post('/migrate', authenticateToken, async (req, res) => {
  try {
    const {
      svnUrl,
      gitlabProjectId,
      projectName,
      projectPath,
      layout,
      authorsMapping,
      options = {},
      autoStart = false  // 기본값: false로 변경 (등록만 하고 시작하지 않음)
    } = req.body;
    
    const credentials = req.session.svnCredentials?.[svnUrl];
    if (!credentials) {
      return res.status(401).json({ success: false, error: 'SVN credentials not found in session' });
    }
    
    const migrationId = uuidv4();
    const jobData = {
      migrationId,
      svnUrl,
      svnUsername: credentials.username,
      svnPassword: credentials.password,
      gitlabProjectId,
      projectName,
      projectPath,
      layout,
      authorsMapping,
      options,
      gitlabUrl: req.session.gitlabUrl,
      gitlabToken: req.session.gitlabToken
    };
    
    if (autoStart) {
      // autoStart가 true일 때만 작업 큐에 추가
      const job = await jobQueueService.addMigrationJob(jobData);
      
      // jobId를 jobData에 추가 (metadata에 저장용)
      jobData.jobId = job.id;
      
      // WebSocket으로 시작 알림
      websocketService.emitMigrationStarted(migrationId, {
        svnUrl,
        projectName,
        jobId: job.id
      });
      
      res.json({ 
        success: true, 
        data: { 
          migrationId, 
          jobId: job.id,
          status: 'queued' 
        } 
      });
    } else {
      // autoStart가 false일 때는 DB에만 저장 (등록 상태)
      const migration = {
        id: migrationId,
        svn_url: svnUrl,
        gitlab_project_id: gitlabProjectId,
        status: 'registered',  // pending 대신 registered 사용
        layout_config: layout,
        authors_mapping: authorsMapping,
        metadata: {
          project_name: projectName,
          project_path: projectPath,
          options,
          svnUsername: credentials.username,  // 나중에 시작할 때 필요
          gitlabUrl: req.session.gitlabUrl,
          gitlabToken: req.session.gitlabToken
        }
      };
      
      const migrationService = await import('../services/svnMigration.js');
      const migrationRepository = await import('../db/migrations.js');
      await migrationRepository.default.create(migration);
      
      // WebSocket으로 등록 알림
      websocketService.emitMigrationRegistered(migrationId, {
        svnUrl,
        projectName,
        status: 'registered'
      });
      
      res.json({ 
        success: true, 
        data: { 
          migrationId,
          status: 'registered' 
        } 
      });
    }
  } catch (error) {
    console.error('Failed to start migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 대량 마이그레이션 시작
router.post('/migrate/bulk', authenticateToken, async (req, res) => {
  try {
    const { migrations } = req.body;
    const results = [];
    
    for (const migration of migrations) {
      const {
        svnUrl,
        gitlabProjectId,
        projectName,
        projectPath,
        layout,
        authorsMapping,
        options = {}
      } = migration;
      
      // SVN 인증 정보 세션에 저장 (대량 작업의 경우)
      if (migration.svnUsername && migration.svnPassword) {
        req.session.svnCredentials = req.session.svnCredentials || {};
        req.session.svnCredentials[svnUrl] = { 
          username: migration.svnUsername, 
          password: migration.svnPassword 
        };
      }
      
      const credentials = req.session.svnCredentials?.[svnUrl];
      if (!credentials) {
        results.push({
          svnUrl,
          success: false,
          error: 'SVN credentials not found'
        });
        continue;
      }
      
      const migrationId = uuidv4();
      
      // 디버깅: projectPath 확인
      console.log('Migration request data:', {
        projectName,
        projectPath,
        gitlabProjectId
      });
      
      const jobData = {
        migrationId,
        svnUrl,
        svnUsername: credentials.username,
        svnPassword: credentials.password,
        gitlabProjectId,
        projectName,
        projectPath,
        layout,
        authorsMapping,
        options,
        gitlabUrl: req.session.gitlabUrl,
        gitlabToken: req.session.gitlabToken
      };
      
      try {
        const job = await jobQueueService.addMigrationJob(jobData);
        results.push({
          svnUrl,
          projectName,
          success: true,
          migrationId,
          jobId: job.id
        });
        
        websocketService.emitMigrationStarted(migrationId, {
          svnUrl,
          projectName,
          jobId: job.id
        });
      } catch (error) {
        results.push({
          svnUrl,
          projectName,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Bulk migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 마이그레이션 목록 조회
router.get('/migrations', authenticateToken, async (req, res) => {
  try {
    const migrations = await svnMigrationService.getMigrations();
    res.json({ success: true, data: migrations });
  } catch (error) {
    console.error('Failed to get migrations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 완료된 마이그레이션 정리 (일괄 삭제)
router.post('/migrations/clean', authenticateToken, async (req, res) => {
  try {
    const { migrationIds, includeCompleted = true, includeFailed = false } = req.body;
    
    let result;
    if (migrationIds && migrationIds.length > 0) {
      // 특정 마이그레이션들 삭제
      result = await svnMigrationService.deleteMigrations(migrationIds);
    } else {
      // 상태별 일괄 삭제
      result = await svnMigrationService.cleanMigrationsByStatus({ includeCompleted, includeFailed });
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to clean migrations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 마이그레이션 상태 조회
router.get('/migrations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const migration = await svnMigrationService.getMigrationById(id);
    
    if (!migration) {
      return res.status(404).json({ success: false, error: 'Migration not found' });
    }
    
    res.json({ success: true, data: migration });
  } catch (error) {
    console.error('Failed to get migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 증분 동기화 실행
router.post('/migrations/:id/sync', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const migration = await svnMigrationService.getMigrationById(id);
    
    if (!migration) {
      return res.status(404).json({ success: false, error: 'Migration not found' });
    }
    
    const credentials = req.session.svnCredentials?.[migration.svn_url];
    if (!credentials) {
      return res.status(401).json({ success: false, error: 'SVN credentials not found in session' });
    }
    
    const jobData = {
      migrationId: id,
      type: 'sync',
      svnUrl: migration.svn_url,
      svnUsername: credentials.username,
      svnPassword: credentials.password,
      gitlabProjectId: migration.gitlab_project_id,
      lastSyncedRevision: migration.last_synced_revision,
      layoutConfig: migration.layout_config,
      authorsMapping: migration.authors_mapping,
      gitlabUrl: req.session.gitlabUrl,
      gitlabToken: req.session.gitlabToken
    };
    
    const job = await jobQueueService.addSyncJob(jobData);
    
    websocketService.emitMigrationSyncing(id, {
      lastSyncedRevision: migration.last_synced_revision
    });
    
    res.json({ 
      success: true, 
      data: { 
        jobId: job.id,
        status: 'syncing' 
      } 
    });
  } catch (error) {
    console.error('Failed to sync migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 등록된 마이그레이션 시작
router.post('/migrate/start', authenticateToken, async (req, res) => {
  try {
    const { migrationIds } = req.body;
    
    if (!migrationIds || !Array.isArray(migrationIds) || migrationIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Migration IDs are required' });
    }
    
    const migrationRepository = await import('../db/migrations.js');
    const results = { started: 0, failed: 0, errors: [] };
    
    for (const migrationId of migrationIds) {
      try {
        // 마이그레이션 정보 조회
        const migration = await migrationRepository.default.findById(migrationId);
        
        if (!migration) {
          results.failed++;
          results.errors.push({ migrationId, error: 'Migration not found' });
          continue;
        }
        
        if (migration.status !== 'registered') {
          results.failed++;
          results.errors.push({ migrationId, error: `Invalid status: ${migration.status}` });
          continue;
        }
        
        // SVN 인증 정보 복구
        const svnCredentials = req.session.svnCredentials?.[migration.svn_url];
        if (!svnCredentials && migration.metadata?.svnUsername) {
          // 메타데이터에서 복구 시도
          req.session.svnCredentials = req.session.svnCredentials || {};
          req.session.svnCredentials[migration.svn_url] = {
            username: migration.metadata.svnUsername,
            password: migration.metadata.svnPassword || ''
          };
        }
        
        // 작업 데이터 준비
        const jobData = {
          migrationId,
          svnUrl: migration.svn_url,
          svnUsername: migration.metadata?.svnUsername || svnCredentials?.username,
          svnPassword: migration.metadata?.svnPassword || svnCredentials?.password,
          gitlabProjectId: migration.gitlab_project_id,
          projectName: migration.metadata?.project_name,
          projectPath: migration.metadata?.project_path,
          layout: migration.layout_config,
          authorsMapping: migration.authors_mapping,
          options: migration.metadata?.options || {},
          gitlabUrl: migration.metadata?.gitlabUrl || req.session.gitlabUrl,
          gitlabToken: migration.metadata?.gitlabToken || req.session.gitlabToken
        };
        
        // 작업 큐에 추가
        const job = await jobQueueService.addMigrationJob(jobData);
        
        // 상태를 pending으로 업데이트
        await migrationRepository.default.update(migrationId, {
          status: 'pending',
          metadata: {
            ...migration.metadata,
            jobId: job.id
          }
        });
        
        // WebSocket으로 시작 알림
        websocketService.emitMigrationStarted(migrationId, {
          svnUrl: migration.svn_url,
          projectName: migration.metadata?.project_name,
          jobId: job.id
        });
        
        results.started++;
      } catch (error) {
        results.failed++;
        results.errors.push({ migrationId, error: error.message });
      }
    }
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Failed to start migrations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 마이그레이션 중지 (실행 중인 작업 취소)
router.post('/migrations/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 마이그레이션 정보 조회
    const migration = await svnMigrationService.getMigrationById(id);
    if (!migration) {
      return res.status(404).json({ success: false, error: 'Migration not found' });
    }
    
    // 진행 중인 작업 취소
    const cancelResult = await jobQueueService.cancelMigrationJobs(id);
    
    // git-svn 프로세스 종료
    await svnMigrationService.stopMigrationProcess(id);
    
    // 상태를 'cancelled'로 업데이트
    await svnMigrationService.updateMigrationStatus(id, 'cancelled');
    
    res.json({ 
      success: true, 
      data: {
        cancelledJobs: cancelResult.cancelledCount,
        status: 'cancelled'
      }
    });
  } catch (error) {
    console.error('Failed to stop migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 실패한 마이그레이션 재개
router.post('/migrations/:id/resume', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { resumeFrom, svnUsername, svnPassword } = req.body;
    
    // 마이그레이션 정보 조회
    const migration = await svnMigrationService.getMigrationById(id);
    if (!migration) {
      return res.status(404).json({ success: false, error: 'Migration not found' });
    }
    
    // 상태 확인 (failed 또는 cancelled만 재개 가능)
    if (migration.status !== 'failed' && migration.status !== 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot resume migration with status: ${migration.status}` 
      });
    }
    
    // SVN 인증 정보 처리
    let credentials = req.session.svnCredentials?.[migration.svn_url];
    if (!credentials && svnUsername && svnPassword) {
      // 새로운 인증 정보 저장
      req.session.svnCredentials = req.session.svnCredentials || {};
      req.session.svnCredentials[migration.svn_url] = { 
        username: svnUsername, 
        password: svnPassword 
      };
      credentials = { username: svnUsername, password: svnPassword };
    }
    
    if (!credentials) {
      return res.status(400).json({ 
        success: false, 
        error: 'SVN credentials not found. Please provide username and password.',
        needsAuth: true
      });
    }
    
    // 임시 디렉토리 유효성 검사
    const canResumeFromLast = await svnMigrationService.checkResumability(id);
    
    // resumeFrom 옵션 검증
    if (resumeFrom === 'lastRevision' && !canResumeFromLast) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot resume from last revision: temporary directory is missing or corrupted' 
      });
    }
    
    const jobData = {
      migrationId: id,
      type: resumeFrom === 'beginning' ? 'migration' : 'resume',
      resumeFrom,
      svnUrl: migration.svn_url,
      svnUsername: credentials.username,
      svnPassword: credentials.password,
      gitlabProjectId: migration.gitlab_project_id,
      projectName: migration.metadata?.project_name,
      projectPath: migration.metadata?.project_path,
      layout: migration.layout_config,
      authorsMapping: migration.authors_mapping,
      lastSyncedRevision: migration.last_synced_revision,
      gitlabUrl: req.session.gitlabUrl,
      gitlabToken: req.session.gitlabToken
    };
    
    // 작업 큐에 추가
    const job = await jobQueueService.addMigrationJob(jobData);
    
    // 상태를 'pending'으로 업데이트
    await svnMigrationService.updateMigrationStatus(id, 'pending');
    
    // WebSocket으로 재개 알림
    websocketService.emitMigrationResumed(id, {
      resumeFrom,
      jobId: job.id
    });
    
    res.json({ 
      success: true, 
      data: { 
        jobId: job.id,
        resumeFrom,
        status: 'queued' 
      } 
    });
  } catch (error) {
    console.error('Failed to resume migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 마이그레이션 취소/삭제
router.delete('/migrations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 진행 중인 작업 취소
    await jobQueueService.cancelMigrationJobs(id);
    
    // git-svn 프로세스 종료
    await svnMigrationService.stopMigrationProcess(id);
    
    // 마이그레이션 기록 삭제
    await svnMigrationService.deleteMigration(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete migration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// YAML 파싱 (대량 작업용)
router.post('/parse-yaml', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    const parsed = yaml.load(content);
    
    // 구조 검증
    if (!parsed.svn_migrations || !Array.isArray(parsed.svn_migrations)) {
      throw new Error('Invalid YAML structure. Expected "svn_migrations" array.');
    }
    
    // 각 마이그레이션 항목 검증
    const validated = parsed.svn_migrations.map((item, index) => {
      if (!item.svn_url) {
        throw new Error(`Migration ${index + 1}: svn_url is required`);
      }
      if (!item.project_name) {
        throw new Error(`Migration ${index + 1}: project_name is required`);
      }
      return item;
    });
    
    res.json({ success: true, data: validated });
  } catch (error) {
    console.error('YAML parsing failed:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// 큐 상태 조회
router.get('/queue/status', authenticateToken, async (req, res) => {
  try {
    const status = await jobQueueService.getQueueStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('Failed to get queue status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 동시 실행 수 설정
router.put('/settings/concurrent-limit', authenticateToken, async (req, res) => {
  try {
    const { limit } = req.body;
    
    if (!limit || typeof limit !== 'number' || limit < 1 || limit > 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Limit must be a number between 1 and 10' 
      });
    }
    
    // 세션에 저장
    req.session.concurrentMigrations = limit;
    
    // Bull 큐 동시 실행 수 업데이트
    await jobQueueService.updateConcurrency(limit);
    
    res.json({ 
      success: true, 
      data: { 
        limit,
        message: `Concurrent migrations limit set to ${limit}` 
      } 
    });
  } catch (error) {
    console.error('Failed to set concurrent limit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 현재 동시 실행 수 조회
router.get('/settings/concurrent-limit', authenticateToken, async (req, res) => {
  try {
    const limit = req.session.concurrentMigrations || 
                  parseInt(process.env.MAX_CONCURRENT_MIGRATIONS) || 
                  2;
    
    res.json({ 
      success: true, 
      data: { limit } 
    });
  } catch (error) {
    console.error('Failed to get concurrent limit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 실패한 작업 정리
router.post('/queue/clean-failed', authenticateToken, async (req, res) => {
  try {
    const result = await jobQueueService.cleanFailedJobs();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to clean failed jobs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 특정 작업 재시도
router.post('/queue/retry/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    const { queueType = 'migration' } = req.body;
    const result = await jobQueueService.retryJob(jobId, queueType);
    
    if (result) {
      res.json({ success: true, message: 'Job retry initiated' });
    } else {
      res.status(404).json({ success: false, error: 'Job not found or cannot be retried' });
    }
  } catch (error) {
    console.error('Failed to retry job:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;