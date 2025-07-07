import gitlabReducer, { setGroups, setProjects, setUsers } from '../gitlabSlice';
import { GitLabGroup, GitLabProject, GitLabUser } from '../../../types/gitlab';

describe('gitlabSlice', () => {
  const initialState = {
    groups: [],
    projects: [],
    users: [],
  };

  const mockGroup: GitLabGroup = {
    id: 1,
    name: 'Test Group',
    path: 'test-group',
    visibility: 'private',
    share_with_group_lock: false,
    require_two_factor_authentication: false,
    two_factor_grace_period: 0,
    project_creation_level: 'developer',
    auto_devops_enabled: false,
    subgroup_creation_level: 'owner',
    emails_disabled: false,
    mentions_disabled: false,
    lfs_enabled: true,
    default_branch_protection: 2,
    avatar_url: null,
    web_url: 'https://gitlab.com/test-group',
    request_access_enabled: true,
    full_name: 'Test Group',
    full_path: 'test-group',
    file_template_project_id: null,
    parent_id: null,
    created_at: '2023-01-01T00:00:00Z',
  };

  const mockProject: GitLabProject = {
    id: 1,
    name: 'Test Project',
    path: 'test-project',
    visibility: 'private',
    path_with_namespace: 'test-group/test-project',
    namespace: {
      id: 1,
      name: 'Test Group',
      path: 'test-group',
      kind: 'group',
      full_path: 'test-group',
    },
    created_at: '2023-01-01T00:00:00Z',
    default_branch: 'main',
    http_url_to_repo: 'https://gitlab.com/test-group/test-project.git',
    web_url: 'https://gitlab.com/test-group/test-project',
    avatar_url: null,
    star_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    issues_enabled: true,
    merge_requests_enabled: true,
    wiki_enabled: true,
    jobs_enabled: true,
    snippets_enabled: true,
    container_registry_enabled: true,
    archived: false,
  };

  const mockUser: GitLabUser = {
    id: 1,
    username: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: 'https://example.com/avatar.png',
    web_url: 'https://gitlab.com/testuser',
    created_at: '2023-01-01T00:00:00Z',
    state: 'active',
  };

  it('should handle initial state', () => {
    expect(gitlabReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  it('should handle setGroups', () => {
    const groups = [mockGroup];
    const state = gitlabReducer(initialState, setGroups(groups));
    
    expect(state.groups).toEqual(groups);
    expect(state.projects).toEqual([]);
    expect(state.users).toEqual([]);
  });

  it('should handle setProjects', () => {
    const projects = [mockProject];
    const state = gitlabReducer(initialState, setProjects(projects));
    
    expect(state.groups).toEqual([]);
    expect(state.projects).toEqual(projects);
    expect(state.users).toEqual([]);
  });

  it('should handle setUsers', () => {
    const users = [mockUser];
    const state = gitlabReducer(initialState, setUsers(users));
    
    expect(state.groups).toEqual([]);
    expect(state.projects).toEqual([]);
    expect(state.users).toEqual(users);
  });
});