import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  IconButton,
  Collapse,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { addJob, updateJob, JobStatus } from '../store/slices/jobsSlice';

interface JobDetail {
  message: string;
  timestamp: Date;
}

interface Job {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  startTime: Date;
  endTime?: Date;
  details: JobDetail[];
  totalItems?: number;
  processedItems?: number;
  errors?: string[];
}

const JobRow: React.FC<{ job: Job }> = ({ job }) => {
  const [open, setOpen] = useState(false);

  const getStatusChip = (status: JobStatus) => {
    switch (status) {
      case 'running':
        return <Chip icon={<HourglassEmptyIcon />} label="Running" color="primary" size="small" />;
      case 'completed':
        return <Chip icon={<CheckCircleIcon />} label="Completed" color="success" size="small" />;
      case 'failed':
        return <Chip icon={<ErrorIcon />} label="Failed" color="error" size="small" />;
      case 'pending':
        return <Chip label="Pending" color="default" size="small" />;
    }
  };

  const getDuration = () => {
    const start = new Date(job.startTime);
    const end = job.endTime ? new Date(job.endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{job.id}</TableCell>
        <TableCell>{job.type}</TableCell>
        <TableCell>{getStatusChip(job.status)}</TableCell>
        <TableCell>
          {job.status === 'running' && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress variant="determinate" value={job.progress} />
              </Box>
              <Box sx={{ minWidth: 35 }}>
                <Typography variant="body2" color="text.secondary">{`${Math.round(job.progress)}%`}</Typography>
              </Box>
            </Box>
          )}
          {job.status === 'completed' && (
            <Typography variant="body2">
              {job.processedItems}/{job.totalItems} items
            </Typography>
          )}
          {job.status === 'failed' && (
            <Typography variant="body2" color="error">
              {job.errors?.length || 0} errors
            </Typography>
          )}
        </TableCell>
        <TableCell>{new Date(job.startTime).toLocaleString()}</TableCell>
        <TableCell>{getDuration()}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="h6" gutterBottom component="div">
                Job Details
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {job.details.map((detail, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(detail.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell>{detail.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {job.errors && job.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" color="error">
                    Errors:
                  </Typography>
                  {job.errors.map((error, index) => (
                    <Typography key={index} variant="body2" color="error">
                      • {error}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

export const JobMonitoring: React.FC = () => {
  const dispatch = useDispatch();
  const jobs = useSelector((state: RootState) => state.jobs.jobs);
  
  // Simulate real-time job updates
  useEffect(() => {
    // Simulate a new job every 10 seconds for demo
    const interval = setInterval(() => {
      const jobTypes = ['Import Groups', 'Import Projects', 'Delete Group', 'Create Projects'];
      const newJob: Job = {
        id: `JOB-${Date.now()}`,
        type: jobTypes[Math.floor(Math.random() * jobTypes.length)],
        status: 'pending',
        progress: 0,
        startTime: new Date(),
        details: [{ message: 'Job created', timestamp: new Date() }],
        totalItems: Math.floor(Math.random() * 50) + 10,
        processedItems: 0,
      };
      
      dispatch(addJob(newJob));
      
      // Simulate job progress
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 20;
        if (progress >= 100) {
          progress = 100;
          dispatch(updateJob({
            id: newJob.id,
            status: Math.random() > 0.8 ? 'failed' : 'completed',
            progress: 100,
            endTime: new Date(),
            processedItems: newJob.totalItems,
            details: [
              ...newJob.details,
              { 
                message: progress === 100 ? 'Job completed successfully' : 'Job failed', 
                timestamp: new Date() 
              }
            ],
            errors: progress === 100 && Math.random() > 0.8 ? ['Some items failed to process'] : undefined,
          }));
          clearInterval(progressInterval);
        } else {
          dispatch(updateJob({
            id: newJob.id,
            status: 'running',
            progress,
            processedItems: Math.floor((progress / 100) * (newJob.totalItems || 0)),
            details: [
              ...newJob.details,
              { 
                message: `Processing item ${Math.floor((progress / 100) * (newJob.totalItems || 0))}`, 
                timestamp: new Date() 
              }
            ],
          }));
        }
      }, 1000);
      
      return () => clearInterval(progressInterval);
    }, 15000);
    
    return () => clearInterval(interval);
  }, [dispatch]);

  const getJobStats = () => {
    const stats = {
      total: jobs.length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
    return stats;
  };

  const stats = getJobStats();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Job Monitoring
      </Typography>
      
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Jobs
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Running
              </Typography>
              <Typography variant="h4" color="primary">
                {stats.running}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {stats.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failed
              </Typography>
              <Typography variant="h4" color="error">
                {stats.failed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Job ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Start Time</TableCell>
              <TableCell>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="textSecondary">
                    No jobs yet. Jobs will appear here when you perform bulk operations.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};