import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface HistoryAction {
  id: string;
  type: 'delete' | 'transfer' | 'archive' | 'unarchive' | 'clone' | 'create' | 'update';
  timestamp: number;
  description: string;
  items: Array<{
    id: string | number;
    name: string;
    type: 'group' | 'project';
  }>;
  metadata?: {
    targetNamespace?: string;
    originalState?: any;
    newState?: any;
    [key: string]: any;
  };
  undoable: boolean;
  undoAction?: () => Promise<void>;
}

interface HistoryState {
  actions: HistoryAction[];
  currentIndex: number;
  maxHistorySize: number;
  canUndo: boolean;
  canRedo: boolean;
}

const initialState: HistoryState = {
  actions: [],
  currentIndex: -1,
  maxHistorySize: 50,
  canUndo: false,
  canRedo: false,
};

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addAction: (state, action: PayloadAction<Omit<HistoryAction, 'id' | 'timestamp'>>) => {
      const newAction: HistoryAction = {
        ...action.payload,
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };
      
      // Remove any actions after current index (for redo functionality)
      state.actions = state.actions.slice(0, state.currentIndex + 1);
      
      // Add new action
      state.actions.push(newAction);
      
      // Limit history size
      if (state.actions.length > state.maxHistorySize) {
        state.actions = state.actions.slice(-state.maxHistorySize);
      }
      
      state.currentIndex = state.actions.length - 1;
      state.canUndo = state.currentIndex >= 0 && state.actions[state.currentIndex]?.undoable;
      state.canRedo = false;
    },
    
    undo: (state) => {
      if (state.currentIndex >= 0 && state.actions[state.currentIndex]?.undoable) {
        state.currentIndex--;
        state.canUndo = state.currentIndex >= 0 && state.actions[state.currentIndex]?.undoable;
        state.canRedo = true;
      }
    },
    
    redo: (state) => {
      if (state.currentIndex < state.actions.length - 1) {
        state.currentIndex++;
        state.canUndo = state.actions[state.currentIndex]?.undoable;
        state.canRedo = state.currentIndex < state.actions.length - 1;
      }
    },
    
    clearHistory: (state) => {
      state.actions = [];
      state.currentIndex = -1;
      state.canUndo = false;
      state.canRedo = false;
    },
    
    removeAction: (state, action: PayloadAction<string>) => {
      const index = state.actions.findIndex(a => a.id === action.payload);
      if (index >= 0) {
        state.actions.splice(index, 1);
        if (state.currentIndex >= index) {
          state.currentIndex = Math.max(0, state.currentIndex - 1);
        }
        state.canUndo = state.currentIndex >= 0 && state.actions[state.currentIndex]?.undoable;
        state.canRedo = state.currentIndex < state.actions.length - 1;
      }
    },
    
    setMaxHistorySize: (state, action: PayloadAction<number>) => {
      state.maxHistorySize = action.payload;
      if (state.actions.length > action.payload) {
        state.actions = state.actions.slice(-action.payload);
        state.currentIndex = Math.min(state.currentIndex, state.actions.length - 1);
      }
    },
  },
});

export const {
  addAction,
  undo,
  redo,
  clearHistory,
  removeAction,
  setMaxHistorySize,
} = historySlice.actions;

export default historySlice.reducer;

// Selectors
export const selectHistoryActions = (state: { history: HistoryState }) => state.history.actions;
export const selectCanUndo = (state: { history: HistoryState }) => state.history.canUndo;
export const selectCanRedo = (state: { history: HistoryState }) => state.history.canRedo;
export const selectCurrentAction = (state: { history: HistoryState }) => 
  state.history.actions[state.history.currentIndex];
export const selectRecentActions = (limit: number = 10) => (state: { history: HistoryState }) => 
  state.history.actions.slice(-limit).reverse();