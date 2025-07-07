import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Folder,
  LocalOffer,
  People,
  Info,
  ExpandMore,
  AccountTree,
  Label,
} from '@mui/icons-material';

interface MigrationPreviewProps {
  preview: any;
  connectionData: any;
  authorsMapping: Record<string, string>;
}

const MigrationPreview: React.FC<MigrationPreviewProps> = ({
  preview,
  connectionData,
}) => {
  if (!preview) {
    return (
      <Alert severity="warning">
        미리보기 데이터를 불러올 수 없습니다.
      </Alert>
    );
  }

  const { svnInfo, branches, tags, usersMapped, usersTotal } = preview;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        마이그레이션 미리보기
      </Typography>

      <Grid container spacing={3}>
        {/* 프로젝트 정보 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <Info sx={{ verticalAlign: 'middle', mr: 1 }} />
                프로젝트 정보
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="GitLab 프로젝트"
                    secondary={`${connectionData.projectName} (${connectionData.projectPath})`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="SVN Repository"
                    secondary={connectionData.svnUrl}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="레이아웃"
                    secondary={connectionData.layoutType === 'standard' ? '표준 (trunk/branches/tags)' : '커스텀'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* SVN 정보 */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                <Info sx={{ verticalAlign: 'middle', mr: 1 }} />
                SVN 저장소 정보
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="Repository Root"
                    secondary={svnInfo?.repository_root || 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="현재 리비전"
                    secondary={svnInfo?.revision || 'N/A'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Repository UUID"
                    secondary={svnInfo?.repository_uuid || 'N/A'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* 브랜치 정보 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <AccountTree sx={{ verticalAlign: 'middle', mr: 1 }} />
              브랜치 ({branches?.length || 0}개)
            </Typography>
            {branches && branches.length > 0 ? (
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                <List dense>
                  {branches.map((branch: string) => (
                    <ListItem key={branch}>
                      <ListItemIcon>
                        <Folder fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={branch} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                브랜치가 없습니다.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* 태그 정보 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <LocalOffer sx={{ verticalAlign: 'middle', mr: 1 }} />
              태그 ({tags?.length || 0}개)
            </Typography>
            {tags && tags.length > 0 ? (
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                <List dense>
                  {tags.map((tag: string) => (
                    <ListItem key={tag}>
                      <ListItemIcon>
                        <Label fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary={tag} />
                    </ListItem>
                  ))}
                </List>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                태그가 없습니다.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* 사용자 매핑 요약 */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              <People sx={{ verticalAlign: 'middle', mr: 1 }} />
              사용자 매핑 요약
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                label={`전체 사용자: ${usersTotal}`}
                color="default"
              />
              <Chip
                label={`매핑된 사용자: ${usersMapped}`}
                color={usersMapped === usersTotal ? 'success' : 'warning'}
              />
              {usersMapped < usersTotal && (
                <Chip
                  label={`매핑 필요: ${usersTotal - usersMapped}`}
                  color="error"
                />
              )}
            </Box>
          </Paper>
        </Grid>

        {/* 마이그레이션 옵션 */}
        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography>마이그레이션 옵션</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="증분 마이그레이션"
                    secondary={connectionData.options?.incremental ? '활성화' : '비활성화'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="빈 디렉토리 보존"
                    secondary={connectionData.options?.preserveEmptyDirs ? '예' : '아니오'}
                  />
                </ListItem>
                {connectionData.options?.includeBranches?.length > 0 && (
                  <ListItem>
                    <ListItemText
                      primary="포함할 브랜치 패턴"
                      secondary={connectionData.options.includeBranches.join(', ')}
                    />
                  </ListItem>
                )}
                {connectionData.options?.excludeBranches?.length > 0 && (
                  <ListItem>
                    <ListItemText
                      primary="제외할 브랜치 패턴"
                      secondary={connectionData.options.excludeBranches.join(', ')}
                    />
                  </ListItem>
                )}
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      {/* 경고 메시지 */}
      <Box sx={{ mt: 3 }}>
        {usersMapped < usersTotal && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            일부 SVN 사용자가 매핑되지 않았습니다. 매핑되지 않은 사용자의 커밋은 기본값으로 처리됩니다.
          </Alert>
        )}
        
        <Alert severity="info">
          마이그레이션을 시작하면 SVN 저장소의 전체 히스토리를 Git으로 변환합니다. 
          대규모 저장소의 경우 시간이 오래 걸릴 수 있습니다.
        </Alert>
      </Box>
    </Box>
  );
};

export default MigrationPreview;