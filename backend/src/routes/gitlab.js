import express from 'express';
import { gitlabProxy } from '../services/gitlabProxy.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Groups endpoints
router.get('/groups', async (req, res, next) => {
  // Exclude groups marked for deletion
  if (req.query.skip_groups === undefined) {
    // GitLab API doesn't have skip_groups, but we can filter in the response
    const originalSend = res.send;
    res.send = function(data) {
      try {
        const groups = JSON.parse(data);
        if (Array.isArray(groups)) {
          // Filter out groups that are marked for deletion or have deletion-related names
          const filteredGroups = groups.filter(group => {
            // Check for deletion markers
            if (group.marked_for_deletion_on || group.marked_for_deletion) {
              return false;
            }
            // Check for deletion-related names (GitLab pattern)
            if (group.name && (
              group.name.includes('deletion_scheduled') ||
              group.name.includes('deleted-') ||
              group.name.startsWith('개발팀-deletion_scheduled') ||
              group.name.startsWith('박민드-deletion_scheduled') ||
              group.name.startsWith('표준토픽드-deletion_scheduled') ||
              group.name.startsWith('hwi-ho-deletion_scheduled')
            )) {
              return false;
            }
            // Check for deletion pattern in full_path
            if (group.full_path && group.full_path.includes('deletion_scheduled')) {
              return false;
            }
            return true;
          });
          
          if (groups.length !== filteredGroups.length) {
            logger.info(`Filtered ${groups.length - filteredGroups.length} groups (marked for deletion or deletion_scheduled pattern)`);
            logger.info(`Original: ${groups.length} groups, After filter: ${filteredGroups.length} groups`);
            const filtered = groups.filter(g => !filteredGroups.includes(g));
            filtered.forEach(g => {
              logger.info(`Filtered out: ${g.name} (${g.full_path})`);
            });
          }
          return originalSend.call(this, JSON.stringify(filteredGroups));
        }
      } catch (e) {
        // If parsing fails, send original data
      }
      return originalSend.call(this, data);
    };
  }
  return gitlabProxy(req, res, next);
});
router.get('/groups/:id', gitlabProxy);

router.get('/groups/:id/subgroups', async (req, res, next) => {
  // Filter out subgroups marked for deletion
  const originalSend = res.send;
  res.send = function(data) {
    try {
      const groups = JSON.parse(data);
      if (Array.isArray(groups)) {
        // Filter out groups that are marked for deletion or have deletion-related names
        const filteredGroups = groups.filter(group => {
          // Check for deletion markers
          if (group.marked_for_deletion_on || group.marked_for_deletion) {
            return false;
          }
          // Check for deletion-related names (GitLab pattern)
          if (group.name && (
            group.name.includes('deletion_scheduled') ||
            group.name.includes('deleted-')
          )) {
            return false;
          }
          // Check for deletion pattern in full_path
          if (group.full_path && group.full_path.includes('deletion_scheduled')) {
            return false;
          }
          return true;
        });
        
        if (groups.length !== filteredGroups.length) {
          logger.debug(`Filtered ${groups.length - filteredGroups.length} subgroups (marked for deletion or deletion_scheduled pattern) from group ${req.params.id}`);
        }
        return originalSend.call(this, JSON.stringify(filteredGroups));
      }
    } catch (e) {
      // If parsing fails, send original data
    }
    return originalSend.call(this, data);
  };
  return gitlabProxy(req, res, next);
});
router.get('/groups/:id/projects', async (req, res, next) => {
  // Add archived=false to exclude archived projects
  if (req.query.archived === undefined) {
    req.query.archived = false;
    logger.debug(`Added archived=false to group projects request for group ${req.params.id}`);
  }
  return gitlabProxy(req, res, next);
});
router.post('/groups', gitlabProxy);
router.put('/groups/:id', gitlabProxy);
router.delete('/groups/:id', gitlabProxy);
router.post('/groups/:id/transfer', gitlabProxy);

// Projects endpoints
router.get('/projects', async (req, res, next) => {
  // Add archived=false to exclude archived projects by default
  if (req.query.archived === undefined) {
    req.query.archived = false;
  }
  return gitlabProxy(req, res, next);
});
router.get('/projects/:id', gitlabProxy);
router.post('/projects', gitlabProxy);
router.put('/projects/:id', gitlabProxy);
router.delete('/projects/:id', gitlabProxy);
router.put('/projects/:id/transfer', gitlabProxy);

// Users endpoints
router.get('/users', gitlabProxy);
router.get('/users/:id', gitlabProxy);
router.get('/user', gitlabProxy);

// Members endpoints
router.get('/groups/:id/members', gitlabProxy);
router.post('/groups/:id/members', gitlabProxy);
router.put('/groups/:id/members/:user_id', gitlabProxy);
router.delete('/groups/:id/members/:user_id', gitlabProxy);

// Generic proxy for any other GitLab API endpoints
router.all('/*', gitlabProxy);

export default router;