import express from 'express';
import axios from 'axios';
import yaml from 'js-yaml';

const router = express.Router();

// Rate limiting 설정
const DEFAULT_API_DELAY = 200; // milliseconds
const MAX_RETRIES = 3;

// Helper: API 호출 지연
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: 재시도 로직
async function retryRequest(fn, retries = MAX_RETRIES) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries || error.response?.status < 500) {
        throw error;
      }
      await delay(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}

// Helper: GitLab API 호출
async function gitlabRequest(req, method, path, data = null, includeHeaders = false) {
  const token = req.session.gitlabToken;
  const baseURL = req.session.gitlabUrl || process.env.GITLAB_API_URL || 'https://gitlab.com';
  
  return retryRequest(async () => {
    const response = await axios({
      method,
      url: `${baseURL}/api/v4${path}`,
      headers: {
        'PRIVATE-TOKEN': token,
        'Content-Type': 'application/json'
      },
      data
    });
    
    if (includeHeaders) {
      return {
        data: response.data,
        headers: response.headers
      };
    }
    return response.data;
  });
}

// 계층적 서브그룹 생성
router.post('/subgroups', async (req, res) => {
  try {
    const { parentId, subgroups, defaults = {}, options = {} } = req.body;
    
    if (!parentId || !subgroups) {
      return res.status(400).json({ error: 'parentId and subgroups are required' });
    }

    const results = {
      created: [],
      skipped: [],
      failed: [],
      total: 0
    };

    // 기본 설정
    const defaultSettings = {
      visibility: 'private',
      request_access_enabled: true,
      project_creation_level: 'developer',
      subgroup_creation_level: 'maintainer',
      ...defaults
    };

    const apiDelay = options.apiDelay || DEFAULT_API_DELAY;
    const skipExisting = options.skipExisting !== false;
    const continueOnError = options.continueOnError !== false;

    // 재귀적으로 서브그룹 생성
    async function createSubgroupsRecursive(groups, parentId, parentPath = '') {
      for (const group of groups) {
        results.total++;
        
        try {
          // 기존 그룹 확인
          let existingGroup = null;
          if (skipExisting) {
            try {
              const searchPath = parentPath ? `${parentPath}/${group.path}` : group.path;
              existingGroup = await gitlabRequest(req, 'GET', `/groups/${encodeURIComponent(searchPath)}`);
            } catch (error) {
              // 그룹이 없으면 생성 진행
            }
          }

          if (existingGroup) {
            results.skipped.push({
              name: group.name,
              path: group.path,
              reason: 'Already exists'
            });
          } else {
            // 그룹 생성
            const groupData = {
              name: group.name,
              path: group.path,
              parent_id: parentId,
              ...defaultSettings,
              ...group.settings,
              description: group.description
            };

            const createdGroup = await gitlabRequest(req, 'POST', '/groups', groupData);
            
            results.created.push({
              id: createdGroup.id,
              name: createdGroup.name,
              full_path: createdGroup.full_path
            });

            // 중첩된 서브그룹 생성
            if (group.subgroups && group.subgroups.length > 0) {
              await createSubgroupsRecursive(
                group.subgroups, 
                createdGroup.id,
                createdGroup.full_path
              );
            }
          }

          // API rate limiting
          await delay(apiDelay);
          
        } catch (error) {
          results.failed.push({
            name: group.name,
            path: group.path,
            error: error.response?.data?.message || error.message
          });
          
          if (!continueOnError) {
            throw error;
          }
        }
      }
    }

    // 서브그룹 생성 시작
    await createSubgroupsRecursive(subgroups, parentId);

    res.json({
      success: true,
      results,
      summary: {
        total: results.total,
        created: results.created.length,
        skipped: results.skipped.length,
        failed: results.failed.length
      }
    });

  } catch (error) {
    console.error('Bulk subgroups creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create subgroups',
      message: error.response?.data?.message || error.message
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
      total: 0
    };

    const defaultSettings = {
      visibility: 'private',
      default_branch: 'main',
      initialize_with_readme: true,
      ...defaults
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
            topics: project.topics
          };

          const createdProject = await gitlabRequest(req, 'POST', '/projects', projectData);
          
          results.created.push({
            id: createdProject.id,
            name: createdProject.name,
            path_with_namespace: createdProject.path_with_namespace
          });

          // 브랜치 보호 규칙 설정
          if (branchProtection.default) {
            const branchName = branchProtection.default.branch || 'main';
            await gitlabRequest(req, 'POST', `/projects/${createdProject.id}/protected_branches`, {
              name: branchName,
              push_access_level: branchProtection.default.push_access_level || 30,
              merge_access_level: branchProtection.default.merge_access_level || 40
            });
          }

          // CI/CD 변수 설정
          if (ciVariables.global) {
            for (const variable of ciVariables.global) {
              await gitlabRequest(req, 'POST', `/projects/${createdProject.id}/variables`, {
                key: variable.key,
                value: variable.value,
                protected: variable.protected || false
              });
            }
          }

          await delay(DEFAULT_API_DELAY);
          
        } catch (error) {
          results.failed.push({
            name: project.name,
            error: error.response?.data?.message || error.message
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
        failed: results.failed.length
      }
    });

  } catch (error) {
    console.error('Bulk projects creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create projects',
      message: error.response?.data?.message || error.message
    });
  }
});

// GitLab 상태 점검
router.get('/health-check', async (req, res) => {
  try {
    const healthData = {
      timestamp: new Date().toISOString(),
      status: 'checking',
      components: {}
    };

    // 사용자 정보 확인
    try {
      const user = await gitlabRequest(req, 'GET', '/user');
      healthData.components.authentication = {
        status: 'healthy',
        username: user.username,
        isAdmin: user.is_admin
      };
    } catch (error) {
      healthData.components.authentication = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // 프로젝트 통계
    try {
      const projects = await gitlabRequest(req, 'GET', '/projects?per_page=1', null, true);
      healthData.components.projects = {
        status: 'healthy',
        totalCount: parseInt(projects.headers?.['x-total'] || '0')
      };
    } catch (error) {
      healthData.components.projects = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // 그룹 통계
    try {
      const groups = await gitlabRequest(req, 'GET', '/groups?per_page=1', null, true);
      healthData.components.groups = {
        status: 'healthy',
        totalCount: parseInt(groups.headers?.['x-total'] || '0')
      };
    } catch (error) {
      healthData.components.groups = {
        status: 'unhealthy',
        error: error.message
      };
    }

    // API rate limit 확인
    try {
      const response = await axios.get(`${process.env.GITLAB_API_URL || 'https://gitlab.com/api/v4'}/version`, {
        headers: {
          'PRIVATE-TOKEN': req.session.gitlabToken
        }
      });
      
      healthData.components.rateLimit = {
        status: 'healthy',
        limit: response.headers['ratelimit-limit'],
        remaining: response.headers['ratelimit-remaining'],
        reset: response.headers['ratelimit-reset']
      };
    } catch (error) {
      healthData.components.rateLimit = {
        status: 'unknown'
      };
    }

    // 전체 상태 결정
    const unhealthyComponents = Object.values(healthData.components)
      .filter(c => c.status === 'unhealthy').length;
    
    healthData.status = unhealthyComponents === 0 ? 'healthy' : 
                       unhealthyComponents < 2 ? 'degraded' : 'unhealthy';

    res.json(healthData);

  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      error: 'Failed to perform health check',
      message: error.message
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
      message: error.message 
    });
  }
});

export default router;