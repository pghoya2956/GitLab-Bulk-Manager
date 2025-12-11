import axios from 'axios';

// Types
export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info?: number;
}

export interface ScanHistory {
  id: number;
  project_id: number;
  project_name: string;
  project_path: string | null;
  gitlab_url: string;
  scan_date: string;
  status: 'running' | 'completed' | 'failed';
  error_message: string | null;
  trivy_version: string | null;
  semgrep_version: string | null;
  duration_seconds: number | null;
  summary_critical: number;
  summary_high: number;
  summary_medium: number;
  summary_low: number;
  summary_info: number;
}

export interface Vulnerability {
  id: number;
  scan_id: number;
  source: 'trivy' | 'semgrep';
  type: 'dependency' | 'code' | 'secret' | 'misconfig';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string | null;
  file_path: string | null;
  line_number: number | null;
  cve: string | null;
  cwe: string | null;
  fix_suggestion: string | null;
  package_name: string | null;
  package_version: string | null;
  references: string[];
}

export interface ScanResult {
  scanId: number | null;
  projectId: number;
  projectName: string;
  status: 'completed' | 'failed';
  summary?: ScanSummary;
  totalVulnerabilities?: number;
  durationSeconds?: number;
  error?: string;
}

export interface ScanToolStatus {
  trivy: {
    available: boolean;
    version: string | null;
  };
  semgrep: {
    available: boolean;
    version: string | null;
  };
  ready: boolean;
  runningScans: number;
  maxConcurrentScans: number;
}

export interface ProjectScanBadge {
  scanId: number;
  status: string;
  scanDate: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// API Functions

/**
 * Check scanning tools availability
 */
export async function getScanningStatus(): Promise<ScanToolStatus> {
  const response = await axios.get('/api/security/status');
  return response.data;
}

/**
 * Start security scan for selected projects
 */
export async function startSecurityScan(
  projects: Array<{ id: number; name: string; path_with_namespace?: string }>
): Promise<{
  message: string;
  results: ScanResult[];
  summary: { total: number; successful: number; failed: number };
}> {
  const response = await axios.post('/api/security/scan', { projects });
  return response.data;
}

/**
 * Get list of all scans with pagination and filtering
 */
export async function getScans(params?: {
  status?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'ASC' | 'DESC';
}): Promise<{
  scans: ScanHistory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const response = await axios.get('/api/security/scans', { params });
  return response.data;
}

/**
 * Get scan details with vulnerabilities
 */
export async function getScanById(scanId: number): Promise<{
  scan: ScanHistory;
  vulnerabilities: Vulnerability[];
}> {
  const response = await axios.get(`/api/security/scans/${scanId}`);
  return response.data;
}

/**
 * Get latest scan for a specific project
 */
export async function getLatestProjectScan(
  projectId: number
): Promise<{ scan: ScanHistory | null }> {
  const response = await axios.get(`/api/security/projects/${projectId}/latest`);
  return response.data;
}

/**
 * Get latest scans for multiple projects (for tree view badges)
 */
export async function getBatchProjectScans(
  projectIds: number[]
): Promise<{ scans: Record<number, ProjectScanBadge> }> {
  const response = await axios.post('/api/security/projects/batch', { projectIds });
  return response.data;
}

/**
 * Delete a scan
 */
export async function deleteScan(
  scanId: number
): Promise<{ success: boolean; message: string }> {
  const response = await axios.delete(`/api/security/scans/${scanId}`);
  return response.data;
}

// Helper functions

/**
 * Get badge color based on severity counts
 */
export function getBadgeColor(scan: ScanHistory | ProjectScanBadge): 'error' | 'warning' | 'success' | 'default' {
  const critical = 'summary_critical' in scan ? scan.summary_critical : scan.critical;
  const high = 'summary_high' in scan ? scan.summary_high : scan.high;
  const medium = 'summary_medium' in scan ? scan.summary_medium : scan.medium;
  const low = 'summary_low' in scan ? scan.summary_low : scan.low;

  if (critical > 0 || high > 0) return 'error';
  if (medium > 0) return 'warning';
  if (low > 0) return 'warning';
  return 'success';
}

/**
 * Get total vulnerability count
 */
export function getTotalVulnerabilities(scan: ScanHistory | ProjectScanBadge): number {
  if ('summary_critical' in scan) {
    return (
      scan.summary_critical +
      scan.summary_high +
      scan.summary_medium +
      scan.summary_low +
      (scan.summary_info || 0)
    );
  }
  return scan.critical + scan.high + scan.medium + scan.low;
}

/**
 * Format scan date
 */
export function formatScanDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString('ko-KR');
}

/**
 * Get severity color
 */
export function getSeverityColor(
  severity: string
): 'error' | 'warning' | 'info' | 'default' {
  switch (severity.toUpperCase()) {
    case 'CRITICAL':
      return 'error';
    case 'HIGH':
      return 'error';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Get vulnerability type label
 */
export function getVulnerabilityTypeLabel(type: string): string {
  switch (type) {
    case 'dependency':
      return '의존성';
    case 'code':
      return '코드';
    case 'secret':
      return '시크릿';
    case 'misconfig':
      return '설정';
    default:
      return type;
  }
}

// ==================== GitLab Security Report Format ====================
// https://gitlab.com/gitlab-org/security-products/security-report-schemas

/**
 * GitLab Security Report Types
 */
export interface GitLabSecurityReport {
  version: string;
  schema?: string;
  scan: GitLabScan;
  vulnerabilities: GitLabVulnerability[];
  remediations?: GitLabRemediation[];
}

export interface GitLabScan {
  analyzer: GitLabAnalyzer;
  scanner: GitLabScanner;
  type: 'sast' | 'dependency_scanning' | 'secret_detection' | 'container_scanning';
  start_time: string;
  end_time: string;
  status: 'success' | 'failure';
}

export interface GitLabAnalyzer {
  id: string;
  name: string;
  version: string;
  vendor: { name: string };
  url?: string;
}

export interface GitLabScanner {
  id: string;
  name: string;
  version: string;
  vendor: { name: string };
  url?: string;
}

export interface GitLabVulnerability {
  id: string;
  category: 'sast' | 'dependency_scanning' | 'secret_detection';
  name: string;
  message: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info' | 'Unknown';
  confidence?: 'High' | 'Medium' | 'Low' | 'Unknown';
  solution?: string;
  scanner: { id: string; name: string };
  identifiers: GitLabIdentifier[];
  links?: Array<{ name?: string; url: string }>;
  location: GitLabLocation;
  raw_source_code_extract?: string;
}

export interface GitLabIdentifier {
  type: string;
  name: string;
  value: string;
  url?: string;
}

export interface GitLabLocation {
  file: string;
  start_line?: number;
  end_line?: number;
  class?: string;
  method?: string;
  // For dependency scanning
  dependency?: {
    package: { name: string };
    version: string;
  };
}

export interface GitLabRemediation {
  fixes: Array<{ id: string }>;
  summary: string;
  diff: string;
}

/**
 * Generate a UUID v4 for GitLab vulnerability ID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Map internal severity to GitLab severity format
 */
function mapSeverity(severity: string): GitLabVulnerability['severity'] {
  const severityMap: Record<string, GitLabVulnerability['severity']> = {
    'CRITICAL': 'Critical',
    'HIGH': 'High',
    'MEDIUM': 'Medium',
    'LOW': 'Low',
    'INFO': 'Info',
  };
  return severityMap[severity.toUpperCase()] || 'Unknown';
}

/**
 * Extract filename from full path
 */
function extractFilename(fullPath: string | null): string {
  if (!fullPath) return 'unknown';
  // Remove temp directory prefix if present
  const match = fullPath.match(/[^/]+\/([^/]+)$/);
  if (match) return match[1];
  // Fallback: get last path segment
  const segments = fullPath.split('/');
  return segments[segments.length - 1] || 'unknown';
}

/**
 * Convert internal scan data to GitLab SAST Report format
 */
export function convertToGitLabSASTReport(
  scan: ScanHistory,
  vulnerabilities: Vulnerability[]
): GitLabSecurityReport {
  const startTime = new Date(scan.scan_date);
  const endTime = new Date(startTime.getTime() + (scan.duration_seconds || 0) * 1000);

  // Filter SAST-type vulnerabilities (code, misconfig)
  const sastVulns = vulnerabilities.filter(v => v.type === 'code' || v.type === 'misconfig');

  return {
    version: '15.0.0',
    schema: 'https://gitlab.com/gitlab-org/security-products/security-report-schemas/-/raw/v15.0.0/dist/sast-report-format.json',
    scan: {
      analyzer: {
        id: 'gitlab-bulk-manager',
        name: 'GitLab Bulk Manager Security Scanner',
        version: '1.0.0',
        vendor: { name: 'GitLab Bulk Manager' },
      },
      scanner: {
        id: scan.semgrep_version ? 'semgrep' : 'trivy',
        name: scan.semgrep_version ? 'Semgrep' : 'Trivy',
        version: scan.semgrep_version || scan.trivy_version || 'unknown',
        vendor: { name: scan.semgrep_version ? 'Semgrep Inc.' : 'Aqua Security' },
      },
      type: 'sast',
      start_time: startTime.toISOString().replace('Z', ''),
      end_time: endTime.toISOString().replace('Z', ''),
      status: scan.status === 'completed' ? 'success' : 'failure',
    },
    vulnerabilities: sastVulns.map(vuln => ({
      id: generateUUID(),
      category: 'sast',
      name: vuln.title.substring(0, 255),
      message: `${vuln.title} in ${extractFilename(vuln.file_path)}`,
      description: vuln.description || vuln.title,
      severity: mapSeverity(vuln.severity),
      scanner: {
        id: vuln.source,
        name: vuln.source === 'semgrep' ? 'Semgrep' : 'Trivy',
      },
      identifiers: [
        ...(vuln.cwe ? [{
          type: 'cwe',
          name: `CWE-${vuln.cwe.replace(/CWE-/i, '')}`,
          value: vuln.cwe.replace(/CWE-/i, ''),
          url: `https://cwe.mitre.org/data/definitions/${vuln.cwe.replace(/CWE-/i, '')}.html`,
        }] : []),
        {
          type: 'semgrep_id',
          name: vuln.title,
          value: vuln.title,
        },
      ],
      links: vuln.references.map(ref => ({ url: ref })),
      location: {
        file: extractFilename(vuln.file_path),
        start_line: vuln.line_number || undefined,
      },
      solution: vuln.fix_suggestion || undefined,
    })),
  };
}

/**
 * Convert internal scan data to GitLab Dependency Scanning Report format
 */
export function convertToGitLabDependencyReport(
  scan: ScanHistory,
  vulnerabilities: Vulnerability[]
): GitLabSecurityReport {
  const startTime = new Date(scan.scan_date);
  const endTime = new Date(startTime.getTime() + (scan.duration_seconds || 0) * 1000);

  // Filter dependency-type vulnerabilities
  const depVulns = vulnerabilities.filter(v => v.type === 'dependency');

  return {
    version: '15.0.0',
    schema: 'https://gitlab.com/gitlab-org/security-products/security-report-schemas/-/raw/v15.0.0/dist/dependency-scanning-report-format.json',
    scan: {
      analyzer: {
        id: 'gitlab-bulk-manager',
        name: 'GitLab Bulk Manager Security Scanner',
        version: '1.0.0',
        vendor: { name: 'GitLab Bulk Manager' },
      },
      scanner: {
        id: 'trivy',
        name: 'Trivy',
        version: scan.trivy_version || 'unknown',
        vendor: { name: 'Aqua Security' },
        url: 'https://github.com/aquasecurity/trivy',
      },
      type: 'dependency_scanning',
      start_time: startTime.toISOString().replace('Z', ''),
      end_time: endTime.toISOString().replace('Z', ''),
      status: scan.status === 'completed' ? 'success' : 'failure',
    },
    vulnerabilities: depVulns.map(vuln => ({
      id: generateUUID(),
      category: 'dependency_scanning',
      name: vuln.cve || vuln.title.substring(0, 255),
      message: `${vuln.title} in ${vuln.package_name || 'unknown package'}`,
      description: vuln.description || vuln.title,
      severity: mapSeverity(vuln.severity),
      scanner: {
        id: 'trivy',
        name: 'Trivy',
      },
      identifiers: [
        ...(vuln.cve ? [{
          type: 'cve',
          name: vuln.cve,
          value: vuln.cve,
          url: `https://nvd.nist.gov/vuln/detail/${vuln.cve}`,
        }] : []),
        ...(vuln.cwe ? [{
          type: 'cwe',
          name: `CWE-${vuln.cwe.replace(/CWE-/i, '')}`,
          value: vuln.cwe.replace(/CWE-/i, ''),
          url: `https://cwe.mitre.org/data/definitions/${vuln.cwe.replace(/CWE-/i, '')}.html`,
        }] : []),
      ],
      links: vuln.references.map(ref => ({ url: ref })),
      location: {
        file: extractFilename(vuln.file_path),
        dependency: vuln.package_name ? {
          package: { name: vuln.package_name },
          version: vuln.package_version || 'unknown',
        } : undefined,
      },
      solution: vuln.fix_suggestion || undefined,
    })),
  };
}

/**
 * Convert internal scan data to GitLab Secret Detection Report format
 */
export function convertToGitLabSecretReport(
  scan: ScanHistory,
  vulnerabilities: Vulnerability[]
): GitLabSecurityReport {
  const startTime = new Date(scan.scan_date);
  const endTime = new Date(startTime.getTime() + (scan.duration_seconds || 0) * 1000);

  // Filter secret-type vulnerabilities
  const secretVulns = vulnerabilities.filter(v => v.type === 'secret');

  return {
    version: '15.0.0',
    schema: 'https://gitlab.com/gitlab-org/security-products/security-report-schemas/-/raw/v15.0.0/dist/secret-detection-report-format.json',
    scan: {
      analyzer: {
        id: 'gitlab-bulk-manager',
        name: 'GitLab Bulk Manager Security Scanner',
        version: '1.0.0',
        vendor: { name: 'GitLab Bulk Manager' },
      },
      scanner: {
        id: 'trivy',
        name: 'Trivy Secret Scanner',
        version: scan.trivy_version || 'unknown',
        vendor: { name: 'Aqua Security' },
      },
      type: 'secret_detection',
      start_time: startTime.toISOString().replace('Z', ''),
      end_time: endTime.toISOString().replace('Z', ''),
      status: scan.status === 'completed' ? 'success' : 'failure',
    },
    vulnerabilities: secretVulns.map(vuln => ({
      id: generateUUID(),
      category: 'secret_detection',
      name: vuln.title.substring(0, 255),
      message: `Secret detected in ${extractFilename(vuln.file_path)}`,
      description: vuln.description || 'Potential secret or credential exposed in source code',
      severity: mapSeverity(vuln.severity),
      scanner: {
        id: 'trivy',
        name: 'Trivy Secret Scanner',
      },
      identifiers: [{
        type: 'trivy_secret',
        name: vuln.title,
        value: vuln.title,
      }],
      location: {
        file: extractFilename(vuln.file_path),
        start_line: vuln.line_number || undefined,
      },
      raw_source_code_extract: vuln.description?.includes('Found:')
        ? vuln.description.replace('Found: ', '').substring(0, 50) + '...'
        : undefined,
    })),
  };
}

/**
 * Export all GitLab-compatible reports as a zip or combined JSON
 */
export function exportGitLabReports(
  scan: ScanHistory,
  vulnerabilities: Vulnerability[]
): {
  'gl-sast-report.json': GitLabSecurityReport;
  'gl-dependency-scanning-report.json': GitLabSecurityReport;
  'gl-secret-detection-report.json': GitLabSecurityReport;
} {
  return {
    'gl-sast-report.json': convertToGitLabSASTReport(scan, vulnerabilities),
    'gl-dependency-scanning-report.json': convertToGitLabDependencyReport(scan, vulnerabilities),
    'gl-secret-detection-report.json': convertToGitLabSecretReport(scan, vulnerabilities),
  };
}
