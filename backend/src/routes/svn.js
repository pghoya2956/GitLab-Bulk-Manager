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
      options = {}
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
    
    // 작업 큐에 추가
    const job = await jobQueueService.addMigrationJob(jobData);
    
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

// 마이그레이션 취소/삭제
router.delete('/migrations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 진행 중인 작업 취소
    await jobQueueService.cancelMigrationJobs(id);
    
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

export default router;