import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider, useSelector } from 'react-redux';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';

import { store } from './store';
import { theme } from './theme';
import { Layout } from './components/Layout';
import { GroupsProjects } from './pages/GroupsProjects';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { PrivateRoute } from './components/PrivateRoute';
import { SystemHealth } from './pages/SystemHealth';
import { Documentation } from './pages/Documentation';
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
                    <Route index element={<Navigate to="/groups-projects" replace />} />
                    <Route path="dashboard" element={<Navigate to="/groups-projects" replace />} />
                    <Route path="groups" element={<Navigate to="/groups-projects" replace />} />
                    <Route path="projects" element={<Navigate to="/groups-projects" replace />} />
                    <Route path="groups-projects" element={<GroupsProjects />} />
                    <Route path="bulk-operations" element={<Navigate to="/groups-projects" replace />} />
                    <Route path="bulk-import" element={<Navigate to="/groups-projects" replace />} />
                    <Route path="monitoring" element={<Navigate to="/system-health" replace />} />
                    <Route path="system-health" element={<SystemHealth />} />
                    <Route path="settings" element={<Settings />} />
                    <Route path="docs" element={<Documentation />} />
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