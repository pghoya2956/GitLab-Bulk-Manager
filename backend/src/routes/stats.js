import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to count all items with pagination
async function countAllItems(req, endpoint, params = {}) {
  const token = req.session.gitlabToken;
  const baseURL = req.session.gitlabUrl || process.env.GITLAB_API_URL || 'https://gitlab.com';
  
  try {
    // First request to get total count from headers
    const response = await axios.get(`${baseURL}/api/v4${endpoint}`, {
      headers: {
        'PRIVATE-TOKEN': token
      },
      params: {
        ...params,
        per_page: 1,
        page: 1
      },
      timeout: 5000 // 5 second timeout
    });
    
    // GitLab returns total count in x-total header
    const total = parseInt(response.headers['x-total'] || '0');
    return total;
  } catch (error) {
    logger.error(`Failed to count items at ${endpoint}:`, error.message);
    throw error;
  }
}

// Get comprehensive statistics
router.get('/overview', async (req, res) => {
  try {
    const stats = {
      timestamp: new Date().toISOString(),
      groups: {
        total: 0,
        topLevel: 0,
        subgroups: 0
      },
      projects: {
        total: 0
      }
    };

    // Make parallel requests for better performance
    const [groupsTotal, projectsTotal] = await Promise.all([
      countAllItems(req, '/groups').catch(err => {
        logger.error('Failed to count groups:', err);
        return 0;
      }),
      countAllItems(req, '/projects').catch(err => {
        logger.error('Failed to count projects:', err);
        return 0;
      })
    ]);

    stats.groups.total = groupsTotal;
    stats.projects.total = projectsTotal;

    // Get top-level groups count separately (optional, can be skipped for performance)
    try {
      stats.groups.topLevel = await countAllItems(req, '/groups', { top_level_only: true });
      stats.groups.subgroups = stats.groups.total - stats.groups.topLevel;
    } catch (error) {
      // If this fails, just set subgroups to 0
      logger.warn('Failed to get top-level groups count:', error.message);
      stats.groups.topLevel = stats.groups.total;
      stats.groups.subgroups = 0;
    }

    res.json(stats);
  } catch (error) {
    logger.error('Stats overview error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

// Get detailed group hierarchy stats
router.get('/groups/hierarchy', async (req, res) => {
  try {
    const token = req.session.gitlabToken;
    const baseURL = req.session.gitlabUrl || process.env.GITLAB_API_URL || 'https://gitlab.com';
    
    // Get all top-level groups
    const topLevelResponse = await axios.get(`${baseURL}/api/v4/groups`, {
      headers: { 'PRIVATE-TOKEN': token },
      params: { top_level_only: true, per_page: 100 }
    });
    
    const hierarchy = {
      totalGroups: 0,
      totalProjects: 0,
      maxDepth: 0,
      groupsByDepth: {},
      largestGroups: []
    };
    
    // Function to recursively count subgroups
    async function countSubgroups(groupId, depth = 1) {
      try {
        const response = await axios.get(`${baseURL}/api/v4/groups/${groupId}/subgroups`, {
          headers: { 'PRIVATE-TOKEN': token },
          params: { per_page: 100 }
        });
        
        hierarchy.totalGroups += response.data.length;
        hierarchy.groupsByDepth[depth] = (hierarchy.groupsByDepth[depth] || 0) + response.data.length;
        hierarchy.maxDepth = Math.max(hierarchy.maxDepth, depth);
        
        // Recursively count subgroups
        for (const subgroup of response.data) {
          await countSubgroups(subgroup.id, depth + 1);
        }
      } catch (error) {
        logger.error(`Failed to count subgroups for group ${groupId}:`, error.message);
      }
    }
    
    // Process top-level groups
    hierarchy.totalGroups = topLevelResponse.data.length;
    hierarchy.groupsByDepth[0] = topLevelResponse.data.length;
    
    // Count subgroups for each top-level group
    for (const group of topLevelResponse.data.slice(0, 10)) { // Limit to prevent timeout
      await countSubgroups(group.id);
      
      // Track largest groups
      const projectCount = await countAllItems(req, `/groups/${group.id}/projects`);
      hierarchy.largestGroups.push({
        id: group.id,
        name: group.name,
        full_path: group.full_path,
        projectCount
      });
    }
    
    // Sort largest groups by project count
    hierarchy.largestGroups.sort((a, b) => b.projectCount - a.projectCount);
    hierarchy.largestGroups = hierarchy.largestGroups.slice(0, 5);
    
    res.json(hierarchy);
  } catch (error) {
    logger.error('Group hierarchy stats error:', error);
    res.status(500).json({
      error: 'Failed to get group hierarchy statistics',
      message: error.message
    });
  }
});

export default router;