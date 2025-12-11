import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import axios from 'axios';
import {
  createScan,
  completeScan,
  failScan,
  insertVulnerabilities,
} from './securityDb.js';
import logger from '../utils/logger.js';

const execFileAsync = promisify(execFile);

// Configuration
const SCAN_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CONCURRENT_SCANS = 3;
const MAX_PROJECT_SIZE_MB = 500;

// Track running scans
const runningScans = new Map();

/**
 * Download GitLab repository archive
 */
async function downloadRepository(gitlabUrl, projectId, token, destDir) {
  const archiveUrl = `${gitlabUrl}/api/v4/projects/${projectId}/repository/archive.zip`;
  const zipPath = path.join(destDir, 'repo.zip');

  logger.info(`Downloading repository from ${archiveUrl}`);

  const response = await axios({
    method: 'get',
    url: archiveUrl,
    headers: {
      'PRIVATE-TOKEN': token,
    },
    responseType: 'arraybuffer',
    maxContentLength: MAX_PROJECT_SIZE_MB * 1024 * 1024,
    timeout: 60000, // 1 minute timeout for download
  });

  await fs.writeFile(zipPath, response.data);

  // Extract the archive
  const extractDir = path.join(destDir, 'source');
  await fs.mkdir(extractDir, { recursive: true });

  // Use unzip command
  await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', extractDir], {
    timeout: 60000,
  });

  // Find the actual source directory (GitLab creates a subdirectory)
  const entries = await fs.readdir(extractDir);
  const sourceDir = entries.length === 1
    ? path.join(extractDir, entries[0])
    : extractDir;

  return sourceDir;
}

/**
 * Get Trivy version
 */
async function getTrivyVersion() {
  try {
    const { stdout } = await execFileAsync('trivy', ['--version'], { timeout: 10000 });
    const match = stdout.match(/Version:\s*(\S+)/);
    return match ? match[1] : 'unknown';
  } catch {
    return null;
  }
}

/**
 * Get Semgrep version
 */
async function getSemgrepVersion() {
  try {
    const { stdout } = await execFileAsync('semgrep', ['--version'], { timeout: 10000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Run Trivy scan
 */
async function runTrivy(sourceDir) {
  const vulnerabilities = [];

  try {
    // Run Trivy with vulnerability and secret scanners
    const { stdout } = await execFileAsync(
      'trivy',
      [
        'fs',
        '--scanners', 'vuln,secret,misconfig',
        '--format', 'json',
        '--quiet',
        sourceDir,
      ],
      {
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large results
      }
    );

    const results = JSON.parse(stdout);

    // Process results
    if (results.Results) {
      for (const result of results.Results) {
        // Process vulnerabilities
        if (result.Vulnerabilities) {
          for (const vuln of result.Vulnerabilities) {
            vulnerabilities.push({
              source: 'trivy',
              type: 'dependency',
              severity: vuln.Severity || 'UNKNOWN',
              title: vuln.VulnerabilityID || vuln.Title || 'Unknown vulnerability',
              description: vuln.Description,
              filePath: result.Target,
              cve: vuln.VulnerabilityID,
              fixSuggestion: vuln.FixedVersion ? `Update to version ${vuln.FixedVersion}` : null,
              packageName: vuln.PkgName,
              packageVersion: vuln.InstalledVersion,
              references: vuln.References || [],
            });
          }
        }

        // Process secrets
        if (result.Secrets) {
          for (const secret of result.Secrets) {
            vulnerabilities.push({
              source: 'trivy',
              type: 'secret',
              severity: secret.Severity || 'HIGH',
              title: secret.Title || secret.RuleID || 'Exposed secret',
              description: secret.Match ? `Found: ${secret.Match.substring(0, 50)}...` : null,
              filePath: result.Target,
              lineNumber: secret.StartLine,
            });
          }
        }

        // Process misconfigurations
        if (result.Misconfigurations) {
          for (const misconfig of result.Misconfigurations) {
            vulnerabilities.push({
              source: 'trivy',
              type: 'misconfig',
              severity: misconfig.Severity || 'MEDIUM',
              title: misconfig.Title || misconfig.ID,
              description: misconfig.Description,
              filePath: result.Target,
              references: misconfig.References || [],
              fixSuggestion: misconfig.Resolution,
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error('Trivy scan error:', error.message);
    // Don't throw - continue with Semgrep
  }

  return vulnerabilities;
}

/**
 * Run Semgrep scan
 */
async function runSemgrep(sourceDir) {
  const vulnerabilities = [];

  try {
    const { stdout } = await execFileAsync(
      'semgrep',
      [
        'scan',
        '--config', 'auto',
        '--json',
        '--quiet',
        sourceDir,
      ],
      {
        timeout: SCAN_TIMEOUT_MS,
        maxBuffer: 50 * 1024 * 1024,
      }
    );

    const results = JSON.parse(stdout);

    if (results.results) {
      for (const finding of results.results) {
        // Map Semgrep severity to standard levels
        let severity = 'MEDIUM';
        const meta = finding.extra?.metadata || {};
        if (meta.severity) {
          const s = meta.severity.toUpperCase();
          if (s === 'ERROR' || s === 'CRITICAL') severity = 'CRITICAL';
          else if (s === 'WARNING' || s === 'HIGH') severity = 'HIGH';
          else if (s === 'INFO' || s === 'LOW') severity = 'LOW';
        }

        vulnerabilities.push({
          source: 'semgrep',
          type: 'code',
          severity,
          title: finding.check_id || 'Code issue',
          description: finding.extra?.message || meta.message,
          filePath: finding.path,
          lineNumber: finding.start?.line,
          cwe: meta.cwe ? (Array.isArray(meta.cwe) ? meta.cwe.join(', ') : meta.cwe) : null,
          references: meta.references || [],
          fixSuggestion: meta.fix || finding.extra?.fix,
        });
      }
    }
  } catch (error) {
    logger.error('Semgrep scan error:', error.message);
    // Don't throw - return what we have
  }

  return vulnerabilities;
}

/**
 * Count vulnerabilities by severity
 */
function countBySeverity(vulnerabilities) {
  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    INFO: 0,
  };

  for (const vuln of vulnerabilities) {
    const sev = vuln.severity?.toUpperCase() || 'INFO';
    if (counts[sev] !== undefined) {
      counts[sev]++;
    } else {
      counts.INFO++;
    }
  }

  return counts;
}

/**
 * Run security scan for a project
 */
export async function scanProject({ projectId, projectName, projectPath, gitlabUrl, token }) {
  // Check concurrent scan limit
  if (runningScans.size >= MAX_CONCURRENT_SCANS) {
    throw new Error(`Maximum concurrent scans (${MAX_CONCURRENT_SCANS}) reached. Please try again later.`);
  }

  // Create temp directory for this scan
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-scan-'));
  const startTime = Date.now();

  let scanId = null;

  try {
    // Create scan record
    scanId = await createScan({
      projectId,
      projectName,
      projectPath,
      gitlabUrl,
    });

    runningScans.set(scanId, { projectId, startTime });
    logger.info(`Started scan ${scanId} for project ${projectId} (${projectName})`);

    // Check tool availability
    const trivyVersion = await getTrivyVersion();
    const semgrepVersion = await getSemgrepVersion();

    if (!trivyVersion && !semgrepVersion) {
      throw new Error('No security scanning tools available. Please ensure Trivy or Semgrep is installed.');
    }

    // Download repository
    const sourceDir = await downloadRepository(gitlabUrl, projectId, token, tempDir);
    logger.info(`Repository downloaded to ${sourceDir}`);

    // Run scans
    const allVulnerabilities = [];

    if (trivyVersion) {
      logger.info('Running Trivy scan...');
      const trivyResults = await runTrivy(sourceDir);
      allVulnerabilities.push(...trivyResults);
      logger.info(`Trivy found ${trivyResults.length} issues`);
    }

    if (semgrepVersion) {
      logger.info('Running Semgrep scan...');
      const semgrepResults = await runSemgrep(sourceDir);
      allVulnerabilities.push(...semgrepResults);
      logger.info(`Semgrep found ${semgrepResults.length} issues`);
    }

    // Calculate summary
    const counts = countBySeverity(allVulnerabilities);
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);

    // Save vulnerabilities
    await insertVulnerabilities(scanId, allVulnerabilities);

    // Update scan record
    await completeScan({
      scanId,
      trivyVersion,
      semgrepVersion,
      durationSeconds,
      summaryCritical: counts.CRITICAL,
      summaryHigh: counts.HIGH,
      summaryMedium: counts.MEDIUM,
      summaryLow: counts.LOW,
      summaryInfo: counts.INFO,
    });

    logger.info(`Scan ${scanId} completed: ${allVulnerabilities.length} total issues`);

    return {
      scanId,
      projectId,
      projectName,
      status: 'completed',
      summary: counts,
      totalVulnerabilities: allVulnerabilities.length,
      durationSeconds,
    };
  } catch (error) {
    // Extract detailed error message
    let errorMessage = error.message || 'Unknown error';
    if (error.response) {
      // Axios error with response
      errorMessage = `HTTP ${error.response.status}: ${error.response.statusText || ''} - ${JSON.stringify(error.response.data || '').substring(0, 200)}`;
    } else if (error.code) {
      // System error (ENOENT, ECONNREFUSED, etc.)
      errorMessage = `${error.code}: ${error.message}`;
    }

    logger.error(`Scan failed for project ${projectId}: ${errorMessage}`);

    if (scanId) {
      await failScan(scanId, errorMessage);
    }

    return {
      scanId,
      projectId,
      projectName,
      status: 'failed',
      error: errorMessage,
    };
  } finally {
    // Cleanup
    if (scanId) {
      runningScans.delete(scanId);
    }

    // Remove temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      logger.info(`Cleaned up temp directory: ${tempDir}`);
    } catch (cleanupError) {
      logger.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
    }
  }
}

/**
 * Scan multiple projects
 */
export async function scanProjects({ projects, gitlabUrl, token }) {
  const results = [];

  for (const project of projects) {
    const result = await scanProject({
      projectId: project.id,
      projectName: project.name,
      projectPath: project.path_with_namespace || project.path,
      gitlabUrl,
      token,
    });
    results.push(result);
  }

  return results;
}

/**
 * Check if scanning tools are available
 */
export async function checkScanningTools() {
  const trivyVersion = await getTrivyVersion();
  const semgrepVersion = await getSemgrepVersion();

  return {
    trivy: {
      available: !!trivyVersion,
      version: trivyVersion,
    },
    semgrep: {
      available: !!semgrepVersion,
      version: semgrepVersion,
    },
    ready: !!trivyVersion || !!semgrepVersion,
  };
}

/**
 * Get current running scans count
 */
export function getRunningScansCount() {
  return runningScans.size;
}
