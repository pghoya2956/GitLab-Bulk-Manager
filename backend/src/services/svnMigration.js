import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
let websocketService;

// 임시 디렉토리 경로
const TEMP_DIR = path.join(os.tmpdir(), 'gitlab-svn-migrations');

// 데이터베이스 시뮬레이션 (실제로는 DB 사용)
const migrations = new Map();
const migrationLogs = [];

class SvnMigrationService {
  constructor() {
    this.ensureTempDir();
    // WebSocket 서비스는 나중에 설정됨
    setTimeout(() => {
      import('./websocket.js').then(module => {
        websocketService = module.default;
      });
    }, 100);
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
    return new Promise((resolve, reject) => {
      const args = ['info', svnUrl];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args);
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
    return new Promise((resolve, reject) => {
      const args = ['log', svnUrl, '--quiet'];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args);
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

  // SVN 디렉토리 목록 가져오기
  async listSvnDirectory(url, username, password) {
    return new Promise((resolve, reject) => {
      const args = ['list', url];
      if (username && password) {
        args.push('--username', username, '--password', password, '--no-auth-cache');
      }
      
      const svn = spawn('svn', args);
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
      gitlabToken
    } = jobData;
    
    // 마이그레이션 레코드 생성
    const migration = {
      id: migrationId,
      svn_url: svnUrl,
      gitlab_project_id: gitlabProjectId,
      last_synced_revision: null,
      status: 'running',
      layout_config: layout,
      authors_mapping: authorsMapping,
      created_at: new Date(),
      updated_at: new Date(),
      metadata: {
        project_name: projectName,
        project_path: projectPath,
        options
      }
    };
    
    migrations.set(migrationId, migration);
    
    try {
      // 임시 디렉토리 생성
      const workDir = path.join(TEMP_DIR, migrationId);
      await fs.mkdir(workDir, { recursive: true });
      
      // authors 파일 생성
      let authorsFile = null;
      if (authorsMapping && Object.keys(authorsMapping).length > 0) {
        authorsFile = path.join(workDir, 'authors.txt');
        const authorsContent = Object.entries(authorsMapping)
          .map(([svnUser, gitUser]) => `${svnUser} = ${gitUser}`)
          .join('\n');
        await fs.writeFile(authorsFile, authorsContent);
      }
      
      // git-svn clone 실행
      const cloneResult = await this.gitSvnClone(
        svnUrl,
        svnUsername,
        svnPassword,
        workDir,
        projectPath,
        layout,
        authorsFile,
        migrationId
      );
      
      if (!cloneResult.success) {
        throw new Error(cloneResult.error);
      }
      
      // GitLab으로 푸시
      const pushResult = await this.pushToGitLab(
        path.join(workDir, projectPath),
        gitlabUrl,
        gitlabProjectId,
        gitlabToken,
        migrationId
      );
      
      if (!pushResult.success) {
        throw new Error(pushResult.error);
      }
      
      // 마지막 리비전 번호 저장
      migration.last_synced_revision = cloneResult.lastRevision;
      migration.status = 'completed';
      migration.updated_at = new Date();
      
      websocketService.emitMigrationCompleted(migrationId, {
        lastRevision: cloneResult.lastRevision,
        totalCommits: cloneResult.totalCommits
      });
      
      // 임시 디렉토리 정리 (옵션에 따라)
      if (!options.keepTempFiles) {
        await this.cleanupWorkDir(workDir);
      }
    } catch (error) {
      migration.status = 'failed';
      migration.updated_at = new Date();
      migration.metadata.error = error.message;
      
      websocketService.emitMigrationFailed(migrationId, {
        error: error.message
      });
      
      throw error;
    }
  }

  // git-svn clone 실행
  async gitSvnClone(svnUrl, username, password, workDir, projectPath, layout, authorsFile, migrationId) {
    return new Promise((resolve, reject) => {
      const args = ['svn', 'clone'];
      
      // Layout 설정
      if (layout?.trunk) args.push('-T', layout.trunk);
      if (layout?.branches) args.push('-b', layout.branches);
      if (layout?.tags) args.push('-t', layout.tags);
      
      // Authors 파일
      if (authorsFile) args.push('--authors-file=' + authorsFile);
      
      // SVN URL과 대상 디렉토리
      args.push(svnUrl, projectPath);
      
      // 환경 변수로 SVN 인증 정보 전달
      const env = { ...process.env };
      if (username && password) {
        args.push(`--username=${username}`, `--password=${password}`);
      }
      
      const git = spawn('git', args, { cwd: workDir, env });
      
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
          
          // WebSocket으로 진행 상황 전송
          if (totalCommits % 10 === 0) { // 10개마다 업데이트
            websocketService.emitMigrationProgress(migrationId, {
              currentRevision,
              totalCommits,
              message: `Processing revision ${currentRevision}`
            });
          }
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
    
    const migration = migrations.get(migrationId);
    if (!migration) {
      throw new Error('Migration not found');
    }
    
    migration.status = 'syncing';
    migration.updated_at = new Date();
    
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
        
        migration.last_synced_revision = fetchResult.lastRevision;
      }
      
      migration.status = 'completed';
      migration.updated_at = new Date();
      
      websocketService.emitMigrationSynced(migrationId, {
        newRevisions: fetchResult.newRevisions,
        lastRevision: fetchResult.lastRevision
      });
    } catch (error) {
      migration.status = 'failed';
      migration.updated_at = new Date();
      migration.metadata.lastSyncError = error.message;
      
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

  // 마이그레이션 로그 추가
  addMigrationLog(migrationId, level, message) {
    const log = {
      id: migrationLogs.length + 1,
      migration_id: migrationId,
      timestamp: new Date(),
      level,
      message
    };
    
    migrationLogs.push(log);
    
    // WebSocket으로 로그 전송
    websocketService.emitMigrationLog(migrationId, {
      level,
      message,
      timestamp: log.timestamp
    });
  }

  // 마이그레이션 목록 조회
  async getMigrations() {
    return Array.from(migrations.values())
      .sort((a, b) => b.created_at - a.created_at);
  }

  // 마이그레이션 조회
  async getMigrationById(id) {
    return migrations.get(id);
  }

  // 마이그레이션 삭제
  async deleteMigration(id) {
    const migration = migrations.get(id);
    if (migration) {
      // 작업 디렉토리 정리
      const workDir = path.join(TEMP_DIR, id);
      await this.cleanupWorkDir(workDir);
      
      // 레코드 삭제
      migrations.delete(id);
      
      // 관련 로그 삭제
      const logsToKeep = migrationLogs.filter(log => log.migration_id !== id);
      migrationLogs.length = 0;
      migrationLogs.push(...logsToKeep);
    }
  }
}

export default new SvnMigrationService();