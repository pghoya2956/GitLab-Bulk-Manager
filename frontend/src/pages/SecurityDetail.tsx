/**
 * SecurityDetail - 보안 스캔 상세 페이지
 * 특정 스캔의 취약점 목록과 상세 정보 표시
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Button,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  TextField,
  InputAdornment,
  Link,
} from '@mui/material';
import {
  Security,
  ArrowBack,
  Refresh,
  Download,
  ExpandMore,
  ExpandLess,
  Search,
  BugReport,
  Code,
  VpnKey,
  Settings,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';

import {
  getScanById,
  ScanHistory,
  Vulnerability,
  formatScanDate,
  getSeverityColor,
  getVulnerabilityTypeLabel,
} from '../api/security';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const SecurityDetail: React.FC = () => {
  const navigate = useNavigate();
  const { scanId } = useParams<{ scanId: string }>();

  const [scan, setScan] = useState<ScanHistory | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (scanId) {
      fetchScanDetail();
    }
  }, [scanId]);

  const fetchScanDetail = async () => {
    if (!scanId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await getScanById(parseInt(scanId, 10));
      setScan(result.scan);
      setVulnerabilities(result.vulnerabilities);
    } catch (err: any) {
      setError(err.response?.data?.error || '스캔 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const toggleRow = (vulnId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(vulnId)) {
        next.delete(vulnId);
      } else {
        next.add(vulnId);
      }
      return next;
    });
  };

  const handleExportJson = () => {
    if (!scan) return;
    const data = {
      scan,
      vulnerabilities,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-scan-${scan.project_name}-${scan.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter vulnerabilities by tab and search
  const filteredVulnerabilities = vulnerabilities.filter((vuln) => {
    // Tab filter
    const typeFilters = ['', 'dependency', 'code', 'secret', 'misconfig'];
    if (tabValue > 0 && vuln.type !== typeFilters[tabValue]) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        vuln.title.toLowerCase().includes(search) ||
        vuln.description?.toLowerCase().includes(search) ||
        vuln.file_path?.toLowerCase().includes(search) ||
        vuln.cve?.toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Count by type
  const countByType = {
    dependency: vulnerabilities.filter((v) => v.type === 'dependency').length,
    code: vulnerabilities.filter((v) => v.type === 'code').length,
    secret: vulnerabilities.filter((v) => v.type === 'secret').length,
    misconfig: vulnerabilities.filter((v) => v.type === 'misconfig').length,
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dependency':
        return <BugReport fontSize="small" />;
      case 'code':
        return <Code fontSize="small" />;
      case 'secret':
        return <VpnKey fontSize="small" />;
      case 'misconfig':
        return <Settings fontSize="small" />;
      default:
        return <Security fontSize="small" />;
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !scan) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Alert severity="error">
          {error || '스캔 정보를 찾을 수 없습니다'}
        </Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/security')} sx={{ mt: 2 }}>
          목록으로
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate('/security')}>
          <ArrowBack />
        </IconButton>
        <Security color="primary" sx={{ fontSize: 32 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" component="h1">
            {scan.project_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {scan.project_path}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchScanDetail}
        >
          새로고침
        </Button>
        <Button
          variant="outlined"
          startIcon={<Download />}
          onClick={handleExportJson}
        >
          JSON 내보내기
        </Button>
      </Box>

      {/* Scan Info */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              스캔 일시
            </Typography>
            <Typography variant="body1">
              {new Date(scan.scan_date).toLocaleString('ko-KR')}
              {' '}
              <Typography component="span" variant="body2" color="text.secondary">
                ({formatScanDate(scan.scan_date)})
              </Typography>
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              소요 시간
            </Typography>
            <Typography variant="body1">
              {scan.duration_seconds ? `${scan.duration_seconds}초` : '-'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              스캔 도구
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              {scan.trivy_version && (
                <Chip size="small" label={`Trivy ${scan.trivy_version}`} variant="outlined" />
              )}
              {scan.semgrep_version && (
                <Chip size="small" label={`Semgrep ${scan.semgrep_version}`} variant="outlined" />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              취약점 요약
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {scan.summary_critical > 0 && (
                <Chip size="small" label={`Critical: ${scan.summary_critical}`} color="error" />
              )}
              {scan.summary_high > 0 && (
                <Chip size="small" label={`High: ${scan.summary_high}`} color="error" variant="outlined" />
              )}
              {scan.summary_medium > 0 && (
                <Chip size="small" label={`Medium: ${scan.summary_medium}`} color="warning" />
              )}
              {scan.summary_low > 0 && (
                <Chip size="small" label={`Low: ${scan.summary_low}`} color="info" />
              )}
              {vulnerabilities.length === 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircle color="success" fontSize="small" />
                  <Typography variant="body2" color="success.main">
                    취약점 없음
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Vulnerabilities */}
      <Paper sx={{ p: 2 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={`전체 (${vulnerabilities.length})`} />
            <Tab
              icon={<BugReport fontSize="small" />}
              iconPosition="start"
              label={`의존성 (${countByType.dependency})`}
            />
            <Tab
              icon={<Code fontSize="small" />}
              iconPosition="start"
              label={`코드 (${countByType.code})`}
            />
            <Tab
              icon={<VpnKey fontSize="small" />}
              iconPosition="start"
              label={`시크릿 (${countByType.secret})`}
            />
            <Tab
              icon={<Settings fontSize="small" />}
              iconPosition="start"
              label={`설정 (${countByType.misconfig})`}
            />
          </Tabs>
        </Box>

        {/* Search */}
        <Box sx={{ py: 2 }}>
          <TextField
            size="small"
            placeholder="취약점 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            sx={{ width: 300 }}
          />
        </Box>

        {/* Table */}
        <TabPanel value={tabValue} index={tabValue}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell width={100}>심각도</TableCell>
                  <TableCell width={80}>타입</TableCell>
                  <TableCell>제목</TableCell>
                  <TableCell width={200}>파일</TableCell>
                  <TableCell width={60}>라인</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVulnerabilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        {searchTerm ? '검색 결과가 없습니다' : '취약점이 없습니다'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVulnerabilities.map((vuln) => (
                    <React.Fragment key={vuln.id}>
                      <TableRow
                        hover
                        onClick={() => toggleRow(vuln.id)}
                        sx={{ cursor: 'pointer', '& > *': { borderBottom: expandedRows.has(vuln.id) ? 'unset' : undefined } }}
                      >
                        <TableCell>
                          <IconButton size="small">
                            {expandedRows.has(vuln.id) ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={vuln.severity}
                            color={getSeverityColor(vuln.severity)}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {getTypeIcon(vuln.type)}
                            <Typography variant="caption">
                              {getVulnerabilityTypeLabel(vuln.type)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                            {vuln.title}
                          </Typography>
                          {vuln.cve && (
                            <Chip size="small" label={vuln.cve} variant="outlined" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {vuln.file_path || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {vuln.line_number || '-'}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                          <Collapse in={expandedRows.has(vuln.id)} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 2, bgcolor: 'grey.50' }}>
                              <Grid container spacing={2}>
                                <Grid item xs={12}>
                                  <Typography variant="subtitle2" gutterBottom>
                                    설명
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {vuln.description || '설명 없음'}
                                  </Typography>
                                </Grid>

                                {vuln.package_name && (
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      패키지
                                    </Typography>
                                    <Typography variant="body2">
                                      {vuln.package_name}
                                      {vuln.package_version && `@${vuln.package_version}`}
                                    </Typography>
                                  </Grid>
                                )}

                                {vuln.cwe && (
                                  <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      CWE
                                    </Typography>
                                    <Typography variant="body2">{vuln.cwe}</Typography>
                                  </Grid>
                                )}

                                {vuln.fix_suggestion && (
                                  <Grid item xs={12}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      수정 방법
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'success.50' }}>
                                      <Typography variant="body2" fontFamily="monospace">
                                        {vuln.fix_suggestion}
                                      </Typography>
                                    </Paper>
                                  </Grid>
                                )}

                                {vuln.references && vuln.references.length > 0 && (
                                  <Grid item xs={12}>
                                    <Typography variant="subtitle2" gutterBottom>
                                      참조 링크
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                      {vuln.references.slice(0, 5).map((ref, idx) => (
                                        <Link
                                          key={idx}
                                          href={ref}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          variant="body2"
                                        >
                                          {ref}
                                        </Link>
                                      ))}
                                      {vuln.references.length > 5 && (
                                        <Typography variant="caption" color="text.secondary">
                                          ...외 {vuln.references.length - 5}개 링크
                                        </Typography>
                                      )}
                                    </Box>
                                  </Grid>
                                )}

                                <Grid item xs={12}>
                                  <Typography variant="caption" color="text.secondary">
                                    출처: {vuln.source}
                                  </Typography>
                                </Grid>
                              </Grid>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default SecurityDetail;
