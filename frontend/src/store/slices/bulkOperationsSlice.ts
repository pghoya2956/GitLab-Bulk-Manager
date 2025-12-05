import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { bulkAPI } from '../../api/bulkOperations';

export interface BulkOperation {
  id: string;
  type: 'delete' | 'transfer' | 'archive' | 'unarchive' | 'clone' | 'create';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  items: Array<{
    id: string | number;
    name: string;
    type: 'group' | 'project';
    status?: 'pending' | 'success' | 'failed';
    error?: string;
  }>;
  startedAt: number;
  completedAt?: number;
  error?: string;
  results?: {
    successful: any[];
    failed: any[];
    skipped?: any[];
  };
}

interface BulkOperationsState {
  activeOperations: BulkOperation[];
  completedOperations: BulkOperation[];
  currentOperation: BulkOperation | null;
  loading: boolean;
  error: string | null;
}

const initialState: BulkOperationsState = {
  activeOperations: [],
  completedOperations: [],
  currentOperation: null,
  loading: false,
  error: null,
};

// Async thunks
export const executeBulkDelete = createAsyncThunk(
  'bulkOperations/delete',
  async (items: any[], { rejectWithValue }) => {
    try {
      const response = await bulkAPI.bulkDelete(items);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const executeBulkTransfer = createAsyncThunk(
  'bulkOperations/transfer',
  async ({ items, targetNamespaceId }: any, { rejectWithValue }) => {
    try {
      const response = await bulkAPI.bulkTransfer(items, targetNamespaceId);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const executeBulkArchive = createAsyncThunk(
  'bulkOperations/archive',
  async ({ items, archive = true }: any, { rejectWithValue }) => {
    try {
      const response = archive 
        ? await bulkAPI.bulkArchive(items)
        : await bulkAPI.bulkUnarchive(items);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const executeBulkClone = createAsyncThunk(
  'bulkOperations/clone',
  async ({ items, suffix }: any, { rejectWithValue }) => {
    try {
      const response = await bulkAPI.bulkClone(items, suffix);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const bulkOperationsSlice = createSlice({
  name: 'bulkOperations',
  initialState,
  reducers: {
    startOperation: (state, action: PayloadAction<Omit<BulkOperation, 'id' | 'startedAt'>>) => {
      const operation: BulkOperation = {
        ...action.payload,
        id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        startedAt: Date.now(),
      };
      state.activeOperations.push(operation);
      state.currentOperation = operation;
      state.error = null;
    },
    
    updateOperationProgress: (state, action: PayloadAction<{ 
      id: string; 
      progress: number; 
      currentItem?: string;
      message?: string;
      current?: number;
      total?: number;
    }>) => {
      const operation = state.activeOperations.find(op => op.id === action.payload.id);
      if (operation) {
        operation.progress = action.payload.progress;
        if (action.payload.current !== undefined) {
          operation.progress = action.payload.current;
        }
        if (action.payload.total !== undefined) {
          operation.total = action.payload.total;
        }
        if (action.payload.currentItem) {
          const item = operation.items.find(i => i.name === action.payload.currentItem);
          if (item) {
            item.status = 'success';
          }
        }
      }
      if (state.currentOperation?.id === action.payload.id) {
        state.currentOperation.progress = action.payload.progress;
        if (action.payload.current !== undefined) {
          state.currentOperation.progress = action.payload.current;
        }
        if (action.payload.total !== undefined) {
          state.currentOperation.total = action.payload.total;
        }
      }
    },
    
    completeOperation: (state, action: PayloadAction<{ id: string; result?: any; results?: any }>) => {
      const index = state.activeOperations.findIndex(op => op.id === action.payload.id);
      if (index >= 0) {
        const operation = state.activeOperations[index];
        operation.status = 'completed';
        operation.completedAt = Date.now();
        operation.results = action.payload.results || action.payload.result;
        operation.progress = operation.total;
        
        state.completedOperations.push(operation);
        state.activeOperations.splice(index, 1);
        
        if (state.currentOperation?.id === action.payload.id) {
          state.currentOperation = null;
        }
      }
    },
    
    failOperation: (state, action: PayloadAction<{ id: string; error: string }>) => {
      const index = state.activeOperations.findIndex(op => op.id === action.payload.id);
      if (index >= 0) {
        const operation = state.activeOperations[index];
        operation.status = 'failed';
        operation.completedAt = Date.now();
        operation.error = action.payload.error;
        
        state.completedOperations.push(operation);
        state.activeOperations.splice(index, 1);
        
        if (state.currentOperation?.id === action.payload.id) {
          state.currentOperation = null;
        }
      }
      state.error = action.payload.error;
    },
    
    clearCompletedOperations: (state) => {
      state.completedOperations = [];
    },
    
    clearError: (state) => {
      state.error = null;
    },
    
    setCurrentOperation: (state, action: PayloadAction<string | null>) => {
      if (action.payload === null) {
        state.currentOperation = null;
      } else {
        const operation = state.activeOperations.find(op => op.id === action.payload) ||
                         state.completedOperations.find(op => op.id === action.payload);
        state.currentOperation = operation || null;
      }
    },
  },
  extraReducers: (builder) => {
    // Handle bulk delete
    builder
      .addCase(executeBulkDelete.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeBulkDelete.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(executeBulkDelete.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // Handle bulk transfer
    builder
      .addCase(executeBulkTransfer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeBulkTransfer.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(executeBulkTransfer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // Handle bulk archive
    builder
      .addCase(executeBulkArchive.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeBulkArchive.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(executeBulkArchive.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // Handle bulk clone
    builder
      .addCase(executeBulkClone.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(executeBulkClone.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(executeBulkClone.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  startOperation,
  updateOperationProgress,
  completeOperation,
  failOperation,
  clearCompletedOperations,
  clearError,
  setCurrentOperation,
} = bulkOperationsSlice.actions;

export default bulkOperationsSlice.reducer;

// Selectors
export const selectActiveOperations = (state: { bulkOperations: BulkOperationsState }) => 
  state.bulkOperations.activeOperations;
export const selectCompletedOperations = (state: { bulkOperations: BulkOperationsState }) => 
  state.bulkOperations.completedOperations;
export const selectCurrentOperation = (state: { bulkOperations: BulkOperationsState }) => 
  state.bulkOperations.currentOperation;
export const selectIsOperationRunning = (state: { bulkOperations: BulkOperationsState }) => 
  state.bulkOperations.activeOperations.length > 0;
export const selectOperationById = (id: string) => (state: { bulkOperations: BulkOperationsState }) => 
  state.bulkOperations.activeOperations.find(op => op.id === id) ||
  state.bulkOperations.completedOperations.find(op => op.id === id);