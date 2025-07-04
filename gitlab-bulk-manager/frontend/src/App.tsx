import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider, useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';

import { store } from './store';
import { theme } from './theme';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { GroupManagement } from './pages/GroupManagement';
import { ProjectManagement } from './pages/ProjectManagement';
import { BulkOperations } from './pages/BulkOperations';
import { Templates } from './pages/Templates';
import { JobMonitoring } from './pages/JobMonitoring';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { DocsLayout } from './pages/docs/DocsLayout';
import { DocsPage } from './pages/docs/DocsPage';
import { PrivateRoute } from './components/PrivateRoute';
import { BackupRestore } from './pages/BackupRestore';
import { Monitoring } from './pages/Monitoring';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WebSocketProvider } from './components/WebSocketProvider';
import './services/axiosConfig';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider maxSnack={3} autoHideDuration={5000}>
              <WebSocketProvider>
                <Router>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route path="groups" element={<GroupManagement />} />
                    <Route path="projects" element={<ProjectManagement />} />
                    <Route path="bulk-operations" element={<BulkOperations />} />
                    <Route path="templates" element={<Templates />} />
                    <Route path="jobs" element={<JobMonitoring />} />
                    <Route path="backup-restore" element={<BackupRestore />} />
                    <Route path="monitoring" element={<Monitoring />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="docs" element={<DocsLayout />}>
                      <Route index element={<Navigate to="/docs/README" replace />} />
                      <Route path=":slug" element={<DocsPage />} />
                    </Route>
                  </Route>
                </Routes>
              </Router>
            </WebSocketProvider>
          </SnackbarProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;