import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GitLabGroup, GitLabProject, GitLabUser } from '../../types/gitlab';

export type ArchivedFilter = 'false' | 'true' | 'both';

export interface GitLabState {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  users: GitLabUser[];
  loading: boolean;
  error: string | null;
  showArchived: ArchivedFilter;
  // Lazy loading state
  loadedGroupChildren: Record<number, boolean>; // groupId -> children loaded
  loadingGroupChildren: Record<number, boolean>; // groupId -> currently loading
}

const initialState: GitLabState = {
  groups: [],
  projects: [],
  users: [],
  loading: false,
  error: null,
  showArchived: 'false',
  loadedGroupChildren: {},
  loadingGroupChildren: {},
};

const gitlabSlice = createSlice({
  name: 'gitlab',
  initialState,
  reducers: {
    setGroups: (state, action: PayloadAction<GitLabGroup[]>) => {
      state.groups = action.payload;
    },
    setProjects: (state, action: PayloadAction<GitLabProject[]>) => {
      state.projects = action.payload;
    },
    setUsers: (state, action: PayloadAction<GitLabUser[]>) => {
      state.users = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setShowArchived: (state, action: PayloadAction<ArchivedFilter>) => {
      state.showArchived = action.payload;
    },
    // Lazy loading actions
    setLoadingGroupChildren: (state, action: PayloadAction<{ groupId: number; loading: boolean }>) => {
      state.loadingGroupChildren[action.payload.groupId] = action.payload.loading;
    },
    addSubgroups: (state, action: PayloadAction<{ parentId: number; subgroups: GitLabGroup[] }>) => {
      const { parentId, subgroups } = action.payload;
      // Add subgroups that don't already exist
      const existingIds = new Set(state.groups.map(g => g.id));
      const newSubgroups = subgroups.filter(g => !existingIds.has(g.id));
      state.groups = [...state.groups, ...newSubgroups];
      state.loadedGroupChildren[parentId] = true;
      state.loadingGroupChildren[parentId] = false;
    },
    addGroupProjects: (state, action: PayloadAction<{ groupId: number; projects: GitLabProject[] }>) => {
      const { groupId, projects } = action.payload;
      // Add projects that don't already exist
      const existingIds = new Set(state.projects.map(p => p.id));
      const newProjects = projects.filter(p => !existingIds.has(p.id));
      state.projects = [...state.projects, ...newProjects];
      state.loadedGroupChildren[groupId] = true;
      state.loadingGroupChildren[groupId] = false;
    },
    resetLazyLoadState: (state) => {
      state.loadedGroupChildren = {};
      state.loadingGroupChildren = {};
    },
  },
});

export const {
  setGroups,
  setProjects,
  setUsers,
  setLoading,
  setError,
  setShowArchived,
  setLoadingGroupChildren,
  addSubgroups,
  addGroupProjects,
  resetLazyLoadState,
} = gitlabSlice.actions;
export default gitlabSlice.reducer;