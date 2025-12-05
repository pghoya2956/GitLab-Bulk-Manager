import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import type { RootState, AppDispatch } from './index';

// Base hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Selection hooks
export const useSelection = () => {
  const dispatch = useAppDispatch();
  const selection = useAppSelector(state => state.selection);
  
  const selectItems = useCallback((items: any[]) => {
    dispatch({ type: 'selection/setSelectedItems', payload: items });
  }, [dispatch]);
  
  const toggleItem = useCallback((item: any) => {
    dispatch({ type: 'selection/toggleItemSelection', payload: item });
  }, [dispatch]);
  
  const clearSelection = useCallback(() => {
    dispatch({ type: 'selection/clearSelection' });
  }, [dispatch]);
  
  return {
    selectedItems: selection.selectedItems,
    selectedCount: selection.selectedItems.length,
    selectItems,
    toggleItem,
    clearSelection,
  };
};

// History hooks
export const useHistory = () => {
  const dispatch = useAppDispatch();
  const history = useAppSelector(state => state.history);
  
  const addHistoryAction = useCallback((action: any) => {
    dispatch({ type: 'history/addAction', payload: action });
  }, [dispatch]);
  
  const undo = useCallback(() => {
    dispatch({ type: 'history/undo' });
  }, [dispatch]);
  
  const redo = useCallback(() => {
    dispatch({ type: 'history/redo' });
  }, [dispatch]);
  
  return {
    actions: history.actions,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    addHistoryAction,
    undo,
    redo,
  };
};

// Bulk operations hooks
export const useBulkOperations = () => {
  const dispatch = useAppDispatch();
  const bulkOperations = useAppSelector(state => state.bulkOperations);

  const startOperation = useCallback((operation: any) => {
    dispatch({ type: 'bulkOperations/startOperation', payload: operation });
  }, [dispatch]);

  const updateProgress = useCallback((id: string, progress: number) => {
    dispatch({
      type: 'bulkOperations/updateOperationProgress',
      payload: { id, progress }
    });
  }, [dispatch]);

  const completeOperation = useCallback((id: string, result?: any) => {
    dispatch({
      type: 'bulkOperations/completeOperation',
      payload: { id, result }
    });
  }, [dispatch]);

  const failOperation = useCallback((id: string, error: string) => {
    dispatch({
      type: 'bulkOperations/failOperation',
      payload: { id, error }
    });
  }, [dispatch]);

  const clearCurrentOperation = useCallback(() => {
    dispatch({ type: 'bulkOperations/setCurrentOperation', payload: null });
  }, [dispatch]);

  return {
    activeOperations: bulkOperations.activeOperations,
    currentOperation: bulkOperations.currentOperation,
    loading: bulkOperations.loading,
    error: bulkOperations.error,
    startOperation,
    updateProgress,
    completeOperation,
    failOperation,
    clearCurrentOperation,
  };
};

// Auth hooks
export const useAuth = () => {
  const auth = useAppSelector(state => state.auth);
  return {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    token: auth.token,
    gitlabUrl: auth.gitlabUrl,
  };
};

// GitLab data hooks
export const useGitLabData = () => {
  const gitlab = useAppSelector(state => state.gitlab);
  return {
    groups: gitlab.groups,
    projects: gitlab.projects,
    loading: gitlab.loading,
    error: gitlab.error,
  };
};

// UI state hooks
export const useUIState = () => {
  const dispatch = useAppDispatch();
  const ui = useAppSelector(state => state.ui);
  
  const setTheme = useCallback((theme: 'light' | 'dark') => {
    dispatch({ type: 'ui/setTheme', payload: theme });
  }, [dispatch]);
  
  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'ui/toggleSidebar' });
  }, [dispatch]);
  
  return {
    theme: ui.theme,
    sidebarOpen: ui.sidebarOpen,
    dialogs: ui.dialogs,
    setTheme,
    toggleSidebar,
  };
};