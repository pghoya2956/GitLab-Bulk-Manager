/**
 * useBulkDialogs - 모든 Bulk Dialog 상태를 통합 관리하는 Hook
 * 10개의 다이얼로그 상태를 하나의 객체로 관리
 */

import { useState, useCallback } from 'react';

export type DialogType = 
  | 'import' 
  | 'delete' 
  | 'transfer' 
  | 'settings' 
  | 'archive' 
  | 'unarchive' 
  | 'clone' 
  | 'members' 
  | 'cicd' 
  | 'issues';

interface DialogState {
  import: boolean;
  delete: boolean;
  transfer: boolean;
  settings: boolean;
  archive: boolean;
  unarchive: boolean;
  clone: boolean;
  members: boolean;
  cicd: boolean;
  issues: boolean;
}

interface UseBulkDialogsReturn {
  isOpen: (dialog: DialogType) => boolean;
  open: (dialog: DialogType) => void;
  close: (dialog: DialogType) => void;
  closeAll: () => void;
  toggle: (dialog: DialogType) => void;
  openMultiple: (dialogs: DialogType[]) => void;
  state: DialogState;
}

const initialState: DialogState = {
  import: false,
  delete: false,
  transfer: false,
  settings: false,
  archive: false,
  unarchive: false,
  clone: false,
  members: false,
  cicd: false,
  issues: false,
};

export function useBulkDialogs(): UseBulkDialogsReturn {
  const [state, setState] = useState<DialogState>(initialState);

  const isOpen = useCallback((dialog: DialogType) => {
    return state[dialog];
  }, [state]);

  const open = useCallback((dialog: DialogType) => {
    setState(prev => ({ ...prev, [dialog]: true }));
  }, []);

  const close = useCallback((dialog: DialogType) => {
    setState(prev => ({ ...prev, [dialog]: false }));
  }, []);

  const closeAll = useCallback(() => {
    setState(initialState);
  }, []);

  const toggle = useCallback((dialog: DialogType) => {
    setState(prev => ({ ...prev, [dialog]: !prev[dialog] }));
  }, []);

  const openMultiple = useCallback((dialogs: DialogType[]) => {
    setState(prev => {
      const newState = { ...prev };
      dialogs.forEach(dialog => {
        newState[dialog] = true;
      });
      return newState;
    });
  }, []);

  return {
    isOpen,
    open,
    close,
    closeAll,
    toggle,
    openMultiple,
    state,
  };
}