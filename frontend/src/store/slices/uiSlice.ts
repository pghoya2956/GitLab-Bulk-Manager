import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  loading: boolean;
  error: string | null;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  dialogs: {
    [key: string]: boolean;
  };
}

const initialState: UIState = {
  loading: false,
  error: null,
  theme: 'light',
  sidebarOpen: true,
  dialogs: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setDialogOpen: (state, action: PayloadAction<{ dialog: string; open: boolean }>) => {
      state.dialogs[action.payload.dialog] = action.payload.open;
    },
  },
});

export const { setLoading, setError, setTheme, toggleSidebar, setDialogOpen } = uiSlice.actions;
export default uiSlice.reducer;