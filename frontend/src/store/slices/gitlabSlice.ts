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
}

const initialState: GitLabState = {
  groups: [],
  projects: [],
  users: [],
  loading: false,
  error: null,
  showArchived: 'false',
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
  },
});

export const { setGroups, setProjects, setUsers, setLoading, setError, setShowArchived } = gitlabSlice.actions;
export default gitlabSlice.reducer;