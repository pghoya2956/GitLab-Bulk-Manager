import express from 'express';
import axios from 'axios';

const router = express.Router();

// Get CI/CD settings from a project
router.get('/project/:id/settings', async (req, res) => {
  const { id } = req.params;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  try {
    const headers = {
      'PRIVATE-TOKEN': req.session.token
    };

    // Get project CI/CD settings
    const [project, variables, runners] = await Promise.all([
      axios.get(`${req.session.gitlabUrl}/api/v4/projects/${id}`, { headers }),
      axios.get(`${req.session.gitlabUrl}/api/v4/projects/${id}/variables`, { headers }),
      axios.get(`${req.session.gitlabUrl}/api/v4/projects/${id}/runners`, { headers })
    ]);

    res.json({
      project: {
        id: project.data.id,
        name: project.data.name,
        auto_devops_enabled: project.data.auto_devops_enabled,
        builds_access_level: project.data.builds_access_level,
        ci_config_path: project.data.ci_config_path,
        ci_default_git_depth: project.data.ci_default_git_depth,
        ci_forward_deployment_enabled: project.data.ci_forward_deployment_enabled,
        public_builds: project.data.public_builds,
        build_timeout: project.data.build_timeout,
        auto_cancel_pending_pipelines: project.data.auto_cancel_pending_pipelines,
        build_coverage_regex: project.data.build_coverage_regex,
      },
      variables: variables.data,
      runners: runners.data
    });
  } catch (error) {
    console.error('Error fetching CI/CD settings:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to fetch CI/CD settings'
    });
  }
});

// Sync CI/CD settings to multiple projects
router.post('/sync-settings', async (req, res) => {
  const { sourceProjectId, targetProjectIds, syncOptions } = req.body;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!sourceProjectId || !targetProjectIds || targetProjectIds.length === 0) {
    return res.status(400).json({ error: 'Source project and target projects are required' });
  }

  const {
    syncGeneralSettings = true,
    syncVariables = true,
    syncRunners = false,
    overwriteVariables = false
  } = syncOptions || {};

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  try {
    // First, get settings from source project
    const [sourceProject, sourceVariables] = await Promise.all([
      axios.get(`${req.session.gitlabUrl}/api/v4/projects/${sourceProjectId}`, { headers }),
      syncVariables ? axios.get(`${req.session.gitlabUrl}/api/v4/projects/${sourceProjectId}/variables`, { headers }) : Promise.resolve({ data: [] })
    ]);

    // Extract settings to sync
    const settingsToSync = {
      auto_devops_enabled: sourceProject.data.auto_devops_enabled,
      builds_access_level: sourceProject.data.builds_access_level,
      ci_config_path: sourceProject.data.ci_config_path,
      ci_default_git_depth: sourceProject.data.ci_default_git_depth,
      ci_forward_deployment_enabled: sourceProject.data.ci_forward_deployment_enabled,
      public_builds: sourceProject.data.public_builds,
      build_timeout: sourceProject.data.build_timeout,
      auto_cancel_pending_pipelines: sourceProject.data.auto_cancel_pending_pipelines,
      build_coverage_regex: sourceProject.data.build_coverage_regex,
    };

    // Sync to each target project
    for (const targetId of targetProjectIds) {
      try {
        // Update general CI/CD settings
        if (syncGeneralSettings) {
          await axios.put(
            `${req.session.gitlabUrl}/api/v4/projects/${targetId}`,
            settingsToSync,
            { headers }
          );
        }

        // Sync variables
        if (syncVariables && sourceVariables.data.length > 0) {
          // Get existing variables if not overwriting
          let existingVars = [];
          if (!overwriteVariables) {
            const varResponse = await axios.get(
              `${req.session.gitlabUrl}/api/v4/projects/${targetId}/variables`,
              { headers }
            );
            existingVars = varResponse.data.map(v => v.key);
          } else {
            // Delete all existing variables if overwriting
            const varResponse = await axios.get(
              `${req.session.gitlabUrl}/api/v4/projects/${targetId}/variables`,
              { headers }
            );
            for (const variable of varResponse.data) {
              await axios.delete(
                `${req.session.gitlabUrl}/api/v4/projects/${targetId}/variables/${variable.key}`,
                { headers }
              );
            }
          }

          // Add source variables
          for (const variable of sourceVariables.data) {
            if (!existingVars.includes(variable.key)) {
              try {
                await axios.post(
                  `${req.session.gitlabUrl}/api/v4/projects/${targetId}/variables`,
                  {
                    key: variable.key,
                    value: variable.value,
                    protected: variable.protected,
                    masked: variable.masked,
                    environment_scope: variable.environment_scope
                  },
                  { headers }
                );
              } catch (varError) {
                console.error(`Failed to add variable ${variable.key} to project ${targetId}:`, varError.response?.data);
              }
            }
          }
        }

        // Get target project name for result
        const targetProject = await axios.get(
          `${req.session.gitlabUrl}/api/v4/projects/${targetId}`,
          { headers }
        );

        results.successful.push({
          id: targetId,
          name: targetProject.data.name,
          message: 'CI/CD settings synced successfully'
        });
      } catch (error) {
        results.failed.push({
          id: targetId,
          error: error.response?.data?.message || error.message
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error syncing CI/CD settings:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to sync CI/CD settings'
    });
  }
});

// Bulk update CI/CD variables
router.post('/bulk-variables', async (req, res) => {
  const { projectIds, variables, action = 'add' } = req.body;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!projectIds || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  if (!variables || variables.length === 0) {
    return res.status(400).json({ error: 'No variables specified' });
  }

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  for (const projectId of projectIds) {
    try {
      // Get project name
      const project = await axios.get(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        { headers }
      );

      if (action === 'delete') {
        // Delete variables
        for (const variable of variables) {
          try {
            await axios.delete(
              `${req.session.gitlabUrl}/api/v4/projects/${projectId}/variables/${variable.key}`,
              { headers }
            );
          } catch (deleteError) {
            console.error(`Failed to delete variable ${variable.key}:`, deleteError.response?.data);
          }
        }
      } else if (action === 'update') {
        // Update variables
        for (const variable of variables) {
          try {
            await axios.put(
              `${req.session.gitlabUrl}/api/v4/projects/${projectId}/variables/${variable.key}`,
              {
                value: variable.value,
                protected: variable.protected || false,
                masked: variable.masked || false,
                environment_scope: variable.environment_scope || '*'
              },
              { headers }
            );
          } catch (updateError) {
            // If update fails, try to create
            try {
              await axios.post(
                `${req.session.gitlabUrl}/api/v4/projects/${projectId}/variables`,
                {
                  key: variable.key,
                  value: variable.value,
                  protected: variable.protected || false,
                  masked: variable.masked || false,
                  environment_scope: variable.environment_scope || '*'
                },
                { headers }
              );
            } catch (createError) {
              console.error(`Failed to update/create variable ${variable.key}:`, createError.response?.data);
            }
          }
        }
      } else {
        // Add variables (default)
        for (const variable of variables) {
          try {
            await axios.post(
              `${req.session.gitlabUrl}/api/v4/projects/${projectId}/variables`,
              {
                key: variable.key,
                value: variable.value,
                protected: variable.protected || false,
                masked: variable.masked || false,
                environment_scope: variable.environment_scope || '*'
              },
              { headers }
            );
          } catch (addError) {
            console.error(`Failed to add variable ${variable.key}:`, addError.response?.data);
          }
        }
      }

      results.successful.push({
        id: projectId,
        name: project.data.name,
        message: `Variables ${action === 'delete' ? 'deleted' : action === 'update' ? 'updated' : 'added'} successfully`
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

// Enable/Disable Auto DevOps for multiple projects
router.post('/auto-devops', async (req, res) => {
  const { projectIds, enabled } = req.body;
  
  if (!req.session.gitlabUrl || !req.session.token) {
    return res.status(401).json({ error: 'Not authenticated with GitLab' });
  }

  if (!projectIds || projectIds.length === 0) {
    return res.status(400).json({ error: 'No projects specified' });
  }

  const results = {
    successful: [],
    failed: []
  };

  const headers = {
    'PRIVATE-TOKEN': req.session.token
  };

  for (const projectId of projectIds) {
    try {
      const response = await axios.put(
        `${req.session.gitlabUrl}/api/v4/projects/${projectId}`,
        { auto_devops_enabled: enabled },
        { headers }
      );

      results.successful.push({
        id: projectId,
        name: response.data.name,
        message: `Auto DevOps ${enabled ? 'enabled' : 'disabled'}`
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

export default router;