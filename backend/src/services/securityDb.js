import pg from 'pg';

const { Pool } = pg;

let pool = null;

/**
 * Initialize the database connection pool and create tables if needed
 */
export async function initDatabase() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://securitydb:securitydb@localhost:5432/securitydb';

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  const client = await pool.connect();
  try {
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS scan_history (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL,
        project_name VARCHAR(255) NOT NULL,
        project_path VARCHAR(500),
        gitlab_url VARCHAR(500) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'running',
        scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        trivy_version VARCHAR(50),
        semgrep_version VARCHAR(50),
        duration_seconds INTEGER,
        summary_critical INTEGER DEFAULT 0,
        summary_high INTEGER DEFAULT 0,
        summary_medium INTEGER DEFAULT 0,
        summary_low INTEGER DEFAULT 0,
        summary_info INTEGER DEFAULT 0,
        error_message TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS vulnerabilities (
        id SERIAL PRIMARY KEY,
        scan_id INTEGER NOT NULL REFERENCES scan_history(id) ON DELETE CASCADE,
        source VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT,
        file_path VARCHAR(1000),
        line_number INTEGER,
        cve VARCHAR(50),
        cwe VARCHAR(100),
        fix_suggestion TEXT,
        package_name VARCHAR(200),
        package_version VARCHAR(100),
        references_json TEXT
      )
    `);

    // Create indexes if they don't exist
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_history_project ON scan_history(project_id, gitlab_url)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_scan_history_date ON scan_history(scan_date DESC)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vulnerabilities_scan ON vulnerabilities(scan_id)
    `);

    console.log('Security database initialized (PostgreSQL)');
    return pool;
  } finally {
    client.release();
  }
}

/**
 * Get the database pool
 */
export function getDb() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Close the database connection pool
 */
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ==================== Scan History Operations ====================

/**
 * Create a new scan record
 */
export async function createScan({ projectId, projectName, projectPath, gitlabUrl }) {
  const result = await getDb().query(
    `INSERT INTO scan_history (project_id, project_name, project_path, gitlab_url, status)
     VALUES ($1, $2, $3, $4, 'running')
     RETURNING id`,
    [projectId, projectName, projectPath, gitlabUrl]
  );
  return result.rows[0].id;
}

/**
 * Update scan status to completed with results
 */
export async function completeScan({
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
  const result = await getDb().query(
    `UPDATE scan_history
     SET status = 'completed',
         trivy_version = $1,
         semgrep_version = $2,
         duration_seconds = $3,
         summary_critical = $4,
         summary_high = $5,
         summary_medium = $6,
         summary_low = $7,
         summary_info = $8
     WHERE id = $9`,
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
    ]
  );
  return result.rowCount > 0;
}

/**
 * Update scan status to failed
 */
export async function failScan(scanId, errorMessage) {
  const result = await getDb().query(
    `UPDATE scan_history SET status = 'failed', error_message = $1 WHERE id = $2`,
    [errorMessage, scanId]
  );
  return result.rowCount > 0;
}

/**
 * Get scan by ID with vulnerabilities
 */
export async function getScanById(scanId) {
  const scanResult = await getDb().query(
    'SELECT * FROM scan_history WHERE id = $1',
    [scanId]
  );

  if (scanResult.rows.length === 0) {
    return null;
  }

  const scan = scanResult.rows[0];

  const vulnResult = await getDb().query(
    `SELECT * FROM vulnerabilities WHERE scan_id = $1
     ORDER BY CASE severity
       WHEN 'CRITICAL' THEN 1
       WHEN 'HIGH' THEN 2
       WHEN 'MEDIUM' THEN 3
       WHEN 'LOW' THEN 4
       ELSE 5
     END`,
    [scanId]
  );

  return {
    scan,
    vulnerabilities: vulnResult.rows.map((v) => ({
      ...v,
      references: v.references_json ? JSON.parse(v.references_json) : [],
    })),
  };
}

/**
 * Get latest scan for a project
 */
export async function getLatestScanByProject(projectId, gitlabUrl) {
  const result = await getDb().query(
    `SELECT * FROM scan_history
     WHERE project_id = $1 AND gitlab_url = $2
     ORDER BY scan_date DESC
     LIMIT 1`,
    [projectId, gitlabUrl]
  );
  return result.rows[0] || null;
}

/**
 * Get all scans with pagination and filtering
 */
export async function getScans({ status, page = 1, limit = 20, sort = 'scan_date', order = 'DESC' }) {
  const offset = (page - 1) * limit;

  // Validate sort column to prevent SQL injection
  const allowedSorts = ['scan_date', 'project_name', 'summary_critical', 'summary_high', 'status'];
  const sortColumn = allowedSorts.includes(sort) ? sort : 'scan_date';
  const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let whereClause = '';
  let params = [];
  let paramIndex = 1;

  if (status) {
    whereClause = `WHERE status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  const countResult = await getDb().query(
    `SELECT COUNT(*) as total FROM scan_history ${whereClause}`,
    params
  );

  const dataResult = await getDb().query(
    `SELECT * FROM scan_history
     ${whereClause}
     ORDER BY ${sortColumn} ${sortOrder}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    scans: dataResult.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get scans by multiple project IDs (for tree view badges)
 */
export async function getLatestScansByProjects(projectIds, gitlabUrl) {
  if (!projectIds || projectIds.length === 0) {
    return [];
  }

  // Create parameterized placeholders
  const placeholders = projectIds.map((_, i) => `$${i + 1}`).join(',');
  const gitlabUrlParam = projectIds.length + 1;

  const result = await getDb().query(
    `SELECT sh.*
     FROM scan_history sh
     INNER JOIN (
       SELECT project_id, MAX(scan_date) as max_date
       FROM scan_history
       WHERE project_id IN (${placeholders}) AND gitlab_url = $${gitlabUrlParam}
       GROUP BY project_id
     ) latest ON sh.project_id = latest.project_id AND sh.scan_date = latest.max_date
     WHERE sh.gitlab_url = $${gitlabUrlParam + 1}`,
    [...projectIds, gitlabUrl, gitlabUrl]
  );

  return result.rows;
}

/**
 * Delete a scan and its vulnerabilities
 */
export async function deleteScan(scanId) {
  // Vulnerabilities will be cascade deleted due to foreign key constraint
  const result = await getDb().query(
    'DELETE FROM scan_history WHERE id = $1',
    [scanId]
  );
  return result.rowCount > 0;
}

// ==================== Vulnerability Operations ====================

/**
 * Insert multiple vulnerabilities for a scan
 */
export async function insertVulnerabilities(scanId, vulnerabilities) {
  if (!vulnerabilities || vulnerabilities.length === 0) {
    return 0;
  }

  const client = await getDb().connect();
  try {
    await client.query('BEGIN');

    let inserted = 0;
    for (const vuln of vulnerabilities) {
      await client.query(
        `INSERT INTO vulnerabilities (
          scan_id, source, type, severity, title, description,
          file_path, line_number, cve, cwe, fix_suggestion,
          package_name, package_version, references_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
        ]
      );
      inserted++;
    }

    await client.query('COMMIT');
    return inserted;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get vulnerabilities for a scan with optional filtering
 */
export async function getVulnerabilities(scanId, { type, severity } = {}) {
  let whereClauses = ['scan_id = $1'];
  let params = [scanId];
  let paramIndex = 2;

  if (type) {
    whereClauses.push(`type = $${paramIndex}`);
    params.push(type);
    paramIndex++;
  }

  if (severity) {
    whereClauses.push(`severity = $${paramIndex}`);
    params.push(severity);
  }

  const result = await getDb().query(
    `SELECT * FROM vulnerabilities
     WHERE ${whereClauses.join(' AND ')}
     ORDER BY CASE severity
       WHEN 'CRITICAL' THEN 1
       WHEN 'HIGH' THEN 2
       WHEN 'MEDIUM' THEN 3
       WHEN 'LOW' THEN 4
       ELSE 5
     END`,
    params
  );

  return result.rows.map((v) => ({
    ...v,
    references: v.references_json ? JSON.parse(v.references_json) : [],
  }));
}
