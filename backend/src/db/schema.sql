-- Security Scan Database Schema
-- SQLite database for storing security scan results

-- 스캔 이력
CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    project_name TEXT NOT NULL,
    project_path TEXT,
    gitlab_url TEXT NOT NULL,
    scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'running',  -- running, completed, failed
    error_message TEXT,
    trivy_version TEXT,
    semgrep_version TEXT,
    duration_seconds INTEGER,
    summary_critical INTEGER DEFAULT 0,
    summary_high INTEGER DEFAULT 0,
    summary_medium INTEGER DEFAULT 0,
    summary_low INTEGER DEFAULT 0,
    summary_info INTEGER DEFAULT 0
);

-- 취약점 상세
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL REFERENCES scan_history(id) ON DELETE CASCADE,
    source TEXT NOT NULL,           -- trivy, semgrep
    type TEXT NOT NULL,             -- dependency, code, secret, misconfig
    severity TEXT NOT NULL,         -- CRITICAL, HIGH, MEDIUM, LOW, INFO
    title TEXT NOT NULL,
    description TEXT,
    file_path TEXT,
    line_number INTEGER,
    cve TEXT,
    cwe TEXT,
    fix_suggestion TEXT,
    package_name TEXT,
    package_version TEXT,
    references_json TEXT            -- JSON array of URLs
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scan_project ON scan_history(project_id, gitlab_url);
CREATE INDEX IF NOT EXISTS idx_scan_date ON scan_history(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_scan_status ON scan_history(status);
CREATE INDEX IF NOT EXISTS idx_vuln_scan ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities(severity);
