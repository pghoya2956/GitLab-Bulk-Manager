import express from 'express';
import axios from 'axios';
import yaml from 'js-yaml';
import { API_RATE_LIMIT, GITLAB_CONFIG } from '../config/constants.js';

const router = express.Router();

// Helper: API 호출 지연
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper: 재시도 로직
async function retryRequest(fn, retries = API_RATE_LIMIT.MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries || error.response?.status < 500) {
        throw error;
      }
      await delay(Math.pow(API_RATE_LIMIT.BACKOFF_MULTIPLIER, i) * 1000); // Exponential backoff
    }
  }
}

// Helper: GitLab API 호출
async function gitlabRequest(req, method, path, data = null, includeHeaders = false) {
  const token = req.session.gitlabToken;
  const baseURL = req.session.gitlabUrl || GITLAB_CONFIG.DEFAULT_URL;

  return retryRequest(async () => {
    const response = await axios({
      method,
      url: `${baseURL}${GITLAB_CONFIG.API_VERSION}${path}`,
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json',
      },
      data,
    });

    if (includeHeaders) {
      return {
        data: response.data,
        headers: response.headers,
      };
    }
    return response.data;
  });
}

// Helper: 재귀적으로 서브그룹 생성
async function createSubgroupsRecursive(req, groups, parentId, parentPath, {
  results,
  defaultSettings,
  apiDelay,
  skipExisting,
  continueOnError,
}) {
  console.log('createSubgroupsRecursive called with:', { parentId, parentPath, groupsCount: groups.length });

  for (const group of groups) {
    results.total++;
    console.log('Processing group:', { name: group.name, path: group.path, parentId });

    try {
      // 기존 그룹 확인
      let existingGroup = null;
      if (skipExisting) {
        try {
          const searchPath = parentPath ? `${parentPath}/${group.path}` : group.path;
          console.log('Checking for existing group:', searchPath);
          existingGroup = await gitlabRequest(req, 'GET', `/groups/${encodeURIComponent(searchPath)}`);
        } catch (error) {
          // Group doesn't exist - proceed with creation
          existingGroup = null;
        }
      }

      if (existingGroup) {
        results.skipped.push({
          name: group.name,
          path: group.path,
          reason: 'Already exists',
        });
      } else {
        // 그룹 생성
        const groupData = {
          name: group.name,
          path: group.path,
          parent_id: parentId,
          ...defaultSettings,
          ...group.settings,
          description: group.description,
        };

        console.log('Creating group with data:', groupData);
        const createdGroup = await gitlabRequest(req, 'POST', '/groups', groupData);
        console.log('Group created:', createdGroup);

        results.created.push({
          id: createdGroup.id,
          name: createdGroup.name,
          full_path: createdGroup.full_path,
        });

        // 중첩된 서브그룹 생성
        if (group.subgroups && group.subgroups.length > 0) {
          await createSubgroupsRecursive(req, group.subgroups, createdGroup.id, createdGroup.full_path, {
            results,
            defaultSettings,
            apiDelay,
            skipExisting,
            continueOnError,
          });
        }
      }

      // API rate limiting
      await delay(apiDelay);

    } catch (error) {
      results.failed.push({
        name: group.name,
        path: group.path,
        error: error.response?.data?.message || error.message,
      });

      if (!continueOnError) {
        throw error;
      }
    }
  }
}

// 계층적 서브그룹 생성
router.post('/subgroups', async (req, res) => {
  try {
    console.log('Bulk subgroups request:', req.body);
    const { parentId, subgroups, defaults = {}, options = {} } = req.body;

    if (!parentId || !subgroups) {
      return res.status(400).json({ error: 'parentId and subgroups are required' });
    }

    const results = {
      created: [],
      skipped: [],
      failed: [],
      total: 0,
    };

    // 기본 설정
    const defaultSettings = {
      visibility: 'private',
      request_access_enabled: true,
      project_creation_level: 'developer',
      subgroup_creation_level: 'maintainer',
      ...defaults,
    };

    const apiDelay = options.apiDelay || API_RATE_LIMIT.DEFAULT_DELAY;
    const skipExisting = options.skipExisting !== false;
    const continueOnError = options.continueOnError !== false;

    // 부모 그룹 정보 가져오기
    let parentPath = '';
    try {
      const parentGroup = await gitlabRequest(req, 'GET', `/groups/${parentId}`);
      parentPath = parentGroup.full_path;
      console.log('Parent group found:', { id: parentId, full_path: parentPath });
    } catch (error) {
      console.error('Failed to get parent group:', error.message);
      return res.status(400).json({ error: 'Invalid parent group ID' });
    }

    // 서브그룹 생성 시작
    console.log('Creating subgroups with:', {
      parentId,
      parentPath,
      subgroupsCount: subgroups.length,
      defaultSettings,
      options: { apiDelay, skipExisting, continueOnError },
    });

    await createSubgroupsRecursive(req, subgroups, parentId, parentPath, {
      results,
      defaultSettings,
      apiDelay,
      skipExisting,
      continueOnError,
    });

    console.log('Subgroups creation results:', results);

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        created: results.created.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to create subgroups',
      message: error.response?.data?.message || error.message,
    });
  }
});

// 대량 프로젝트 생성
router.post('/projects', async (req, res) => {
  try {
    const { projects, defaults = {}, branchProtection = {}, ciVariables = {} } = req.body;

    if (!projects || !Array.isArray(projects)) {
      return res.status(400).json({ error: 'projects array is required' });
    }

    const results = {
      created: [],
      skipped: [],
      failed: [],
      total: 0,
    };

    const defaultSettings = {
      visibility: 'private',
      default_branch: 'main',
      initialize_with_readme: true,
      ...defaults,
    };

    for (const projectGroup of projects) {
      const { group_id, projects: groupProjects } = projectGroup;

      for (const project of groupProjects) {
        results.total++;

        try {
          // 프로젝트 생성
          const projectData = {
            name: project.name,
            namespace_id: group_id,
            ...defaultSettings,
            ...project.settings,
            description: project.description,
            topics: project.topics,
          };

          const createdProject = await gitlabRequest(req, 'POST', '/projects', projectData);

          results.created.push({
            id: createdProject.id,
            name: createdProject.name,
            path_with_namespace: createdProject.path_with_namespace,
          });

          // 브랜치 보호 규칙 설정
          if (branchProtection.default) {
            const branchName = branchProtection.default.branch || 'main';
            await gitlabRequest(req, 'POST', `/projects/${createdProject.id}/protected_branches`, {
              name: branchName,
              push_access_level: branchProtection.default.push_access_level || 30,
              merge_access_level: branchProtection.default.merge_access_level || 40,
            });
          }

          // CI/CD 변수 설정
          if (ciVariables.global) {
            for (const variable of ciVariables.global) {
              await gitlabRequest(req, 'POST', `/projects/${createdProject.id}/variables`, {
                key: variable.key,
                value: variable.value,
                protected: variable.protected || false,
              });
            }
          }

          await delay(API_RATE_LIMIT.DEFAULT_DELAY);

        } catch (error) {
          results.failed.push({
            name: project.name,
            error: error.response?.data?.message || error.message,
          });
        }
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        created: results.created.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error is handled by error middleware
    res.status(500).json({
      error: 'Failed to create projects',
      message: error.response?.data?.message || error.message,
    });
  }
});

// GitLab 상태 점검
router.get('/health-check', async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      status: 'checking',
      components: {},
    };

    // 사용자 정보 확인
    try {
      const user = await gitlabRequest(req, 'GET', '/user');
      healthData.components.authentication = {
        status: 'healthy',
        username: user.username,
        isAdmin: user.is_admin,
      };
    } catch (error) {
      healthData.components.authentication = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // 프로젝트 통계
    try {
      const projects = await gitlabRequest(req, 'GET', '/projects?per_page=1', null, true);
      healthData.components.projects = {
        status: 'healthy',
        totalCount: parseInt(projects.headers?.['x-total'] || '0'),
      };
    } catch (error) {
      healthData.components.projects = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // 그룹 통계
    try {
      const groups = await gitlabRequest(req, 'GET', '/groups?per_page=1', null, true);
      healthData.components.groups = {
        status: 'healthy',
        totalCount: parseInt(groups.headers?.['x-total'] || '0'),
      };
    } catch (error) {
      healthData.components.groups = {
        status: 'unhealthy',
        error: error.message,
      };
    }

    // API rate limit 확인
    try {
      const baseURL = req.session.gitlabUrl || GITLAB_CONFIG.DEFAULT_URL;
      const response = await axios.get(`${baseURL}${GITLAB_CONFIG.API_VERSION}/version`, {
        headers: {
          'PRIVATE-TOKEN': req.session.gitlabToken,
        },
      });

      healthData.components.rateLimit = {
        status: 'healthy',
        limit: response.headers['ratelimit-limit'] || response.headers['x-ratelimit-limit'],
        remaining: response.headers['ratelimit-remaining'] || response.headers['x-ratelimit-remaining'],
        reset: response.headers['ratelimit-reset'] || response.headers['x-ratelimit-reset'],
      };
    } catch (error) {
      healthData.components.rateLimit = {
        status: 'unknown',
        error: error.message,
      };
    }

    // 전체 상태 결정
    const unhealthyComponents = Object.values(healthData.components)
      .filter((c) => c.status === 'unhealthy').length;

    healthData.status = unhealthyComponents === 0 ? 'healthy' :
      unhealthyComponents < 2 ? 'degraded' : 'unhealthy';

    res.json(healthData);

  } catch (error) {
    // Error logged: 'Health check error:', error);
    res.status(500).json({
      error: 'Failed to perform health check',
      message: error.message,
    });
  }
});

// YAML 파싱 엔드포인트
router.post('/parse-yaml', (req, res) => {
  try {
    const { content } = req.body;
    const parsed = yaml.load(content);
    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid YAML format',
      message: error.message,
    });
  }
});

// Bulk Push Rules 설정
router.post('/settings/push-rules', async (req, res) => {
  try {
    const { projectIds, rules } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'projectIds array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: projectIds.length,
    };

    for (const projectId of projectIds) {
      try {
        // GitLab Push Rules API (requires GitLab Premium)
        await gitlabRequest(req, 'PUT', `/projects/${projectId}/push_rule`, {
          deny_delete_tag: rules.deny_delete_tag || false,
          member_check: rules.member_check || false,
          prevent_secrets: rules.prevent_secrets || false,
          commit_message_regex: rules.commit_message_regex || '',
          commit_message_negative_regex: rules.commit_message_negative_regex || '',
          branch_name_regex: rules.branch_name_regex || '',
          author_email_regex: rules.author_email_regex || '',
          file_name_regex: rules.file_name_regex || '',
          max_file_size: rules.max_file_size || 0,
          commit_committer_check: rules.commit_committer_check || false,
          reject_unsigned_commits: rules.reject_unsigned_commits || false,
        });

        results.success.push(projectId);
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          projectId,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error logged: 'Bulk push rules error:', error);
    res.status(500).json({
      error: 'Failed to set push rules',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Protected Branches 설정
router.post('/settings/protected-branches', async (req, res) => {
  try {
    const { projectIds, branches } = req.body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'projectIds array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: projectIds.length,
    };

    for (const projectId of projectIds) {
      try {
        // Delete existing protected branches if requested
        if (branches.deleteExisting) {
          const existingBranches = await gitlabRequest(req, 'GET', `/projects/${projectId}/protected_branches`);
          for (const branch of existingBranches) {
            await gitlabRequest(req, 'DELETE', `/projects/${projectId}/protected_branches/${encodeURIComponent(branch.name)}`);
          }
        }

        // Add new protected branches
        for (const branch of branches.rules || []) {
          await gitlabRequest(req, 'POST', `/projects/${projectId}/protected_branches`, {
            name: branch.name,
            push_access_level: branch.push_access_level || 40, // Maintainer
            merge_access_level: branch.merge_access_level || 40, // Maintainer
            unprotect_access_level: branch.unprotect_access_level || 40,
            allow_force_push: branch.allow_force_push || false,
            code_owner_approval_required: branch.code_owner_approval_required || false,
          });
        }

        results.success.push(projectId);
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          projectId,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error logged: 'Bulk protected branches error:', error);
    res.status(500).json({
      error: 'Failed to set protected branches',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Visibility 설정
router.post('/settings/visibility', async (req, res) => {
  try {
    const { items, visibility } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    if (!['private', 'internal', 'public'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility level' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    for (const item of items) {
      try {
        const endpoint = item.type === 'group'
          ? `/groups/${item.id}`
          : `/projects/${item.id}`;

        await gitlabRequest(req, 'PUT', endpoint, { visibility });

        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
        });
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error logged: 'Bulk visibility error:', error);
    res.status(500).json({
      error: 'Failed to set visibility',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Access Levels 설정
router.post('/settings/access-levels', async (req, res) => {
  try {
    const { items, settings } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    for (const item of items) {
      try {
        if (item.type === 'group') {
          // Update group settings
          const updates = {};
          if (settings.project_creation_level) {
            updates.project_creation_level = settings.project_creation_level;
          }
          if (settings.subgroup_creation_level) {
            updates.subgroup_creation_level = settings.subgroup_creation_level;
          }
          if (settings.request_access_enabled !== undefined) {
            updates.request_access_enabled = settings.request_access_enabled;
          }

          await gitlabRequest(req, 'PUT', `/groups/${item.id}`, updates);
        } else {
          // Update project settings
          const updates = {};
          if (settings.issues_access_level) {
            updates.issues_access_level = settings.issues_access_level;
          }
          if (settings.merge_requests_access_level) {
            updates.merge_requests_access_level = settings.merge_requests_access_level;
          }
          if (settings.wiki_access_level) {
            updates.wiki_access_level = settings.wiki_access_level;
          }
          if (settings.snippets_access_level) {
            updates.snippets_access_level = settings.snippets_access_level;
          }

          await gitlabRequest(req, 'PUT', `/projects/${item.id}`, updates);
        }

        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
        });
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error logged: 'Bulk access levels error:', error);
    res.status(500).json({
      error: 'Failed to set access levels',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Namespace Move (Transfer)
router.post('/transfer', async (req, res) => {
  try {
    const { items, targetNamespaceId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    if (!targetNamespaceId) {
      return res.status(400).json({ error: 'targetNamespaceId is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    // Verify target namespace exists
    try {
      await gitlabRequest(req, 'GET', `/namespaces/${targetNamespaceId}`);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid target namespace ID' });
    }

    for (const item of items) {
      const numericId = extractNumericId(item.id);
      const numericTargetNamespaceId = extractNumericId(targetNamespaceId);

      if (!numericId) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Invalid ID',
        });
        continue;
      }

      try {
        console.log(`[Transfer] Processing item:`, {
          id: item.id,
          numericId,
          name: item.name,
          type: item.type,
          targetNamespaceId: numericTargetNamespaceId
        });

        if (item.type === 'project') {
          // Transfer project - GitLab expects 'namespace' parameter, not 'namespace_id'
          const transferData = {
            namespace: numericTargetNamespaceId,
          };
          console.log(`[Transfer] Calling PUT /projects/${numericId}/transfer with:`, transferData);

          const result = await gitlabRequest(req, 'PUT', `/projects/${numericId}/transfer`, transferData);
          console.log(`[Transfer] Project ${numericId} transfer result:`, result?.data || result);
        } else if (item.type === 'group') {
          // Transfer group
          const transferData = {
            group_id: numericTargetNamespaceId,
          };
          console.log(`[Transfer] Calling POST /groups/${numericId}/transfer with:`, transferData);

          const result = await gitlabRequest(req, 'POST', `/groups/${numericId}/transfer`, transferData);
          console.log(`[Transfer] Group ${numericId} transfer result:`, result?.data || result);
        } else {
          throw new Error('Invalid item type. Must be "project" or "group"');
        }

        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
          newNamespaceId: targetNamespaceId,
        });
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    // Error logged: 'Bulk transfer error:', error);
    res.status(500).json({
      error: 'Failed to transfer items',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Helper: Extract numeric ID from string like "project-123" or "group-456"
function extractNumericId(id) {
  if (typeof id === 'number') return id;
  if (typeof id === 'string') {
    // Handle "project-123" or "group-456" format
    const match = id.match(/(?:project-|group-)?(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }
  return null;
}

// Bulk Archive
router.post('/archive', async (req, res) => {
  try {
    const { items } = req.body;
    console.log('[ARCHIVE] Received items:', JSON.stringify(items, null, 2));

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    for (const item of items) {
      console.log('[ARCHIVE] Processing item:', item.id, 'type:', item.type);
      if (item.type !== 'project') {
        console.log('[ARCHIVE] Skipping non-project:', item.id);
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Only projects can be archived',
        });
        continue;
      }

      const numericId = extractNumericId(item.id);
      console.log('[ARCHIVE] Extracted numericId:', numericId, 'from:', item.id);
      if (!numericId) {
        console.log('[ARCHIVE] Invalid ID, skipping:', item.id);
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Invalid project ID',
        });
        continue;
      }

      try {
        console.log('[ARCHIVE] Archiving project:', numericId);
        // GitLab API uses POST /projects/:id/archive endpoint, not PUT with archived param
        await gitlabRequest(req, 'POST', `/projects/${numericId}/archive`);
        console.log('[ARCHIVE] Successfully archived:', numericId);
        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
        });
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        console.log('[ARCHIVE] Error archiving:', numericId, error.response?.data?.message || error.message);
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    console.log('[ARCHIVE] Final results:', JSON.stringify(results, null, 2));
    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to archive items',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Unarchive
router.post('/unarchive', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    for (const item of items) {
      if (item.type !== 'project') {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Only projects can be unarchived',
        });
        continue;
      }

      const numericId = extractNumericId(item.id);
      if (!numericId) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Invalid project ID',
        });
        continue;
      }

      try {
        // GitLab API uses POST /projects/:id/unarchive endpoint
        await gitlabRequest(req, 'POST', `/projects/${numericId}/unarchive`);
        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
        });
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to unarchive items',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Clone
router.post('/clone', async (req, res) => {
  try {
    const { items, suffix = '_copy' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    for (const item of items) {
      const numericId = extractNumericId(item.id);
      if (!numericId) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Invalid ID',
        });
        continue;
      }

      try {
        if (item.type === 'project') {
          const project = await gitlabRequest(req, 'GET', `/projects/${numericId}`);
          const newProject = await gitlabRequest(req, 'POST', '/projects', {
            name: project.name + suffix,
            path: project.path + suffix.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            namespace_id: project.namespace.id,
            visibility: project.visibility,
            description: project.description,
          });
          results.success.push({
            id: newProject.id,
            name: newProject.name,
            type: 'project',
            original_id: item.id,
          });
        } else {
          const group = await gitlabRequest(req, 'GET', `/groups/${numericId}`);
          const newGroup = await gitlabRequest(req, 'POST', '/groups', {
            name: group.name + suffix,
            path: group.path + suffix.toLowerCase().replace(/[^a-z0-9-]/g, ''),
            parent_id: group.parent_id,
            visibility: group.visibility,
            description: group.description,
          });
          results.success.push({
            id: newGroup.id,
            name: newGroup.name,
            type: 'group',
            original_id: item.id,
          });
        }
        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to clone items',
      message: error.response?.data?.message || error.message,
    });
  }
});

// Bulk Delete
router.post('/delete', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const results = {
      success: [],
      failed: [],
      total: items.length,
    };

    // Sort items to delete projects before groups
    const sortedItems = [...items].sort((a, b) => {
      if (a.type === 'project' && b.type === 'group') {return -1;}
      if (a.type === 'group' && b.type === 'project') {return 1;}
      return 0;
    });

    for (const item of sortedItems) {
      const numericId = extractNumericId(item.id);
      if (!numericId) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: 'Invalid ID',
        });
        continue;
      }

      try {
        const endpoint = item.type === 'group'
          ? `/groups/${numericId}`
          : `/projects/${numericId}`;

        await gitlabRequest(req, 'DELETE', endpoint);

        results.success.push({
          id: item.id,
          name: item.name,
          type: item.type,
        });

        await delay(API_RATE_LIMIT.DEFAULT_DELAY);
      } catch (error) {
        results.failed.push({
          id: item.id,
          name: item.name,
          type: item.type,
          error: error.response?.data?.message || error.message,
        });
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        success: results.success.length,
        failed: results.failed.length,
      },
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to delete items',
      message: error.response?.data?.message || error.message,
    });
  }
});

export default router;