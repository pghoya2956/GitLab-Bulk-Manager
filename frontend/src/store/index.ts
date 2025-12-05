import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slices
import authReducer from './slices/authSlice';
import gitlabReducer from './slices/gitlabSlice';
import jobsReducer from './slices/jobsSlice';
import uiReducer from './slices/uiSlice';
import notificationReducer from './slices/notificationSlice';
import selectionReducer from './slices/selectionSlice';
import historyReducer from './slices/historySlice';
import bulkOperationsReducer from './slices/bulkOperationsSlice';

// Persist configurations
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['token', 'gitlabUrl', 'user', 'isAuthenticated'],
};

const gitlabPersistConfig = {
  key: 'gitlab',
  storage,
  whitelist: ['groups', 'projects', 'lastFetch', 'cache'],
  blacklist: ['loading', 'error'],
};

const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['theme', 'sidebarOpen', 'treeExpanded', 'preferences'],
  blacklist: ['dialogs', 'activeTab'],
};

const historyPersistConfig = {
  key: 'history',
  storage,
  whitelist: ['actions'],
  blacklist: ['currentIndex', 'canUndo', 'canRedo'],
};

// Root reducer with persist
const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  gitlab: persistReducer(gitlabPersistConfig, gitlabReducer),
  jobs: jobsReducer, // Not persisted - real-time data
  ui: persistReducer(uiPersistConfig, uiReducer),
  notifications: notificationReducer, // Not persisted
  selection: selectionReducer, // Not persisted - session only
  history: persistReducer(historyPersistConfig, historyReducer),
  bulkOperations: bulkOperationsReducer, // Not persisted - real-time
});

// Create store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        ignoredPaths: ['jobs.activeJobs'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;