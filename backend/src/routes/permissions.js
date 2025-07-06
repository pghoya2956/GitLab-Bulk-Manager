import express from 'express';
import axios from 'axios';
import logger from '../utils/logger.js';

const router = express.Router();

// Access level mapping
const ACCESS_LEVELS = {
  10: 'guest',
  20: 'reporter',
  30: 'developer',
  40: 'maintainer',
  50: 'owner'
};

// Get user's permissions across all groups and projects
router.get('/overview', async (req, res) => {
  try {
    const token = req.session.gitlabToken;
    const baseURL = req.session.gitlabUrl || process.env.GITLAB_API_URL || 'https://gitlab.com';
    
    // First, get current user info
    const userResponse = await axios.get(`${baseURL}/api/v4/user`, {
      headers: { 'PRIVATE-TOKEN': token }
    });
    const currentUser = userResponse.data;

    // Get all groups the user has access to
    const groupsResponse = await axios.get(`${baseURL}/api/v4/groups`, {
      headers: { 'PRIVATE-TOKEN': token },
      params: {
        per_page: 100,
        min_access_level: 10, // Guest or higher
        order_by: 'name',
        sort: 'asc'
      }
    });

    const groups = groupsResponse.data;
    
    // Process each group to get member info and projects
    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        try {
          // Get group members count (including inherited members)
          let memberCount = 0;
          try {
            const membersResponse = await axios.get(`${baseURL}/api/v4/groups/${group.id}/members/all`, {
              headers: { 'PRIVATE-TOKEN': token },
              params: { per_page: 1 }
            });
            memberCount = parseInt(membersResponse.headers['x-total'] || '0');
          } catch (error) {
            // If members/all fails (e.g., 404 for subgroups), try regular members endpoint
            if (error.response?.status === 404) {
              try {
                const fallbackResponse = await axios.get(`${baseURL}/api/v4/groups/${group.id}/members`, {
                  headers: { 'PRIVATE-TOKEN': token },
                  params: { per_page: 1 }
                });
                memberCount = parseInt(fallbackResponse.headers['x-total'] || '0');
                logger.warn(`Group ${group.id} members/all returned 404, using direct members count: ${memberCount}`);
              } catch (fallbackError) {
                logger.error(`Failed to get member count for group ${group.id}:`, fallbackError.message);
              }
            } else {
              logger.error(`Failed to get member count for group ${group.id}:`, error.message);
            }
          }

          // Get user's access level in this group
          let userAccess = null;
          try {
            const userMemberResponse = await axios.get(`${baseURL}/api/v4/groups/${group.id}/members/${currentUser.id}`, {
              headers: { 'PRIVATE-TOKEN': token }
            });
            userAccess = {
              access_level: userMemberResponse.data.access_level,
              access_level_name: ACCESS_LEVELS[userMemberResponse.data.access_level] || 'unknown'
            };
          } catch (error) {
            // User might not be a direct member but have inherited access
            userAccess = {
              access_level: group.access_level || 10,
              access_level_name: ACCESS_LEVELS[group.access_level] || 'guest'
            };
          }

          // Get projects in this group
          const projectsResponse = await axios.get(`${baseURL}/api/v4/groups/${group.id}/projects`, {
            headers: { 'PRIVATE-TOKEN': token },
            params: { per_page: 100, include_subgroups: false }
          });

          const projects = await Promise.all(
            projectsResponse.data.map(async (project) => {
              // Get project members count (including inherited members)
              let projectMemberCount = 0;
              try {
                const projectMembersResponse = await axios.get(`${baseURL}/api/v4/projects/${project.id}/members/all`, {
                  headers: { 'PRIVATE-TOKEN': token },
                  params: { per_page: 1 }
                });
                projectMemberCount = parseInt(projectMembersResponse.headers['x-total'] || '0');
              } catch (error) {
                // If members/all fails (e.g., 404), try regular members endpoint
                if (error.response?.status === 404) {
                  try {
                    const fallbackResponse = await axios.get(`${baseURL}/api/v4/projects/${project.id}/members`, {
                      headers: { 'PRIVATE-TOKEN': token },
                      params: { per_page: 1 }
                    });
                    projectMemberCount = parseInt(fallbackResponse.headers['x-total'] || '0');
                    logger.warn(`Project ${project.id} members/all returned 404, using direct members count: ${projectMemberCount}`);
                  } catch (fallbackError) {
                    logger.error(`Failed to get member count for project ${project.id}:`, fallbackError.message);
                  }
                } else {
                  logger.error(`Failed to get member count for project ${project.id}:`, error.message);
                }
              }

              return {
                id: project.id,
                name: project.name,
                path: project.path,
                description: project.description,
                member_count: projectMemberCount,
                visibility: project.visibility,
                user_access: {
                  access_level: project.permissions?.project_access?.access_level || project.permissions?.group_access?.access_level || userAccess.access_level,
                  access_level_name: ACCESS_LEVELS[project.permissions?.project_access?.access_level || project.permissions?.group_access?.access_level || userAccess.access_level] || 'unknown'
                }
              };
            })
          );

          return {
            id: group.id,
            name: group.name,
            full_path: group.full_path,
            description: group.description,
            parent_id: group.parent_id,
            visibility: group.visibility,
            member_count: memberCount,
            user_access: userAccess,
            projects: projects.sort((a, b) => a.name.localeCompare(b.name))
          };
        } catch (error) {
          logger.error(`Failed to get details for group ${group.id}:`, error.message);
          return {
            id: group.id,
            name: group.name,
            full_path: group.full_path,
            error: 'Failed to load details'
          };
        }
      })
    );

    // Build hierarchy
    const buildHierarchy = (groups) => {
      const groupMap = new Map();
      const rootGroups = [];

      // First pass: create map
      groups.forEach(group => {
        groupMap.set(group.id, { ...group, subgroups: [] });
      });

      // Second pass: build hierarchy
      groups.forEach(group => {
        if (group.parent_id) {
          const parent = groupMap.get(group.parent_id);
          if (parent) {
            parent.subgroups.push(groupMap.get(group.id));
          } else {
            rootGroups.push(groupMap.get(group.id));
          }
        } else {
          rootGroups.push(groupMap.get(group.id));
        }
      });

      return rootGroups.sort((a, b) => a.name.localeCompare(b.name));
    };

    const hierarchy = buildHierarchy(groupsWithDetails);

    res.json({
      user: {
        id: currentUser.id,
        username: currentUser.username,
        name: currentUser.name
      },
      groups: hierarchy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Permissions overview error:', error);
    res.status(500).json({
      error: 'Failed to get permissions overview',
      message: error.message
    });
  }
});

export default router;