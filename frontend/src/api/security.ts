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
