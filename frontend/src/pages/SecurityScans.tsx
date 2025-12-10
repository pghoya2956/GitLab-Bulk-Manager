/**
 * SecurityScans - 보안 스캔 결과 목록 페이지
 * 스캔 결과를 테이블 형식으로 표시
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import {
  Security,
  Refresh,
  Delete,
  CheckCircle,
  Error as ErrorIcon,
  HourglassEmpty,
  ArrowBack,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import {
  getScans,
  deleteScan,
  ScanHistory,
  formatScanDate,
} from '../api/security';

type Order = 'asc' | 'desc';
type SortField = 'scan_date' | 'project_name' | 'summary_critical' | 'summary_high' | 'status';

const SecurityScans: React.FC = () => {
  const navigate = useNavigate();

  const [scans, setScans] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  // Sorting
  const [orderBy, setOrderBy] = useState<SortField>('scan_date');
  const [order, setOrder] = useState<Order>('desc');

  // Filtering
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchScans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getScans({
        status: statusFilter || undefined,
        page: page + 1,
        limit: rowsPerPage,
        sort: orderBy,
        order: order.toUpperCase() as 'ASC' | 'DESC',
      });
      setScans(result.scans);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.response?.data?.error || '스캔 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, orderBy, order, statusFilter]);

  useEffect(() => {
    fetchScans();
  }, [fetchScans]);

  const handleRequestSort = (property: SortField) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
    setPage(0);
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent) => {
    setStatusFilter(event.target.value);
    setPage(0);
  };

  const handleRowClick = (scanId: number) => {
    navigate(`/security/${scanId}`);
  };

  const handleDelete = async (event: React.MouseEvent, scanId: number) => {
    event.stopPropagation();
    if (!window.confirm('이 스캔 결과를 삭제하시겠습니까?')) return;

    try {
      await deleteScan(scanId);
      fetchScans();
    } catch (err: any) {
      setError(err.response?.data?.error || '삭제 실패');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'running':
        return <HourglassEmpty color="info" fontSize="small" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'running':
        return '진행중';
      default:
        return status;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/')}>
          <ArrowBack />
        </IconButton>
        <Security color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" component="h1">
            보안 스캔 결과
          </Typography>
          <Typography variant="body2" color="text.secondary">
            프로젝트별 보안 취약점 스캔 결과를 확인합니다
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchScans}
          disabled={loading}
        >
          새로고침
        </Button>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>상태 필터</InputLabel>
            <Select
              value={statusFilter}
              label="상태 필터"
              onChange={handleStatusFilterChange}
            >
              <MenuItem value="">전체</MenuItem>
              <MenuItem value="completed">완료</MenuItem>
              <MenuItem value="running">진행중</MenuItem>
              <MenuItem value="failed">실패</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            총 {total}개의 스캔 결과
          </Typography>
        </Box>
      </Paper>

      {/* Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'project_name'}
                    direction={orderBy === 'project_name' ? order : 'asc'}
                    onClick={() => handleRequestSort('project_name')}
                  >
                    프로젝트
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">
                  <TableSortLabel
                    active={orderBy === 'summary_critical'}
                    direction={orderBy === 'summary_critical' ? order : 'asc'}
                    onClick={() => handleRequestSort('summary_critical')}
                  >
                    Critical
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">
                  <TableSortLabel
                    active={orderBy === 'summary_high'}
                    direction={orderBy === 'summary_high' ? order : 'asc'}
                    onClick={() => handleRequestSort('summary_high')}
                  >
                    High
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">Medium</TableCell>
                <TableCell align="center">Low</TableCell>
                <TableCell align="center">
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleRequestSort('status')}
                  >
                    상태
                  </TableSortLabel>
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'scan_date'}
                    direction={orderBy === 'scan_date' ? order : 'asc'}
                    onClick={() => handleRequestSort('scan_date')}
                  >
                    스캔 일시
                  </TableSortLabel>
                </TableCell>
                <TableCell align="center">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={32} />
                  </TableCell>
                </TableRow>
              ) : scans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      스캔 결과가 없습니다
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                scans.map((scan) => {
                  return (
                    <TableRow
                      key={scan.id}
                      hover
                      onClick={() => handleRowClick(scan.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {scan.project_name}
                          </Typography>
                          {scan.project_path && (
                            <Typography variant="caption" color="text.secondary">
                              {scan.project_path}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        {scan.status === 'completed' ? (
                          scan.summary_critical > 0 ? (
                            <Chip
                              size="small"
                              label={scan.summary_critical}
                              color="error"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              0
                            </Typography>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {scan.status === 'completed' ? (
                          scan.summary_high > 0 ? (
                            <Chip
                              size="small"
                              label={scan.summary_high}
                              color="error"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              0
                            </Typography>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {scan.status === 'completed' ? (
                          scan.summary_medium > 0 ? (
                            <Chip
                              size="small"
                              label={scan.summary_medium}
                              color="warning"
                              variant="outlined"
                            />
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              0
                            </Typography>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        {scan.status === 'completed' ? (
                          scan.summary_low > 0 ? (
                            <Typography variant="body2">
                              {scan.summary_low}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              0
                            </Typography>
                          )
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          {getStatusIcon(scan.status)}
                          <Typography variant="body2">
                            {getStatusLabel(scan.status)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatScanDate(scan.scan_date)}
                        </Typography>
                        {scan.duration_seconds && (
                          <Typography variant="caption" color="text.secondary">
                            {scan.duration_seconds}초 소요
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="삭제">
                          <IconButton
                            size="small"
                            onClick={(e) => handleDelete(e, scan.id)}
                            color="error"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[10, 20, 50]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="페이지당 행 수"
        />
      </Paper>
    </Container>
  );
};

export default SecurityScans;
