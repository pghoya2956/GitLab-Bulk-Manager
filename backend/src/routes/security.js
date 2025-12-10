import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getScanById,
  getScans,
  getLatestScanByProject,
  getLatestScansByProjects,
  deleteScan,
} from '../services/securityDb.js';
import {
  scanProjects,
  checkScanningTools,
  getRunningScansCount,
} from '../services/securityScanner.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/security/status
 * Check if scanning tools are available
 */
router.get('/status', async (req, res) => {
  try {
    const status = await checkScanningTools();
    res.json({
      ...status,
      runningScans: getRunningScansCount(),
      maxConcurrentScans: 3,
    });
  } catch (error) {
    logger.error('Failed to check scanning status:', error);
    res.status(500).json({ error: 'Failed to check scanning status' });
  }
});

/**
 * POST /api/security/scan
 * Start security scan for selected projects
 * Body: { projects: [{ id, name, path_with_namespace }] }
 */
router.post('/scan', authenticateToken, async (req, res) => {
  try {
    const { projects } = req.body;
    const gitlabUrl = req.session.gitlabUrl;
    const token = req.session.gitlabToken;

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({ error: 'No projects provided' });
    }

    // Validate projects have required fields
    for (const project of projects) {
      if (!project.id || !project.name) {
        return res.status(400).json({ error: 'Each project must have id and name' });
      }
    }

    // Check if scanning tools are available
    const toolStatus = await checkScanningTools();
    if (!toolStatus.ready) {
      return res.status(503).json({
        error: 'No security scanning tools available',
        details: toolStatus,
      });
    }

    logger.info(`Starting security scan for ${projects.length} projects`);

    // Start scans (this runs sequentially to avoid overwhelming the system)
    const results = await scanProjects({ projects, gitlabUrl, token });

    const successful = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');

    res.json({
      message: `Scanned ${successful.length} projects successfully`,
      results,
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    logger.error('Security scan failed:', error);
    res.status(500).json({ error: error.message || 'Security scan failed' });
  }
});

/**
 * GET /api/security/scans
 * Get list of all scans with pagination and filtering
 * Query: ?status=completed&page=1&limit=20&sort=scan_date&order=DESC
 */
router.get('/scans', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, sort = 'scan_date', order = 'DESC' } = req.query;

    const result = await getScans({
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort,
      order,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to get scans:', error);
    res.status(500).json({ error: 'Failed to get scan history' });
  }
});

/**
 * GET /api/security/scans/:scanId
 * Get scan details with vulnerabilities
 */
router.get('/scans/:scanId', authenticateToken, async (req, res) => {
  try {
    const { scanId } = req.params;

    const result = await getScanById(parseInt(scanId, 10));

    if (!result) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(result);
  } catch (error) {
    logger.error('Failed to get scan:', error);
    res.status(500).json({ error: 'Failed to get scan details' });
  }
});

/**
 * GET /api/security/projects/:projectId/latest
 * Get latest scan for a specific project
 */
router.get('/projects/:projectId/latest', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const gitlabUrl = req.session.gitlabUrl;

    const scan = await getLatestScanByProject(parseInt(projectId, 10), gitlabUrl);

    res.json({ scan });
  } catch (error) {
    logger.error('Failed to get latest scan:', error);
    res.status(500).json({ error: 'Failed to get latest scan' });
  }
});

/**
 * POST /api/security/projects/batch
 * Get latest scans for multiple projects (for tree view badges)
 * Body: { projectIds: number[] }
 */
router.post('/projects/batch', authenticateToken, async (req, res) => {
  try {
    const { projectIds } = req.body;
    const gitlabUrl = req.session.gitlabUrl;

    if (!projectIds || !Array.isArray(projectIds)) {
      return res.status(400).json({ error: 'projectIds array required' });
    }

    const scans = await getLatestScansByProjects(projectIds, gitlabUrl);

    // Convert to map for easy lookup
    const scanMap = {};
    for (const scan of scans) {
      scanMap[scan.project_id] = {
        scanId: scan.id,
        status: scan.status,
        scanDate: scan.scan_date,
        critical: scan.summary_critical,
        high: scan.summary_high,
        medium: scan.summary_medium,
        low: scan.summary_low,
      };
    }

    res.json({ scans: scanMap });
  } catch (error) {
    logger.error('Failed to get batch scans:', error);
    res.status(500).json({ error: 'Failed to get project scans' });
  }
});

/**
 * DELETE /api/security/scans/:scanId
 * Delete a scan and its vulnerabilities
 */
router.delete('/scans/:scanId', authenticateToken, async (req, res) => {
  try {
    const { scanId } = req.params;

    const deleted = await deleteScan(parseInt(scanId, 10));

    if (!deleted) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    res.json({ success: true, message: 'Scan deleted' });
  } catch (error) {
    logger.error('Failed to delete scan:', error);
    res.status(500).json({ error: 'Failed to delete scan' });
  }
});

export default router;
