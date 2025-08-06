import express from 'express';
import { gitlabRequest } from '../services/gitlabProxy.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Bulk delete
router.post('/delete', async (req, res) => {
  const { items } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    try {
      const endpoint = item.type === 'group' 
        ? `/groups/${item.id}`
        : `/projects/${item.id}`;
      
      await gitlabRequest(req, endpoint, { method: 'DELETE' });
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk archive
router.post('/archive', async (req, res) => {
  const { items } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    if (item.type !== 'project') {
      results.failed.push({ ...item, error: 'Only projects can be archived' });
      continue;
    }

    try {
      await gitlabRequest(req, `/projects/${item.id}`, {
        method: 'PUT',
        body: { archived: true }
      });
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk unarchive
router.post('/unarchive', async (req, res) => {
  const { items } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    if (item.type !== 'project') {
      results.failed.push({ ...item, error: 'Only projects can be unarchived' });
      continue;
    }

    try {
      await gitlabRequest(req, `/projects/${item.id}`, {
        method: 'PUT',
        body: { archived: false }
      });
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk transfer
router.post('/transfer', async (req, res) => {
  const { items, targetNamespaceId } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    try {
      if (item.type === 'project') {
        // GitLab API expects namespace_id for project transfer
        const result = await gitlabRequest(req, `/projects/${item.id}/transfer`, {
          method: 'PUT',
          body: { namespace_id: targetNamespaceId }
        });
        results.success.push({ 
          id: item.id,
          name: item.name || 'Unknown',
          type: item.type,
          newNamespaceId: targetNamespaceId 
        });
        continue;
      } else {
        // For groups, we need to use a different approach
        results.failed.push({ ...item, error: 'Group transfer not yet implemented' });
        continue;
      }
    } catch (error) {
      console.error(`Failed to transfer ${item.type} ${item.id}:`, error);
      results.failed.push({ ...item, error: error.message || 'Transfer failed' });
    }
  }

  res.json({ 
    success: results.success, 
    failed: results.failed,
    total: items.length 
  });
});

// Bulk visibility change
router.post('/visibility', async (req, res) => {
  const { items, visibility } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    try {
      const endpoint = item.type === 'group' 
        ? `/groups/${item.id}`
        : `/projects/${item.id}`;
      
      await gitlabRequest(req, endpoint, {
        method: 'PUT',
        body: { visibility }
      });
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk permissions change
router.post('/permissions', async (req, res) => {
  const { items, level } = req.body;
  const results = { success: [], failed: [] };

  const accessLevels = {
    guest: 10,
    reporter: 20,
    developer: 30,
    maintainer: 40,
    owner: 50
  };

  for (const item of items) {
    try {
      if (item.type === 'group') {
        await gitlabRequest(req, `/groups/${item.id}`, {
          method: 'PUT',
          body: { 
            default_branch_protection: level === 'developer' ? 2 : 3,
            project_creation_level: accessLevels[level] || 30
          }
        });
      } else {
        await gitlabRequest(req, `/projects/${item.id}`, {
          method: 'PUT',
          body: { 
            merge_requests_access_level: accessLevels[level] || 30,
            issues_access_level: accessLevels[level] || 30
          }
        });
      }
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk labels
router.post('/labels', async (req, res) => {
  const { items, labels, action = 'add' } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    if (item.type !== 'project') {
      results.failed.push({ ...item, error: 'Labels can only be added to projects' });
      continue;
    }

    try {
      for (const label of labels) {
        if (action === 'add') {
          await gitlabRequest(req, `/projects/${item.id}/labels`, {
            method: 'POST',
            body: { 
              name: label,
              color: '#' + Math.floor(Math.random()*16777215).toString(16)
            }
          });
        } else {
          await gitlabRequest(req, `/projects/${item.id}/labels/${encodeURIComponent(label)}`, {
            method: 'DELETE'
          });
        }
      }
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk clone
router.post('/clone', async (req, res) => {
  const { items, suffix = '_copy' } = req.body;
  const results = { success: [], failed: [] };

  for (const item of items) {
    try {
      if (item.type === 'project') {
        const project = await gitlabRequest(req, `/projects/${item.id}`, { method: 'GET' });
        await gitlabRequest(req, `/projects`, {
          method: 'POST',
          body: {
            name: project.name + suffix,
            path: project.path + suffix.toLowerCase(),
            namespace_id: project.namespace.id,
            visibility: project.visibility,
            description: project.description
          }
        });
      } else {
        const group = await gitlabRequest(req, `/groups/${item.id}`, { method: 'GET' });
        await gitlabRequest(req, `/groups`, {
          method: 'POST',
          body: {
            name: group.name + suffix,
            path: group.path + suffix.toLowerCase(),
            parent_id: group.parent_id,
            visibility: group.visibility,
            description: group.description
          }
        });
      }
      results.success.push(item);
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

// Bulk export
router.post('/export', async (req, res) => {
  const { items } = req.body;
  const results = { success: [], failed: [], exports: [] };

  for (const item of items) {
    try {
      if (item.type === 'project') {
        // Trigger project export
        await gitlabRequest(req, `/projects/${item.id}/export`, {
          method: 'POST'
        });
        
        // Get export status
        const status = await gitlabRequest(req, `/projects/${item.id}/export`, {
          method: 'GET'
        });
        
        results.exports.push({
          id: item.id,
          name: item.name,
          status: status.export_status,
          _links: status._links
        });
        results.success.push(item);
      } else {
        results.failed.push({ ...item, error: 'Group export not yet implemented' });
      }
    } catch (error) {
      results.failed.push({ ...item, error: error.message });
    }
  }

  res.json(results);
});

export default router;