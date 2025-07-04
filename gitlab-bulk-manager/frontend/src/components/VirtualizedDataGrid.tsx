import React, { useMemo } from 'react';
import { DataGrid, GridColDef, GridRowsProp, GridToolbar } from '@mui/x-data-grid';
import { Box, useTheme } from '@mui/material';

interface VirtualizedDataGridProps {
  rows: GridRowsProp;
  columns: GridColDef[];
  pageSize?: number;
  loading?: boolean;
  checkboxSelection?: boolean;
  onSelectionModelChange?: (ids: any[]) => void;
  height?: number | string;
  density?: 'compact' | 'standard' | 'comfortable';
  disableColumnFilter?: boolean;
  disableColumnSelector?: boolean;
  disableDensitySelector?: boolean;
  showToolbar?: boolean;
}

export const VirtualizedDataGrid: React.FC<VirtualizedDataGridProps> = ({
  rows,
  columns,
  pageSize = 100,
  loading = false,
  checkboxSelection = false,
  onSelectionModelChange,
  height = 600,
  density = 'standard',
  disableColumnFilter = false,
  disableColumnSelector = false,
  disableDensitySelector = false,
  showToolbar = true,
}) => {
  const theme = useTheme();

  // Memoize columns to prevent unnecessary re-renders
  const memoizedColumns = useMemo(() => columns, [columns]);

  return (
    <Box sx={{ height, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={memoizedColumns}
        pageSize={pageSize}
        rowsPerPageOptions={[25, 50, 100, 200]}
        pagination
        paginationMode="client"
        checkboxSelection={checkboxSelection}
        disableSelectionOnClick
        loading={loading}
        density={density}
        onSelectionModelChange={onSelectionModelChange}
        components={{
          Toolbar: showToolbar ? GridToolbar : undefined,
        }}
        componentsProps={{
          toolbar: {
            showQuickFilter: true,
            quickFilterProps: { debounceMs: 500 },
          },
        }}
        sx={{
          '& .MuiDataGrid-root': {
            border: 'none',
          },
          '& .MuiDataGrid-cell': {
            borderBottom: `1px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: theme.palette.grey[100],
            borderBottom: `2px solid ${theme.palette.divider}`,
          },
          '& .MuiDataGrid-virtualScroller': {
            backgroundColor: theme.palette.background.paper,
          },
          '& .MuiDataGrid-footerContainer': {
            borderTop: `2px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.default,
          },
          '& .MuiCheckbox-root': {
            color: theme.palette.primary.main,
          },
          '& .MuiDataGrid-row:hover': {
            backgroundColor: theme.palette.action.hover,
          },
          '& .MuiDataGrid-row.Mui-selected': {
            backgroundColor: theme.palette.action.selected,
            '&:hover': {
              backgroundColor: theme.palette.action.selected,
            },
          },
        }}
        // Performance optimizations
        rowHeight={52}
        headerHeight={56}
        disableColumnMenu={false}
        disableColumnFilter={disableColumnFilter}
        disableColumnSelector={disableColumnSelector}
        disableDensitySelector={disableDensitySelector}
        columnBuffer={5}
        rowBuffer={10}
        // Enable row virtualization
        rowThreshold={0}
      />
    </Box>
  );
};