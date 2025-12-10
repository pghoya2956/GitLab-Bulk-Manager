import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'db', 'security.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

let db = null;

/**
 * Initialize the database connection and create tables if needed
 * Note: This uses SQLite's db.exec for schema initialization, not child_process
 */
export function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }

      // Enable foreign keys
      db.run('PRAGMA foreign_keys = ON', (pragmaErr) => {
        if (pragmaErr) {
          console.warn('Failed to enable foreign keys:', pragmaErr);
        }

        // Read and run schema using SQLite's exec method (not child_process)
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        db.exec(schema, (schemaErr) => {
          if (schemaErr) {
            reject(schemaErr);
            return;
          }
          console.log('Security database initialized at:', DB_PATH);
          resolve(db);
        });
      });
    });
  });
}

/**
 * Get the database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        db = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// ==================== Scan History Operations ====================

/**
 * Create a new scan record
 */
export function createScan({ projectId, projectName, projectPath, gitlabUrl }) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO scan_history (project_id, project_name, project_path, gitlab_url, status)
      VALUES (?, ?, ?, ?, 'running')
    `;
    getDb().run(sql, [projectId, projectName, projectPath, gitlabUrl], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.lastID);
    });
  });
}

/**
 * Update scan status to completed with results
 */
export function completeScan({
  scanId,
  trivyVersion,
  semgrepVersion,
  durationSeconds,
  summaryCritical,
  summaryHigh,
  summaryMedium,
  summaryLow,
  summaryInfo,
}) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE scan_history
      SET status = 'completed',
          trivy_version = ?,
          semgrep_version = ?,
          duration_seconds = ?,
          summary_critical = ?,
          summary_high = ?,
          summary_medium = ?,
          summary_low = ?,
          summary_info = ?
      WHERE id = ?
    `;
    getDb().run(
      sql,
      [
        trivyVersion,
        semgrepVersion,
        durationSeconds,
        summaryCritical,
        summaryHigh,
        summaryMedium,
        summaryLow,
        summaryInfo,
        scanId,
      ],
      function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes > 0);
      }
    );
  });
}

/**
 * Update scan status to failed
 */
export function failScan(scanId, errorMessage) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE scan_history
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `;
    getDb().run(sql, [errorMessage, scanId], function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this.changes > 0);
    });
  });
}

/**
 * Get scan by ID with vulnerabilities
 */
export function getScanById(scanId) {
  return new Promise((resolve, reject) => {
    const scanSql = 'SELECT * FROM scan_history WHERE id = ?';
    getDb().get(scanSql, [scanId], (err, scan) => {
      if (err) {
        reject(err);
        return;
      }
      if (!scan) {
        resolve(null);
        return;
      }

      const vulnSql = 'SELECT * FROM vulnerabilities WHERE scan_id = ? ORDER BY CASE severity WHEN \'CRITICAL\' THEN 1 WHEN \'HIGH\' THEN 2 WHEN \'MEDIUM\' THEN 3 WHEN \'LOW\' THEN 4 ELSE 5 END';
      getDb().all(vulnSql, [scanId], (vulnErr, vulnerabilities) => {
        if (vulnErr) {
          reject(vulnErr);
          return;
        }
        resolve({
          scan,
          vulnerabilities: vulnerabilities.map((v) => ({
            ...v,
            references: v.references_json ? JSON.parse(v.references_json) : [],
          })),
        });
      });
    });
  });
}

/**
 * Get latest scan for a project
 */
export function getLatestScanByProject(projectId, gitlabUrl) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT * FROM scan_history
      WHERE project_id = ? AND gitlab_url = ?
      ORDER BY scan_date DESC
      LIMIT 1
    `;
    getDb().get(sql, [projectId, gitlabUrl], (err, scan) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(scan || null);
    });
  });
}

/**
 * Get all scans with pagination and filtering
 */
export function getScans({ status, page = 1, limit = 20, sort = 'scan_date', order = 'DESC' }) {
  return new Promise((resolve, reject) => {
    const offset = (page - 1) * limit;

    // Validate sort column to prevent SQL injection
    const allowedSorts = ['scan_date', 'project_name', 'summary_critical', 'summary_high', 'status'];
    const sortColumn = allowedSorts.includes(sort) ? sort : 'scan_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let whereClauses = [];
    let params = [];

    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }

    const whereStr = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as total FROM scan_history ${whereStr}`;
    const dataSql = `
      SELECT * FROM scan_history
      ${whereStr}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    getDb().get(countSql, params, (countErr, countResult) => {
      if (countErr) {
        reject(countErr);
        return;
      }

      getDb().all(dataSql, [...params, limit, offset], (dataErr, scans) => {
        if (dataErr) {
          reject(dataErr);
          return;
        }
        resolve({
          scans,
          total: countResult.total,
          page,
          limit,
          totalPages: Math.ceil(countResult.total / limit),
        });
      });
    });
  });
}

/**
 * Get scans by multiple project IDs (for tree view badges)
 */
export function getLatestScansByProjects(projectIds, gitlabUrl) {
  return new Promise((resolve, reject) => {
    if (!projectIds || projectIds.length === 0) {
      resolve([]);
      return;
    }

    const placeholders = projectIds.map(() => '?').join(',');
    const sql = `
      SELECT sh.*
      FROM scan_history sh
      INNER JOIN (
        SELECT project_id, MAX(scan_date) as max_date
        FROM scan_history
        WHERE project_id IN (${placeholders}) AND gitlab_url = ?
        GROUP BY project_id
      ) latest ON sh.project_id = latest.project_id AND sh.scan_date = latest.max_date
      WHERE sh.gitlab_url = ?
    `;

    getDb().all(sql, [...projectIds, gitlabUrl, gitlabUrl], (err, scans) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(scans);
    });
  });
}

/**
 * Delete a scan and its vulnerabilities
 */
export function deleteScan(scanId) {
  return new Promise((resolve, reject) => {
    // First delete vulnerabilities (should cascade, but being explicit)
    const deleteVulnSql = 'DELETE FROM vulnerabilities WHERE scan_id = ?';
    getDb().run(deleteVulnSql, [scanId], (vulnErr) => {
      if (vulnErr) {
        reject(vulnErr);
        return;
      }

      const deleteScanSql = 'DELETE FROM scan_history WHERE id = ?';
      getDb().run(deleteScanSql, [scanId], function (scanErr) {
        if (scanErr) {
          reject(scanErr);
          return;
        }
        resolve(this.changes > 0);
      });
    });
  });
}

// ==================== Vulnerability Operations ====================

/**
 * Insert multiple vulnerabilities for a scan
 */
export function insertVulnerabilities(scanId, vulnerabilities) {
  return new Promise((resolve, reject) => {
    if (!vulnerabilities || vulnerabilities.length === 0) {
      resolve(0);
      return;
    }

    const sql = `
      INSERT INTO vulnerabilities (
        scan_id, source, type, severity, title, description,
        file_path, line_number, cve, cwe, fix_suggestion,
        package_name, package_version, references_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const stmt = getDb().prepare(sql);
    let inserted = 0;
    let errors = [];

    vulnerabilities.forEach((vuln) => {
      stmt.run(
        [
          scanId,
          vuln.source,
          vuln.type,
          vuln.severity,
          vuln.title,
          vuln.description || null,
          vuln.filePath || null,
          vuln.lineNumber || null,
          vuln.cve || null,
          vuln.cwe || null,
          vuln.fixSuggestion || null,
          vuln.packageName || null,
          vuln.packageVersion || null,
          vuln.references ? JSON.stringify(vuln.references) : null,
        ],
        (err) => {
          if (err) {
            errors.push(err);
          } else {
            inserted++;
          }
        }
      );
    });

    stmt.finalize((finalizeErr) => {
      if (finalizeErr || errors.length > 0) {
        reject(finalizeErr || errors[0]);
        return;
      }
      resolve(inserted);
    });
  });
}

/**
 * Get vulnerabilities for a scan with optional filtering
 */
export function getVulnerabilities(scanId, { type, severity } = {}) {
  return new Promise((resolve, reject) => {
    let whereClauses = ['scan_id = ?'];
    let params = [scanId];

    if (type) {
      whereClauses.push('type = ?');
      params.push(type);
    }

    if (severity) {
      whereClauses.push('severity = ?');
      params.push(severity);
    }

    const sql = `
      SELECT * FROM vulnerabilities
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        WHEN 'LOW' THEN 4
        ELSE 5
      END
    `;

    getDb().all(sql, params, (err, vulnerabilities) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(
        vulnerabilities.map((v) => ({
          ...v,
          references: v.references_json ? JSON.parse(v.references_json) : [],
        }))
      );
    });
  });
}
