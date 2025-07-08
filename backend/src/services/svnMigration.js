import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import websocketService from './websocket.js';
import database from '../db/database.js';
import migrationRepository from '../db/migrations.js';

// 임시 디렉토리 경로
const TEMP_DIR = path.join(os.tmpdir(), 'gitlab-svn-migrations');

class SvnMigrationService {
  constructor() {
    this.ensureTempDir();
    this.initDatabase();
  }

  async initDatabase() {
    try {
      await database.init();
      console.log('Database initialized for SVN migrations');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create temp directory:', error);
    }
  }

  // SVN 연결 테스트
  async testConnection(svnUrl, username, password) {
    // 개발 환경에서 mock 응답 반환
    if (process.env.NODE_ENV === 'development' && svnUrl.includes('example.com')) {
      return Promise.resolve({
        path: '.',
        working_copy_root_path: '/mock/path',
        url: svnUrl,
        relative_url: '^/repos/test-project',
        repository_root: 'https://svn.example.com/repos',
        repository_uuid: 'mock-uuid-1234',
        revision: '12345',
        node_kind: 'directory',
        last_changed_author: 'testuser',
        last_changed_rev: '12345',
        last_changed_date: new Date().toISOString()
      });
    }
    
    return new Promise((resolve, reject) => {
      const args = ['info', svnUrl];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args, {
        env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
      });
      let output = '';
      let error = '';
      
      svn.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      svn.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      svn.on('close', (code) => {
        if (code === 0) {
          // SVN info 출력 파싱
          const info = this.parseSvnInfo(output);
          resolve(info);
        } else {
          reject(new Error(`SVN connection failed: ${error || 'Unknown error'}`));
        }
      });
    });
  }

  // SVN info 출력 파싱
  parseSvnInfo(output) {
    const info = {};
    const lines = output.split('\n');
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        info[key] = match[2].trim();
      }
    });
    
    return info;
  }

  // SVN 사용자 추출
  async extractUsers(svnUrl, username, password) {
    // 개발 환경에서 mock 응답 반환
    if (process.env.NODE_ENV === 'development' && svnUrl.includes('example.com')) {
      return Promise.resolve(['testuser', 'developer1', 'developer2', 'svnuser']);
    }
    
    return new Promise((resolve, reject) => {
      const args = ['log', svnUrl, '--quiet'];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args, {
        env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
      });
      let output = '';
      let error = '';
      
      svn.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      svn.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      svn.on('close', (code) => {
        if (code === 0) {
          const users = this.parseUsersFromLog(output);
          resolve(users);
        } else {
          reject(new Error(`Failed to extract users: ${error || 'Unknown error'}`));
        }
      });
    });
  }

  // SVN 로그에서 사용자 추출
  parseUsersFromLog(output) {
    const users = new Set();
    const lines = output.split('\n');
    
    lines.forEach(line => {
      // r123 | username | 2024-01-01 12:00:00 +0000 (Mon, 01 Jan 2024) | 1 line
      const match = line.match(/^r\d+\s*\|\s*([^|]+)\s*\|/);
      if (match) {
        const username = match[1].trim();
        if (username) {
          users.add(username);
        }
      }
    });
    
    return Array.from(users).sort();
  }

  // 마이그레이션 미리보기
  async previewMigration(svnUrl, username, password, layout, authorsMapping) {
    // 개발 환경에서 mock 응답 반환
    if (process.env.NODE_ENV === 'development' && svnUrl.includes('example.com')) {
      return Promise.resolve({
        svnInfo: await this.testConnection(svnUrl, username, password),
        branches: [
          { name: 'feature/test-branch', lastCommit: '12346' },
          { name: 'feature/mock-feature', lastCommit: '12347' },
          { name: 'release/1.0', lastCommit: '12348' }
        ],
        tags: [
          { name: 'v1.0.0', revision: '12340' },
          { name: 'v1.1.0', revision: '12342' },
          { name: 'v2.0.0', revision: '12344' }
        ],
        trunk: {
          exists: true,
          lastCommit: '12349'
        },
        statistics: {
          totalCommits: 1000,
          totalFiles: 50,
          estimatedSize: '25 MB'
        },
        usersMapped: Object.keys(authorsMapping || {}).length,
        usersTotal: 4
      });
    }
    
    const preview = {
      svnInfo: await this.testConnection(svnUrl, username, password),
      branches: [],
      tags: [],
      estimatedSize: 'Unknown',
      usersMapped: Object.keys(authorsMapping || {}).length,
      usersTotal: 0
    };
    
    try {
      // 브랜치 목록 가져오기
      if (layout?.branches) {
        const branchesUrl = `${svnUrl}/${layout.branches}`;
        preview.branches = await this.listSvnDirectory(branchesUrl, username, password);
      }
      
      // 태그 목록 가져오기
      if (layout?.tags) {
        const tagsUrl = `${svnUrl}/${layout.tags}`;
        preview.tags = await this.listSvnDirectory(tagsUrl, username, password);
      }
      
      // 전체 사용자 수
      const allUsers = await this.extractUsers(svnUrl, username, password);
      preview.usersTotal = allUsers.length;
    } catch (error) {
      console.error('Preview generation error:', error);
    }
    
    return preview;
  }

  // SVN HEAD 리비전 번호 가져오기
  async getSvnHeadRevision(svnUrl, username, password) {
    return new Promise((resolve, reject) => {
      const args = ['info', svnUrl, '--non-interactive'];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svnProcess = spawn('svn', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
      });
      
      let output = '';
      let errorOutput = '';
      
      svnProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      svnProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      svnProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('SVN info error:', errorOutput);
          reject(new Error(`Failed to get SVN info: ${errorOutput || 'Unknown error'}`));
        } else {
          const revisionMatch = output.match(/Revision:\s*(\d+)/);
          if (revisionMatch) {
            resolve(parseInt(revisionMatch[1]));
          } else {
            reject(new Error('Could not extract revision number from SVN info'));
          }
        }
      });
    });
  }

  // SVN 인증 캐시 설정
  async authenticateSvn(url, username, password) {
    return new Promise((resolve, reject) => {
      // SVN info 명령으로 인증 시도 (인증 정보를 캐시에 저장)
      const args = ['info', url, '--non-interactive'];
      if (username && password) {
        args.push('--username', username, '--password', password);
        // 인증 정보를 저장하도록 설정
        args.push('--no-auth-cache'); // 보안을 위해 캐시하지 않음
      }
      
      const svn = spawn('svn', args);
      let error = '';
      
      svn.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      svn.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('SVN authentication failed: ' + error));
        }
      });
    });
  }

  // SVN 디렉토리 목록 가져오기
  async listSvnDirectory(url, username, password) {
    // 개발 환경에서 mock 응답 반환
    if (process.env.NODE_ENV === 'development' && url.includes('example.com')) {
      if (url.includes('/branches')) {
        return Promise.resolve(['feature/test-branch', 'feature/mock-feature', 'release/1.0']);
      } else if (url.includes('/tags')) {
        return Promise.resolve(['v1.0.0', 'v1.1.0', 'v2.0.0']);
      }
      return Promise.resolve([]);
    }
    
    return new Promise((resolve, reject) => {
      const args = ['list', url];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args, {
        env: { ...process.env, LANG: 'C', LC_ALL: 'C' }
      });
      let output = '';
      
      svn.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      svn.on('close', (code) => {
        if (code === 0) {
          const items = output.split('\n')
            .filter(item => item.trim())
            .map(item => item.replace(/\/$/, ''));
          resolve(items);
        } else {
          resolve([]);
        }
      });
    });
  }

  // 마이그레이션 실행 (작업 큐에서 호출)
  async executeMigration(jobData) {
    const {
      migrationId,
      svnUrl,
      svnUsername,
      svnPassword,
      gitlabProjectId,
      projectName,
      projectPath,
      layout,
      authorsMapping,
      options,
      gitlabUrl,
      gitlabToken,
      jobId
    } = jobData;
    
    // 디버깅: 받은 데이터 확인
    console.log('executeMigration received data:', {
      migrationId,
      projectName,
      projectPath,
      svnUrl,
      projectNameLength: projectName?.length,
      projectPathLength: projectPath?.length,
      projectNameType: typeof projectName,
      projectPathType: typeof projectPath
    });
    
    // 마이그레이션 레코드 생성 또는 업데이트
    // 먼저 기존 레코드가 있는지 확인
    const existingMigration = await migrationRepository.findById(migrationId);
    
    if (existingMigration) {
      // 기존 레코드가 있으면 상태만 업데이트
      await migrationRepository.update(migrationId, {
        status: 'running',
        metadata: {
          ...existingMigration.metadata,
          project_name: projectName,
          project_path: projectPath,
          options,
          jobId
        }
      });
    } else {
      // 새로운 레코드 생성
      const migration = {
        id: migrationId,
        svn_url: svnUrl,
        gitlab_project_id: gitlabProjectId,
        last_synced_revision: null,
        status: 'running',
        layout_config: layout,
        authors_mapping: authorsMapping,
        metadata: {
          project_name: projectName,
          project_path: projectPath,
          options,
          jobId
        }
      };
      
      await migrationRepository.create(migration);
    }
    
    try {
      // 전체 리비전 수 먼저 계산
      console.log('Getting SVN HEAD revision...');
      let totalRevisions = 0;
      let isEstimated = false;
      try {
        totalRevisions = await this.getSvnHeadRevision(svnUrl, svnUsername, svnPassword);
        console.log(`Total revisions in SVN: ${totalRevisions}`);
        
        // 메타데이터에 저장
        await migrationRepository.update(migrationId, {
          metadata: {
            ...existingMigration?.metadata,
            totalRevisions,
            isEstimated: false
          }
        });
        
        websocketService.emitMigrationProgress(migrationId, {
          type: 'info',
          message: `Total revisions to migrate: ${totalRevisions}`
        });
      } catch (error) {
        console.error('Failed to get total revisions:', error);
        console.warn('Will use estimation based on processed revisions');
        isEstimated = true;
        // 실패해도 계속 진행
      }
      
      // 임시 디렉토리 생성
      const workDir = path.join(TEMP_DIR, migrationId);
      await fs.mkdir(workDir, { recursive: true });
      
      // authors 파일 생성
      let authorsFile = null;
      if (authorsMapping && Object.keys(authorsMapping).length > 0) {
        authorsFile = path.join(workDir, 'authors.txt');
        
        // "(no author)" 기본 매핑 추가
        const mappingWithDefaults = {
          ...authorsMapping
        };
        
        // "(no author)"가 매핑에 없으면 기본값 추가
        if (!mappingWithDefaults['(no author)']) {
          mappingWithDefaults['(no author)'] = '(no author) <no-author@example.com>';
        }
        
        const authorsContent = Object.entries(mappingWithDefaults)
          .map(([svnUser, gitUser]) => `${svnUser} = ${gitUser}`)
          .join('\n');
        await fs.writeFile(authorsFile, authorsContent);
      }
      
      // git-svn clone 실행
      // 전체 경로를 명시적으로 생성
      console.log('Creating targetPath with:', {
        workDir,
        projectPath,
        projectPathType: typeof projectPath,
        projectPathLength: projectPath?.length
      });
      const targetPath = path.join(workDir, projectPath);
      console.log('Created targetPath:', targetPath);
      
      const cloneResult = await this.gitSvnClone(
        svnUrl,
        svnUsername,
        svnPassword,
        workDir,
        targetPath,  // 전체 경로 전달
        layout,
        authorsFile,
        migrationId
      );
      
      if (!cloneResult.success) {
        throw new Error(cloneResult.error);
      }
      
      // GitLab으로 푸시
      const pushResult = await this.pushToGitLab(
        targetPath,  // 이미 전체 경로
        gitlabUrl,
        gitlabProjectId,
        gitlabToken,
        migrationId
      );
      
      if (!pushResult.success) {
        throw new Error(pushResult.error);
      }
      
      // 마지막 리비전 번호 저장
      const migration = await migrationRepository.findById(migrationId);
      await migrationRepository.update(migrationId, {
        last_synced_revision: cloneResult.lastRevision,
        status: 'completed',
        metadata: {
          ...migration.metadata,
          totalCommits: cloneResult.totalCommits,
          lastRevision: cloneResult.lastRevision
        }
      });
      
      websocketService.emitMigrationCompleted(migrationId, {
        lastRevision: cloneResult.lastRevision,
        totalCommits: cloneResult.totalCommits
      });
      
      // 임시 디렉토리 정리 (옵션에 따라)
      if (!options.keepTempFiles) {
        await this.cleanupWorkDir(workDir);
      }
    } catch (error) {
      const migration = await migrationRepository.findById(migrationId);
      await migrationRepository.update(migrationId, {
        status: 'failed',
        metadata: {
          ...migration.metadata,
          error: error.message
        }
      });
      
      websocketService.emitMigrationFailed(migrationId, {
        error: error.message
      });
      
      throw error;
    }
  }

  // git-svn clone 실행
  async gitSvnClone(svnUrl, username, password, workDir, targetPath, layout, authorsFile, migrationId) {
    // targetPath는 이미 전체 경로임
    const repoPath = targetPath;
    await this.cleanupLockFiles(repoPath);
    
    // SVN 인증 설정
    // git-svn은 SVN의 인증 메커니즘을 사용하므로 별도 처리 불필요
    // 대부분의 공개 SVN 저장소는 익명 접근 허용
    
    // 데이터베이스에서 totalRevisions 가져오기
    const migration = await migrationRepository.findById(migrationId);
    let totalRevisions = migration?.metadata?.totalRevisions || 0;
    const isEstimated = migration?.metadata?.isEstimated || false;
    
    return new Promise((resolve, reject) => {
      const args = ['svn', 'clone'];
      
      // Layout 설정 - standard layout일 경우 -s 옵션 사용
      if (layout?.trunk === 'trunk' && layout?.branches === 'branches' && layout?.tags === 'tags') {
        args.push('-s'); // standard layout
      } else {
        // Custom layout
        if (layout?.trunk) args.push('-T', layout.trunk);
        if (layout?.branches) args.push('-b', layout.branches);
        if (layout?.tags) args.push('-t', layout.tags);
      }
      
      // Authors 파일
      if (authorsFile) args.push('--authors-file=' + authorsFile);
      
      // 진행 상황 표시를 위한 옵션
      args.push('--log-window-size=100');
      
      // SVN URL과 대상 디렉토리 (절대 경로 사용)
      args.push(svnUrl, targetPath);
      
      // 디버깅: 전체 명령어 로깅
      console.log('Git-svn clone command:', 'git', args.join(' '));
      console.log('Working directory:', workDir);
      console.log('Target path:', targetPath);
      
      // 환경 변수로 SVN 인증 정보 전달
      const env = { ...process.env };
      
      // git-svn은 작업 디렉토리를 부모 디렉토리로 설정하지 않고 직접 실행
      const git = spawn('git', args, { env });
      
      // 프로세스 등록
      this.registerProcess(migrationId, git);
      
      let lastRevision = null;
      let totalCommits = 0;
      let currentRevision = null;
      
      git.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('git-svn:', output);
        
        // 진행 상황 파싱
        const revMatch = output.match(/r(\d+)\s*=/);
        if (revMatch) {
          currentRevision = parseInt(revMatch[1]);
          lastRevision = Math.max(lastRevision || 0, currentRevision);
          totalCommits++;
          
          // totalRevisions가 없거나 추정치인 경우 업데이트
          if (isEstimated || totalRevisions === 0) {
            // 현재 리비전이 추정치보다 크면 업데이트
            if (currentRevision > totalRevisions) {
              totalRevisions = currentRevision;
              // 메타데이터 업데이트
              migrationRepository.update(migrationId, {
                metadata: {
                  ...migration?.metadata,
                  totalRevisions: currentRevision,
                  isEstimated: true
                }
              });
            }
          }
          
          // 백분율 계산 (100% 상한선 적용)
          const percentage = totalRevisions > 0 
            ? Math.min(100, Math.round((currentRevision / totalRevisions) * 100))
            : null;
          
          // WebSocket으로 진행 상황 전송 - 매 커밋마다 업데이트
          websocketService.emitMigrationProgress(migrationId, {
            currentRevision,
            totalCommits,
            totalRevisions,
            message: `리비전 ${currentRevision} / ${totalRevisions} 처리 중...`,
            percentage,
            isEstimated: isEstimated || totalRevisions === 0
          });
          
          // 10개마다 상세 로그
          if (totalCommits % 10 === 0) {
            console.log(`Migration ${migrationId}: Processed ${totalCommits} commits, current revision: ${currentRevision}`);
          }
        }
        
        // 다른 진행 상황 메시지도 파싱
        if (output.includes('Checking out')) {
          websocketService.emitMigrationProgress(migrationId, {
            currentRevision,
            totalCommits,
            totalRevisions,
            message: '파일 체크아웃 중...',
            percentage: totalRevisions > 0 ? Math.round((currentRevision / totalRevisions) * 100) : null
          });
        } else if (output.includes('Initialized empty')) {
          websocketService.emitMigrationProgress(migrationId, {
            currentRevision: 0,
            totalCommits: 0,
            totalRevisions,
            message: 'Git 저장소 초기화 중...'
          });
        }
        
        // 로그 저장
        this.addMigrationLog(migrationId, 'info', output.trim());
      });
      
      git.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('git-svn error:', error);
        this.addMigrationLog(migrationId, 'error', error.trim());
      });
      
      git.on('close', (code) => {
        // 프로세스 등록 해제
        this.unregisterProcess(migrationId);
        
        if (code === 0) {
          resolve({
            success: true,
            lastRevision,
            totalCommits
          });
        } else {
          reject({
            success: false,
            error: `git-svn clone failed with code ${code}`
          });
        }
      });
    });
  }

  // GitLab으로 푸시
  async pushToGitLab(repoPath, gitlabUrl, projectId, token, migrationId) {
    try {
      // GitLab 프로젝트 정보 가져오기
      const projectResponse = await axios.get(
        `${gitlabUrl}/api/v4/projects/${projectId}`,
        {
          headers: { 'PRIVATE-TOKEN': token }
        }
      );
      
      const project = projectResponse.data;
      const remoteUrl = project.http_url_to_repo.replace('https://', `https://oauth2:${token}@`);
      
      // Git remote 추가
      await this.runGitCommand(['remote', 'add', 'gitlab', remoteUrl], repoPath);
      
      // 모든 브랜치와 태그 푸시
      websocketService.emitMigrationLog(migrationId, 'Pushing to GitLab...');
      
      // 브랜치 푸시
      await this.runGitCommand(['push', 'gitlab', '--all'], repoPath);
      
      // 태그 푸시
      await this.runGitCommand(['push', 'gitlab', '--tags'], repoPath);
      
      return { success: true };
    } catch (error) {
      console.error('Push to GitLab failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Git 명령 실행 헬퍼
  async runGitCommand(args, cwd) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd });
      
      let output = '';
      let error = '';
      
      git.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      git.stderr.on('data', (data) => {
        error += data.toString();
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Git command failed: ${args.join(' ')}`));
        }
      });
    });
  }

  // 증분 동기화 실행
  async executeSync(jobData) {
    const {
      migrationId,
      svnUrl,
      svnUsername,
      svnPassword,
      gitlabProjectId,
      lastSyncedRevision,
      layoutConfig,
      authorsMapping,
      gitlabUrl,
      gitlabToken
    } = jobData;
    
    const migration = await migrationRepository.findById(migrationId);
    if (!migration) {
      throw new Error('Migration not found');
    }
    
    await migrationRepository.update(migrationId, {
      status: 'syncing'
    });
    
    try {
      const workDir = path.join(TEMP_DIR, migrationId);
      const repoPath = path.join(workDir, migration.metadata.project_path);
      
      // 작업 디렉토리가 존재하는지 확인
      try {
        await fs.access(repoPath);
      } catch {
        throw new Error('Local repository not found. Full migration may be required.');
      }
      
      // git-svn fetch 실행
      websocketService.emitMigrationLog(migrationId, 'Fetching new revisions from SVN...');
      
      const fetchResult = await this.gitSvnFetch(repoPath, migrationId);
      
      if (fetchResult.newRevisions > 0) {
        // git-svn rebase
        await this.runGitCommand(['svn', 'rebase'], repoPath);
        
        // GitLab으로 푸시
        const pushResult = await this.pushToGitLab(
          repoPath,
          gitlabUrl,
          gitlabProjectId,
          gitlabToken,
          migrationId
        );
        
        if (!pushResult.success) {
          throw new Error(pushResult.error);
        }
        
        await migrationRepository.update(migrationId, {
          last_synced_revision: fetchResult.lastRevision
        });
      }
      
      await migrationRepository.update(migrationId, {
        status: 'completed'
      });
      
      websocketService.emitMigrationSynced(migrationId, {
        newRevisions: fetchResult.newRevisions,
        lastRevision: fetchResult.lastRevision
      });
    } catch (error) {
      const migration = await migrationRepository.findById(migrationId);
      await migrationRepository.update(migrationId, {
        status: 'failed',
        metadata: {
          ...migration.metadata,
          lastSyncError: error.message
        }
      });
      
      websocketService.emitMigrationFailed(migrationId, {
        error: error.message,
        type: 'sync'
      });
      
      throw error;
    }
  }

  // git-svn fetch 실행
  async gitSvnFetch(repoPath, migrationId) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['svn', 'fetch'], { cwd: repoPath });
      
      let newRevisions = 0;
      let lastRevision = null;
      
      git.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('git-svn fetch:', output);
        
        const revMatch = output.match(/r(\d+)\s*=/);
        if (revMatch) {
          newRevisions++;
          lastRevision = parseInt(revMatch[1]);
          
          websocketService.emitMigrationProgress(migrationId, {
            currentRevision: lastRevision,
            message: `Fetching revision ${lastRevision}`
          });
        }
        
        this.addMigrationLog(migrationId, 'info', output.trim());
      });
      
      git.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('git-svn fetch error:', error);
        this.addMigrationLog(migrationId, 'error', error.trim());
      });
      
      git.on('close', (code) => {
        if (code === 0) {
          resolve({ newRevisions, lastRevision });
        } else {
          reject(new Error(`git-svn fetch failed with code ${code}`));
        }
      });
    });
  }

  // 작업 디렉토리 정리
  async cleanupWorkDir(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup work directory:', error);
    }
  }

  // Lock 파일 정리
  async cleanupLockFiles(repoPath) {
    try {
      // 레포지토리가 존재하는지 확인
      await fs.access(repoPath);
      
      console.log(`Cleaning up lock files in: ${repoPath}`);
      
      // 찾을 lock 파일들
      const lockFiles = [
        path.join(repoPath, '.git', 'index.lock'),
        path.join(repoPath, '.git', 'HEAD.lock'),
        path.join(repoPath, '.git', 'config.lock'),
        path.join(repoPath, '.git', 'svn', '.metadata'),
        path.join(repoPath, '.git', 'svn', '.metadata.lock')
      ];
      
      // 각 lock 파일 삭제 시도
      for (const lockFile of lockFiles) {
        try {
          await fs.unlink(lockFile);
          console.log(`Removed lock file: ${lockFile}`);
        } catch (error) {
          // 파일이 없을 수 있음 - 무시
        }
      }
      
      // svn 디렉토리 하위의 모든 lock 파일 찾기
      const svnDir = path.join(repoPath, '.git', 'svn');
      try {
        await this.removeLockFilesRecursive(svnDir);
      } catch (error) {
        // svn 디렉토리가 없을 수 있음
      }
      
      // git-svn 프로세스가 실행 중인지 확인하고 종료
      await this.killStaleGitSvnProcesses(repoPath);
      
    } catch (error) {
      console.log(`Repository does not exist yet: ${repoPath}`);
      // 레포지토리가 아직 생성되지 않았을 수 있음
    }
  }

  // 재귀적으로 lock 파일 제거
  async removeLockFilesRecursive(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.removeLockFilesRecursive(fullPath);
        } else if (entry.name.endsWith('.lock') || entry.name === '.metadata') {
          try {
            await fs.unlink(fullPath);
            console.log(`Removed lock file: ${fullPath}`);
          } catch (error) {
            console.error(`Failed to remove lock file ${fullPath}:`, error.message);
          }
        }
      }
    } catch (error) {
      // 디렉토리 읽기 실패 무시
    }
  }

  // stale git-svn 프로세스 종료
  async killStaleGitSvnProcesses(repoPath) {
    try {
      const { execSync } = await import('child_process');
      
      // git-svn 프로세스 찾기
      try {
        const psOutput = execSync(`ps aux | grep "git-svn" | grep "${repoPath}" | grep -v grep`, { encoding: 'utf-8' });
        const lines = psOutput.trim().split('\n');
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          if (pid) {
            console.log(`Killing stale git-svn process: PID ${pid}`);
            try {
              execSync(`kill -9 ${pid}`);
            } catch (error) {
              // 프로세스가 이미 종료되었을 수 있음
            }
          }
        }
      } catch (error) {
        // grep이 아무것도 찾지 못했을 때 (정상)
      }
    } catch (error) {
      console.error('Failed to check for stale processes:', error.message);
    }
  }

  // 마이그레이션 로그 추가
  async addMigrationLog(migrationId, level, message) {
    await migrationRepository.addLog(migrationId, level, message);
    
    // WebSocket으로 로그 전송
    websocketService.emitMigrationLog(migrationId, {
      level,
      message,
      timestamp: new Date()
    });
  }

  // 마이그레이션 목록 조회
  async getMigrations() {
    return migrationRepository.findAll();
  }

  // 마이그레이션 조회
  async getMigrationById(id) {
    return migrationRepository.findById(id);
  }

  // 마이그레이션 삭제
  async deleteMigration(id) {
    const migration = await migrationRepository.findById(id);
    if (migration) {
      // 작업 디렉토리 정리
      const workDir = path.join(TEMP_DIR, id);
      await this.cleanupWorkDir(workDir);
      
      // 레코드 삭제
      await migrationRepository.delete(id);
    }
  }

  // 실패한 job 상태 동기화
  async syncFailedJobStatuses(failedJobIds) {
    try {
      // 실패한 job들의 migration 상태를 failed로 업데이트
      for (const jobId of failedJobIds) {
        const migrations = await migrationRepository.findAll();
        for (const migration of migrations) {
          if (migration.metadata?.jobId === jobId && migration.status === 'running') {
            await migrationRepository.update(migration.id, {
              status: 'failed',
              metadata: {
                ...migration.metadata,
                error: 'Job stalled or failed in queue',
                failed_at: new Date().toISOString()
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync failed job statuses:', error);
    }
  }

  // 여러 마이그레이션 삭제
  async deleteMigrations(migrationIds) {
    const results = {
      deleted: [],
      failed: []
    };

    for (const id of migrationIds) {
      try {
        await this.deleteMigration(id);
        results.deleted.push(id);
      } catch (error) {
        results.failed.push({
          id,
          error: error.message
        });
      }
    }

    return results;
  }

  // 상태별 마이그레이션 정리
  async cleanMigrationsByStatus({ includeCompleted = true, includeFailed = false }) {
    const migrations = await migrationRepository.findAll();
    const toDelete = [];

    for (const migration of migrations) {
      if ((includeCompleted && migration.status === 'completed') ||
          (includeFailed && migration.status === 'failed')) {
        toDelete.push(migration.id);
      }
    }

    const results = await this.deleteMigrations(toDelete);
    
    // 통계 정보 추가
    results.stats = {
      total: toDelete.length,
      completed: migrations.filter(m => m.status === 'completed' && toDelete.includes(m.id)).length,
      failed: migrations.filter(m => m.status === 'failed' && toDelete.includes(m.id)).length
    };

    return results;
  }

  // 프로세스 등록
  registerProcess(migrationId, process) {
    if (!this.runningProcesses) {
      this.runningProcesses = new Map();
    }
    this.runningProcesses.set(migrationId, process);
  }

  // 프로세스 해제
  unregisterProcess(migrationId) {
    if (this.runningProcesses) {
      this.runningProcesses.delete(migrationId);
    }
  }

  // 마이그레이션 프로세스 중지
  async stopMigrationProcess(migrationId) {
    if (!this.runningProcesses) {
      this.runningProcesses = new Map();
    }
    
    const process = this.runningProcesses.get(migrationId);
    if (process) {
      try {
        // SIGTERM 시그널 전송
        process.kill('SIGTERM');
        console.log(`Sent SIGTERM to process for migration ${migrationId}`);
        
        // 프로세스가 종료되지 않으면 강제 종료
        setTimeout(() => {
          if (process.killed === false) {
            process.kill('SIGKILL');
            console.log(`Sent SIGKILL to process for migration ${migrationId}`);
          }
        }, 5000);
        
        this.unregisterProcess(migrationId);
      } catch (error) {
        console.error(`Failed to stop process for migration ${migrationId}:`, error);
      }
    }
  }

  // 마이그레이션 상태 업데이트
  async updateMigrationStatus(migrationId, status) {
    await migrationRepository.update(migrationId, { status });
    
    if (status === 'cancelled') {
      websocketService.emitMigrationFailed(migrationId, {
        error: 'Migration cancelled by user',
        type: 'cancelled'
      });
    }
  }

  // 재개 가능 여부 확인
  async checkResumability(migrationId) {
    const repoPath = path.join(TEMP_DIR, migrationId);
    
    try {
      // 디렉토리 존재 확인
      await fs.access(repoPath);
      
      // .git 디렉토리 존재 확인
      const gitPath = path.join(repoPath, '.git');
      await fs.access(gitPath);
      
      // git-svn 설정 확인
      const configPath = path.join(gitPath, 'config');
      const config = await fs.readFile(configPath, 'utf-8');
      
      // svn-remote 설정이 있는지 확인
      if (config.includes('[svn-remote')) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.log(`Migration ${migrationId} cannot be resumed from last revision:`, error.message);
      return false;
    }
  }

  // 마이그레이션 재개
  async resumeMigration(jobData) {
    const { migrationId, resumeFrom } = jobData;
    
    if (resumeFrom === 'beginning') {
      // 처음부터 다시 시작
      const repoPath = path.join(TEMP_DIR, migrationId);
      
      // 기존 디렉토리 삭제
      try {
        await fs.rm(repoPath, { recursive: true, force: true });
        console.log(`Cleaned up existing repository for migration ${migrationId}`);
      } catch (error) {
        console.log(`No existing repository to clean for migration ${migrationId}`);
      }
      
      // 일반 마이그레이션처럼 처리
      return this.executeMigration(jobData);
    } else {
      // lastRevision부터 이어서
      const migration = await this.getMigrationById(migrationId);
      if (!migration || !migration.last_synced_revision) {
        throw new Error('Cannot resume from last revision: no previous sync information found');
      }
      
      // 증분 동기화로 처리
      return this.executeSync({
        ...jobData,
        lastSyncedRevision: migration.last_synced_revision
      });
    }
  }

  // 마이그레이션 상태별 카운트 조회
  async getMigrationStatusCounts() {
    const migrations = await migrationRepository.findAll();
    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      syncing: 0,
      cancelled: 0,
      total: migrations.length
    };

    for (const migration of migrations) {
      if (counts.hasOwnProperty(migration.status)) {
        counts[migration.status]++;
      }
    }

    return counts;
  }

  // 큐에 없는 실패한 마이그레이션을 정리
  async cleanOrphanedFailedMigrations(activeJobMigrationIds) {
    try {
      const migrations = await migrationRepository.findAll();
      const failedMigrations = migrations.filter(m => 
        m.status === 'failed' && !activeJobMigrationIds.has(m.id)
      );

      for (const migration of failedMigrations) {
        // 큐에 없는 실패한 마이그레이션은 완전히 삭제하거나 상태를 정리
        await migrationRepository.delete(migration.id);
        console.log(`Cleaned orphaned failed migration: ${migration.id}`);
      }

      return failedMigrations.length;
    } catch (error) {
      console.error('Failed to clean orphaned migrations:', error);
      return 0;
    }
  }
}

export default new SvnMigrationService();