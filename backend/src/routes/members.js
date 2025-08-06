import express from 'express';
import axios from 'axios';

const router = express.Router();

// Bulk add members to projects/groups
router.post('/bulk-add', async (req, res) => {
  const { items, users, accessLevel = 30 } = req.body; // 30 = Developer
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: 'No users provided' });
  }

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  // Process each item
  for (const item of items) {
    const { id, name, type } = item;
    
    // Process each user for this item
    for (const user of users) {
      try {
        const endpoint = type === 'group' 
          ? `${req.session.gitlabUrl}/api/v4/groups/${id}/members`
          : `${req.session.gitlabUrl}/api/v4/projects/${id}/members`;

        const response = await axios.post(endpoint, {
          user_id: user.id,
          access_level: accessLevel
        }, { headers });

        results.successful.push({
          item: { id, name, type },
          user: { id: user.id, username: user.username },
          message: `Added ${user.username} to ${name}`
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        results.failed.push({
          item: { id, name, type },
          user: { id: user.id, username: user.username },
          error: errorMessage
        });
      }
    }
  }

  res.json({ results });
});

// Bulk remove members from projects/groups
router.post('/bulk-remove', async (req, res) => {
  const { items, userIds } = req.body;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'No user IDs provided' });
  }

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  // Process each item
  for (const item of items) {
    const { id, name, type } = item;
    
    // Process each user for this item
    for (const userId of userIds) {
      try {
        const endpoint = type === 'group' 
          ? `${req.session.gitlabUrl}/api/v4/groups/${id}/members/${userId}`
          : `${req.session.gitlabUrl}/api/v4/projects/${id}/members/${userId}`;

        await axios.delete(endpoint, { headers });

        results.successful.push({
          item: { id, name, type },
          userId,
          message: `Removed user ${userId} from ${name}`
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        results.failed.push({
          item: { id, name, type },
          userId,
          error: errorMessage
        });
      }
    }
  }

  res.json({ results });
});

// Bulk update member access levels
router.post('/bulk-update-access', async (req, res) => {
  const { items, userIds, accessLevel } = req.body;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'No user IDs provided' });
  }

  if (!accessLevel) {
    return res.status(400).json({ error: 'Access level not provided' });
  }

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  // Process each item
  for (const item of items) {
    const { id, name, type } = item;
    
    // Process each user for this item
    for (const userId of userIds) {
      try {
        const endpoint = type === 'group' 
          ? `${req.session.gitlabUrl}/api/v4/groups/${id}/members/${userId}`
          : `${req.session.gitlabUrl}/api/v4/projects/${id}/members/${userId}`;

        await axios.put(endpoint, {
          access_level: accessLevel
        }, { headers });

        results.successful.push({
          item: { id, name, type },
          userId,
          message: `Updated access level for user ${userId} in ${name}`
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        results.failed.push({
          item: { id, name, type },
          userId,
          error: errorMessage
        });
      }
    }
  }

  res.json({ results });
});

// Get members of a group/project
router.get('/:type/:id', async (req, res) => {
  const { type, id } = req.params;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (type !== 'group' && type !== 'project') {
    return res.status(400).json({ error: 'Invalid type. Must be "group" or "project"' });
  }

  try {
    const headers = {
      'PRIVATE-TOKEN': req.session.token
    };

    const endpoint = type === 'group' 
      ? `${req.session.gitlabUrl}/api/v4/groups/${id}/members/all`
      : `${req.session.gitlabUrl}/api/v4/projects/${id}/members/all`;

    const response = await axios.get(endpoint, { 
      headers,
      params: {
        per_page: 100
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching members:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to fetch members'
    });
  }
});

// Search users
router.get('/search/users', async (req, res) => {
  const { search } = req.query;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  try {
    const headers = {
      'PRIVATE-TOKEN': req.session.token
    };

    const response = await axios.get(`${req.session.gitlabUrl}/api/v4/users`, { 
      headers,
      params: {
        search,
        per_page: 20,
        active: true
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error searching users:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to search users'
    });
  }
});

export default router;