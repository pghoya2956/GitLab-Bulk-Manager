import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GitLabGroup, GitLabProject, GitLabUser } from '../../types/gitlab';

export interface GitLabState {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  users: GitLabUser[];
  loading: boolean;
  error: string | null;
}

const initialState: GitLabState = {
  groups: [],
  projects: [],
  users: [],
  loading: false,
  error: null,
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
  },
});

export const { setGroups, setProjects, setUsers, setLoading, setError } = gitlabSlice.actions;
export default gitlabSlice.reducer;