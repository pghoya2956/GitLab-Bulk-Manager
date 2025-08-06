import express from 'express';
import axios from 'axios';

const router = express.Router();

// Get issues for a project
router.get('/project/:id/issues', async (req, res) => {
  try {
    const { id } = req.params;
    const { state = 'opened', labels, assignee_id, milestone_id } = req.query;
    
    const params = {
      state,
      ...(labels && { labels }),
      ...(assignee_id && { assignee_id }),
      ...(milestone_id && { milestone_id })
    };

    const response = await axios.get(
      `${req.session.gitlabUrl}/api/v4/projects/${id}/issues`,
      {
        headers: {
          'PRIVATE-TOKEN': req.session.accessToken
        },
        params
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching issues:', error);
    res.status(500).json({ 
      error: error.response?.data?.message || 'Failed to fetch issues' 
    });
  }
});

// Get merge requests for a project
router.get('/project/:id/merge-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const { state = 'opened', labels, assignee_id, milestone_id } = req.query;
    
    const params = {
      state,
      ...(labels && { labels }),
      ...(assignee_id && { assignee_id }),
      ...(milestone_id && { milestone_id })
    };

    const response = await axios.get(
      `${req.session.gitlabUrl}/api/v4/projects/${id}/merge_requests`,
      {
        headers: {
          'PRIVATE-TOKEN': req.session.accessToken
        },
        params
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching merge requests:', error);
    res.status(500).json({ 
      error: error.response?.data?.message || 'Failed to fetch merge requests' 
    });
  }
});

// Bulk create issues
router.post('/bulk-create', async (req, res) => {
  const { projectIds, issue } = req.body;
  
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  if (!issue || !issue.title) {
    return res.status(400).json({ error: 'Issue title is required' });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const projectId of projectIds) {
    try {
      const response = await axios.post(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}/issues`,
        {
          title: issue.title,
          description: issue.description,
          labels: issue.labels?.join(','),
          assignee_ids: issue.assignee_ids,
          milestone_id: issue.milestone_id,
          due_date: issue.due_date,
          confidential: issue.confidential || false
        },
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      const projectInfo = await axios.get(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      results.successful.push({
        id: projectId,
        name: projectInfo.data.name_with_namespace,
        issue_id: response.data.id,
        issue_iid: response.data.iid,
        web_url: response.data.web_url,
        message: `Issue #${response.data.iid} created`
      });
    } catch (error) {
      results.failed.push({
        id: projectId,
        error: error.response?.data?.message || error.message
      });
    }
  }

  res.json({ results });
});

// Bulk update issues
router.post('/bulk-update', async (req, res) => {
  const { projectIds, issueIds, updates } = req.body;
  
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const projectId of projectIds) {
    try {
      // If specific issue IDs provided, update those
      // Otherwise, update all issues matching criteria
      let issuesToUpdate = [];
      
      if (issueIds && issueIds.length > 0) {
        issuesToUpdate = issueIds;
      } else {
        // Get all issues for the project
        const issuesResponse = await axios.get(
          `${req.session.gitlabUrl}/api/v4/projects/${projectId}/issues`,
          {
            headers: {
              'PRIVATE-TOKEN': req.session.accessToken
            },
            params: {
              state: updates.filterState || 'opened'
            }
          }
        );
        issuesToUpdate = issuesResponse.data.map(issue => issue.iid);
      }

      let updateCount = 0;
      for (const issueIid of issuesToUpdate) {
        try {
          const updateData = {};
          
          if (updates.state_event) updateData.state_event = updates.state_event;
          if (updates.labels !== undefined) updateData.labels = updates.labels.join(',');
          if (updates.add_labels) updateData.add_labels = updates.add_labels.join(',');
          if (updates.remove_labels) updateData.remove_labels = updates.remove_labels.join(',');
          if (updates.assignee_ids !== undefined) updateData.assignee_ids = updates.assignee_ids;
          if (updates.milestone_id !== undefined) updateData.milestone_id = updates.milestone_id;
          
          await axios.put(
            `${req.session.gitlabUrl}/api/v4/projects/${projectId}/issues/${issueIid}`,
            updateData,
            {
              headers: {
                'PRIVATE-TOKEN': req.session.accessToken
              }
            }
          );
          updateCount++;
        } catch (error) {
          console.error(`Failed to update issue ${issueIid}:`, error.message);
        }
      }

      const projectInfo = await axios.get(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      results.successful.push({
        id: projectId,
        name: projectInfo.data.name_with_namespace,
        message: `Updated ${updateCount} issues`
      });
    } catch (error) {
      results.failed.push({
        id: projectId,
        error: error.response?.data?.message || error.message
      });
    }
  }

  res.json({ results });
});

// Bulk close issues
router.post('/bulk-close', async (req, res) => {
  const { projectIds, issueIds } = req.body;
  
  req.body.updates = { state_event: 'close' };
  req.body.issueIds = issueIds;
  
  return router.handle(req, res, () => {
    return router.stack.find(layer => 
      layer.route?.path === '/bulk-update' && 
      layer.route?.methods?.post
    ).handle(req, res);
  });
});

// Bulk create merge requests
router.post('/merge-requests/bulk-create', async (req, res) => {
  const { projectIds, mergeRequest } = req.body;
  
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  if (!mergeRequest || !mergeRequest.source_branch || !mergeRequest.target_branch || !mergeRequest.title) {
    return res.status(400).json({ error: 'Source branch, target branch, and title are required' });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const projectId of projectIds) {
    try {
      const response = await axios.post(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}/merge_requests`,
        {
          source_branch: mergeRequest.source_branch,
          target_branch: mergeRequest.target_branch,
          title: mergeRequest.title,
          description: mergeRequest.description,
          labels: mergeRequest.labels?.join(','),
          assignee_ids: mergeRequest.assignee_ids,
          milestone_id: mergeRequest.milestone_id,
          remove_source_branch: mergeRequest.remove_source_branch || false,
          squash: mergeRequest.squash || false
        },
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      const projectInfo = await axios.get(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      results.successful.push({
        id: projectId,
        name: projectInfo.data.name_with_namespace,
        mr_id: response.data.id,
        mr_iid: response.data.iid,
        web_url: response.data.web_url,
        message: `MR !${response.data.iid} created`
      });
    } catch (error) {
      results.failed.push({
        id: projectId,
        error: error.response?.data?.message || error.message
      });
    }
  }

  res.json({ results });
});

// Bulk merge MRs
router.post('/merge-requests/bulk-merge', async (req, res) => {
  const { projectIds, mrIds, mergeOptions } = req.body;
  
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const projectId of projectIds) {
    try {
      // Get MRs to merge
      let mrsToMerge = [];
      
      if (mrIds && mrIds.length > 0) {
        mrsToMerge = mrIds;
      } else {
        // Get all open MRs
        const mrsResponse = await axios.get(
          `${req.session.gitlabUrl}/api/v4/projects/${projectId}/merge_requests`,
          {
            headers: {
              'PRIVATE-TOKEN': req.session.accessToken
            },
            params: {
              state: 'opened',
              wip: 'no' // Don't merge WIP/Draft MRs
            }
          }
        );
        mrsToMerge = mrsResponse.data
          .filter(mr => mr.merge_status === 'can_be_merged')
          .map(mr => mr.iid);
      }

      let mergeCount = 0;
      for (const mrIid of mrsToMerge) {
        try {
          await axios.put(
            `${req.session.gitlabUrl}/api/v4/projects/${projectId}/merge_requests/${mrIid}/merge`,
            {
              merge_commit_message: mergeOptions?.merge_commit_message,
              squash: mergeOptions?.squash || false,
              should_remove_source_branch: mergeOptions?.should_remove_source_branch || false,
              merge_when_pipeline_succeeds: mergeOptions?.merge_when_pipeline_succeeds || false
            },
            {
              headers: {
                'PRIVATE-TOKEN': req.session.accessToken
              }
            }
          );
          mergeCount++;
        } catch (error) {
          console.error(`Failed to merge MR ${mrIid}:`, error.message);
        }
      }

      const projectInfo = await axios.get(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        {
          headers: {
            'PRIVATE-TOKEN': req.session.accessToken
          }
        }
      );

      results.successful.push({
        id: projectId,
        name: projectInfo.data.name_with_namespace,
        message: `Merged ${mergeCount} MRs`
      });
    } catch (error) {
      results.failed.push({
        id: projectId,
        error: error.response?.data?.message || error.message
      });
    }
  }

  res.json({ results });
});

// Get labels for a project
router.get('/project/:id/labels', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await axios.get(
      `${req.session.gitlabUrl}/api/v4/projects/${id}/labels`,
      {
        headers: {
          'PRIVATE-TOKEN': req.session.accessToken
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching labels:', error);
    res.status(500).json({ 
      error: error.response?.data?.message || 'Failed to fetch labels' 
    });
  }
});

// Get milestones for a project  
router.get('/project/:id/milestones', async (req, res) => {
  try {
    const { id } = req.params;
    
    const response = await axios.get(
      `${req.session.gitlabUrl}/api/v4/projects/${id}/milestones`,
      {
        headers: {
          'PRIVATE-TOKEN': req.session.accessToken
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    res.status(500).json({ 
      error: error.response?.data?.message || 'Failed to fetch milestones' 
    });
  }
});

export default router;