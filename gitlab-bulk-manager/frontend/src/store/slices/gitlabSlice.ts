import { createSlice } from '@reduxjs/toolkit';

interface GitLabState {
  groups: any[];
  projects: any[];
  users: any[];
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
    setGroups: (state, action) => {
      state.groups = action.payload;
    },
    setProjects: (state, action) => {
      state.projects = action.payload;
    },
    setUsers: (state, action) => {
      state.users = action.payload;
    },
  },
});

export const { setGroups, setProjects, setUsers } = gitlabSlice.actions;
export default gitlabSlice.reducer;