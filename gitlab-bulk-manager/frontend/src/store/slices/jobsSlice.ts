import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

interface JobDetail {
  message: string;
  timestamp: Date;
}

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  startTime: Date;
  endTime?: Date;
  details: JobDetail[];
  totalItems?: number;
  processedItems?: number;
  errors?: string[];
}

interface JobsState {
  jobs: Job[];
}

const initialState: JobsState = {
  jobs: [],
};

const jobsSlice = createSlice({
  name: 'jobs',
  initialState,
  reducers: {
    addJob: (state, action: PayloadAction<Job>) => {
      state.jobs.unshift(action.payload);
    },
    updateJob: (state, action: PayloadAction<Partial<Job> & { id: string }>) => {
      const index = state.jobs.findIndex(job => job.id === action.payload.id);
      if (index !== -1) {
        state.jobs[index] = { ...state.jobs[index], ...action.payload };
      }
    },
    removeJob: (state, action: PayloadAction<string>) => {
      state.jobs = state.jobs.filter(job => job.id !== action.payload);
    },
    clearJobs: (state) => {
      state.jobs = [];
    },
  },
});

export const { addJob, updateJob, removeJob, clearJobs } = jobsSlice.actions;
export default jobsSlice.reducer;