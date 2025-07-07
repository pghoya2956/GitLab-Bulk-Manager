import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GitLabGroup, GitLabProject, GitLabUser } from '../../types/gitlab';

interface GitLabState {
  groups: GitLabGroup[];
  projects: GitLabProject[];
  users: GitLabUser[];
}

const initialState: GitLabState = {
  groups: [],
  projects: [],
  users: [],
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
  },
});

export const { setGroups, setProjects, setUsers } = gitlabSlice.actions;
export default gitlabSlice.reducer;