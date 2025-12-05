// Helper functions to get auth data from Redux store
// These will be connected to Redux store

export const getAuthToken = (): string | null => {
  // This will be replaced with Redux selector
  // For now, check localStorage (temporary)
  const persistedAuth = localStorage.getItem('persist:auth');
  if (persistedAuth) {
    try {
      const auth = JSON.parse(persistedAuth);
      const token = JSON.parse(auth.token || '""');
      return token || null;
    } catch {
      return null;
    }
  }
  return null;
};

export const getGitLabUrl = (): string | null => {
  // This will be replaced with Redux selector
  // For now, check localStorage (temporary)
  const persistedAuth = localStorage.getItem('persist:auth');
  if (persistedAuth) {
    try {
      const auth = JSON.parse(persistedAuth);
      const url = JSON.parse(auth.gitlabUrl || '""');
      return url || null;
    } catch {
      return null;
    }
  }
  return null;
};