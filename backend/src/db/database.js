import sqlite3 from 'sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터베이스 파일 경로
const DB_PATH = path.join(__dirname, '../../../data/migrations.db');
const DB_DIR = path.dirname(DB_PATH);

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    // 데이터 디렉토리 생성
    await fs.mkdir(DB_DIR, { recursive: true });
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('Failed to open database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  async createTables() {
    const queries = [
      // 마이그레이션 테이블
      `CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        svn_url TEXT NOT NULL,
        gitlab_project_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        last_synced_revision TEXT,
        layout_config TEXT,
        authors_mapping TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 마이그레이션 로그 테이블
      `CREATE TABLE IF NOT EXISTS migration_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
      )`,
      
      // 작업 큐 상태 테이블
      `CREATE TABLE IF NOT EXISTS job_queue_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        migration_id TEXT NOT NULL,
        job_id TEXT,
        status TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (migration_id) REFERENCES migrations(id) ON DELETE CASCADE
      )`,
      
      // 업데이트 트리거
      `CREATE TRIGGER IF NOT EXISTS update_migration_timestamp 
       AFTER UPDATE ON migrations
       BEGIN
         UPDATE migrations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`,
       
      `CREATE TRIGGER IF NOT EXISTS update_job_timestamp 
       AFTER UPDATE ON job_queue_status
       BEGIN
         UPDATE job_queue_status SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
       END`
    ];

    for (const query of queries) {
      await this.run(query);
    }
  }

  // Promise 기반 실행 메서드
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  // Promise 기반 단일 조회 메서드
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  // Promise 기반 전체 조회 메서드
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // 트랜잭션 실행
  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  // 데이터베이스 닫기
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// 싱글톤 인스턴스
const database = new Database();

export default database;