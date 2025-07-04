import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import gitlabReducer from './slices/gitlabSlice';
import jobsReducer from './slices/jobsSlice';
import uiReducer from './slices/uiSlice';
import notificationReducer from './slices/notificationSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    gitlab: gitlabReducer,
    jobs: jobsReducer,
    ui: uiReducer,
    notifications: notificationReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;