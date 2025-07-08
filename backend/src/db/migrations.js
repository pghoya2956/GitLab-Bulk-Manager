import database from './database.js';

class MigrationRepository {
  // 마이그레이션 생성
  async create(migration) {
    const { id, svn_url, gitlab_project_id, status, layout_config, authors_mapping, metadata } = migration;
    
    const sql = `
      INSERT INTO migrations (id, svn_url, gitlab_project_id, status, layout_config, authors_mapping, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      svn_url,
      gitlab_project_id,
      status || 'pending',
      JSON.stringify(layout_config || {}),
      JSON.stringify(authors_mapping || {}),
      JSON.stringify(metadata || {})
    ];
    
    await database.run(sql, params);
    return this.findById(id);
  }

  // ID로 마이그레이션 조회
  async findById(id) {
    const sql = 'SELECT * FROM migrations WHERE id = ?';
    const row = await database.get(sql, [id]);
    return row ? this.deserializeMigration(row) : null;
  }

  // 모든 마이그레이션 조회
  async findAll() {
    const sql = 'SELECT * FROM migrations ORDER BY created_at DESC';
    const rows = await database.all(sql);
    return rows.map(row => this.deserializeMigration(row));
  }

  // 마이그레이션 업데이트
  async update(id, updates) {
    const allowedFields = ['status', 'last_synced_revision', 'layout_config', 'authors_mapping', 'metadata'];
    const updateClauses = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateClauses.push(`${key} = ?`);
        if (['layout_config', 'authors_mapping', 'metadata'].includes(key)) {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }
    
    if (updateClauses.length === 0) return null;
    
    params.push(id);
    const sql = `UPDATE migrations SET ${updateClauses.join(', ')} WHERE id = ?`;
    
    await database.run(sql, params);
    return this.findById(id);
  }

  // 마이그레이션 삭제
  async delete(id) {
    const sql = 'DELETE FROM migrations WHERE id = ?';
    const result = await database.run(sql, [id]);
    return result.changes > 0;
  }

  // 로그 추가
  async addLog(migrationId, level, message) {
    const sql = 'INSERT INTO migration_logs (migration_id, level, message) VALUES (?, ?, ?)';
    await database.run(sql, [migrationId, level, message]);
  }

  // 마이그레이션 로그 조회
  async getLogs(migrationId, limit = 100) {
    const sql = `
      SELECT * FROM migration_logs 
      WHERE migration_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;
    return database.all(sql, [migrationId, limit]);
  }

  // 작업 상태 업데이트
  async updateJobStatus(migrationId, jobId, status, progress = null) {
    // 기존 작업 찾기
    const existingSql = 'SELECT id FROM job_queue_status WHERE migration_id = ? AND job_id = ?';
    const existing = await database.get(existingSql, [migrationId, jobId]);
    
    if (existing) {
      // 업데이트
      const updateSql = progress !== null 
        ? 'UPDATE job_queue_status SET status = ?, progress = ? WHERE id = ?'
        : 'UPDATE job_queue_status SET status = ? WHERE id = ?';
      const params = progress !== null 
        ? [status, progress, existing.id]
        : [status, existing.id];
      await database.run(updateSql, params);
    } else {
      // 새로 생성
      const insertSql = 'INSERT INTO job_queue_status (migration_id, job_id, status, progress) VALUES (?, ?, ?, ?)';
      await database.run(insertSql, [migrationId, jobId, status, progress || 0]);
    }
  }

  // 작업 상태 조회
  async getJobStatus(migrationId) {
    const sql = 'SELECT * FROM job_queue_status WHERE migration_id = ? ORDER BY created_at DESC LIMIT 1';
    return database.get(sql, [migrationId]);
  }

  // 큐 상태 통계
  async getQueueStats() {
    const sql = `
      SELECT 
        status,
        COUNT(*) as count
      FROM migrations
      GROUP BY status
    `;
    
    const rows = await database.all(sql);
    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      syncing: 0
    };
    
    rows.forEach(row => {
      if (stats.hasOwnProperty(row.status)) {
        stats[row.status] = row.count;
      }
    });
    
    return stats;
  }

  // JSON 필드 역직렬화
  deserializeMigration(row) {
    if (!row) return null;
    
    return {
      ...row,
      // SQLite의 DATETIME은 UTC로 저장되므로 Z를 추가하여 명시
      created_at: row.created_at ? row.created_at + 'Z' : row.created_at,
      updated_at: row.updated_at ? row.updated_at + 'Z' : row.updated_at,
      layout_config: row.layout_config ? JSON.parse(row.layout_config) : {},
      authors_mapping: row.authors_mapping ? JSON.parse(row.authors_mapping) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {}
    };
  }
}

export default new MigrationRepository();