/**
 * 다이얼로그 상태 관리를 위한 Custom Hook
 * 다중 다이얼로그 관리 및 상태 동기화
 */

import { useState, useCallback, useReducer } from 'react';

export type DialogType = 
  | 'delete'
  | 'transfer'
  | 'archive'
  | 'unarchive'
  | 'clone'
  | 'create'
  | 'edit'
  | 'share'
  | 'settings'
  | 'permissions'
  | 'visibility'
  | 'members'
  | 'export'
  | 'import'
  | 'merge'
  | 'fork'
  | 'template';

export interface DialogState {
  open: boolean;
  type: DialogType | null;
  data?: any;
  loading?: boolean;
  error?: string | null;
}

interface DialogAction {
  type: 'OPEN' | 'CLOSE' | 'SET_LOADING' | 'SET_ERROR' | 'SET_DATA' | 'RESET';
  payload?: {
    dialogType?: DialogType;
    data?: any;
    loading?: boolean;
    error?: string | null;
  };
}

const initialState: DialogState = {
  open: false,
  type: null,
  data: undefined,
  loading: false,
  error: null
};

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'OPEN':
      return {
        ...state,
        open: true,
        type: action.payload?.dialogType || null,
        data: action.payload?.data,
        error: null
      };
    
    case 'CLOSE':
      return {
        ...state,
        open: false,
        loading: false
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload?.loading ?? false
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload?.error || null,
        loading: false
      };
    
    case 'SET_DATA':
      return {
        ...state,
        data: action.payload?.data
      };
    
    case 'RESET':
      return initialState;
    
    default:
      return state;
  }
}

/**
 * 단일 다이얼로그 상태 관리
 */
export function useDialogState(defaultType?: DialogType) {
  const [state, dispatch] = useReducer(dialogReducer, {
    ...initialState,
    type: defaultType || null
  });
  
  const open = useCallback((data?: any) => {
    dispatch({
      type: 'OPEN',
      payload: { dialogType: defaultType, data }
    });
  }, [defaultType]);
  
  const close = useCallback(() => {
    dispatch({ type: 'CLOSE' });
  }, []);
  
  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: { loading } });
  }, []);
  
  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: { error } });
  }, []);
  
  const setData = useCallback((data: any) => {
    dispatch({ type: 'SET_DATA', payload: { data } });
  }, []);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);
  
  const toggle = useCallback(() => {
    if (state.open) {
      close();
    } else {
      open();
    }
  }, [state.open, open, close]);
  
  return {
    ...state,
    open,
    close,
    setLoading,
    setError,
    setData,
    reset,
    toggle,
    isOpen: state.open,
    isLoading: state.loading || false,
    hasError: !!state.error
  };
}

/**
 * 다중 다이얼로그 상태 관리
 */
export interface MultiDialogState {
  dialogs: Map<DialogType, DialogState>;
  activeDialog: DialogType | null;
}

export function useMultipleDialogs() {
  const [dialogs, setDialogs] = useState<Map<DialogType, DialogState>>(new Map());
  const [activeDialog, setActiveDialog] = useState<DialogType | null>(null);
  
  const openDialog = useCallback((type: DialogType, data?: any) => {
    setDialogs(prev => {
      const next = new Map(prev);
      next.set(type, {
        open: true,
        type,
        data,
        loading: false,
        error: null
      });
      return next;
    });
    setActiveDialog(type);
  }, []);
  
  const closeDialog = useCallback((type: DialogType) => {
    setDialogs(prev => {
      const next = new Map(prev);
      const dialog = next.get(type);
      if (dialog) {
        next.set(type, { ...dialog, open: false });
      }
      return next;
    });
    
    if (activeDialog === type) {
      setActiveDialog(null);
    }
  }, [activeDialog]);
  
  const closeAllDialogs = useCallback(() => {
    setDialogs(new Map());
    setActiveDialog(null);
  }, []);
  
  const getDialogState = useCallback((type: DialogType): DialogState => {
    return dialogs.get(type) || initialState;
  }, [dialogs]);
  
  const setDialogLoading = useCallback((type: DialogType, loading: boolean) => {
    setDialogs(prev => {
      const next = new Map(prev);
      const dialog = next.get(type);
      if (dialog) {
        next.set(type, { ...dialog, loading });
      }
      return next;
    });
  }, []);
  
  const setDialogError = useCallback((type: DialogType, error: string | null) => {
    setDialogs(prev => {
      const next = new Map(prev);
      const dialog = next.get(type);
      if (dialog) {
        next.set(type, { ...dialog, error, loading: false });
      }
      return next;
    });
  }, []);
  
  const setDialogData = useCallback((type: DialogType, data: any) => {
    setDialogs(prev => {
      const next = new Map(prev);
      const dialog = next.get(type);
      if (dialog) {
        next.set(type, { ...dialog, data });
      }
      return next;
    });
  }, []);
  
  const isDialogOpen = useCallback((type: DialogType): boolean => {
    const dialog = dialogs.get(type);
    return dialog?.open || false;
  }, [dialogs]);
  
  const hasOpenDialogs = dialogs.size > 0 && Array.from(dialogs.values()).some(d => d.open);
  
  return {
    dialogs,
    activeDialog,
    openDialog,
    closeDialog,
    closeAllDialogs,
    getDialogState,
    setDialogLoading,
    setDialogError,
    setDialogData,
    isDialogOpen,
    hasOpenDialogs
  };
}

/**
 * 다이얼로그 스택 관리 (모달 위에 모달)
 */
export function useDialogStack() {
  const [stack, setStack] = useState<DialogType[]>([]);
  
  const push = useCallback((type: DialogType) => {
    setStack(prev => [...prev, type]);
  }, []);
  
  const pop = useCallback(() => {
    setStack(prev => prev.slice(0, -1));
  }, []);
  
  const clear = useCallback(() => {
    setStack([]);
  }, []);
  
  const current = stack[stack.length - 1] || null;
  const previous = stack[stack.length - 2] || null;
  const depth = stack.length;
  
  return {
    stack,
    push,
    pop,
    clear,
    current,
    previous,
    depth,
    isEmpty: depth === 0
  };
}