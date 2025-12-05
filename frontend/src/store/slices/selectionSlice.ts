import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SelectionItem {
  id: string;
  name: string;
  type: 'group' | 'project';
  path?: string;
  fullPath?: string;
}

interface SelectionState {
  selectedItems: SelectionItem[];
  lastSelectedId: string | null;
  selectAll: boolean;
}

const initialState: SelectionState = {
  selectedItems: [],
  lastSelectedId: null,
  selectAll: false,
};

const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    setSelectedItems: (state, action: PayloadAction<SelectionItem[]>) => {
      state.selectedItems = action.payload;
      state.selectAll = false;
    },
    
    addSelectedItem: (state, action: PayloadAction<SelectionItem>) => {
      const exists = state.selectedItems.some(item => item.id === action.payload.id);
      if (!exists) {
        state.selectedItems.push(action.payload);
      }
      state.lastSelectedId = action.payload.id;
    },
    
    removeSelectedItem: (state, action: PayloadAction<string>) => {
      state.selectedItems = state.selectedItems.filter(item => item.id !== action.payload);
      if (state.lastSelectedId === action.payload) {
        state.lastSelectedId = null;
      }
    },
    
    toggleItemSelection: (state, action: PayloadAction<SelectionItem>) => {
      const index = state.selectedItems.findIndex(item => item.id === action.payload.id);
      if (index >= 0) {
        state.selectedItems.splice(index, 1);
      } else {
        state.selectedItems.push(action.payload);
      }
      state.lastSelectedId = action.payload.id;
    },
    
    selectAllItems: (state, action: PayloadAction<SelectionItem[]>) => {
      state.selectedItems = action.payload;
      state.selectAll = true;
    },
    
    clearSelection: (state) => {
      state.selectedItems = [];
      state.lastSelectedId = null;
      state.selectAll = false;
    },
    
    selectItemsByType: (state, action: PayloadAction<{ items: SelectionItem[]; type: 'group' | 'project' }>) => {
      const filtered = action.payload.items.filter(item => item.type === action.payload.type);
      state.selectedItems = filtered;
      state.selectAll = false;
    },
    
    invertSelection: (state, action: PayloadAction<SelectionItem[]>) => {
      const selectedIds = new Set(state.selectedItems.map(item => item.id));
      state.selectedItems = action.payload.filter(item => !selectedIds.has(item.id));
      state.selectAll = false;
    },
  },
});

export const {
  setSelectedItems,
  addSelectedItem,
  removeSelectedItem,
  toggleItemSelection,
  selectAllItems,
  clearSelection,
  selectItemsByType,
  invertSelection,
} = selectionSlice.actions;

export default selectionSlice.reducer;

// Selectors
export const selectSelectedItems = (state: { selection: SelectionState }) => state.selection.selectedItems;
export const selectSelectedCount = (state: { selection: SelectionState }) => state.selection.selectedItems.length;
export const selectIsItemSelected = (id: string) => (state: { selection: SelectionState }) => 
  state.selection.selectedItems.some(item => item.id === id);
export const selectSelectedGroups = (state: { selection: SelectionState }) => 
  state.selection.selectedItems.filter(item => item.type === 'group');
export const selectSelectedProjects = (state: { selection: SelectionState }) => 
  state.selection.selectedItems.filter(item => item.type === 'project');