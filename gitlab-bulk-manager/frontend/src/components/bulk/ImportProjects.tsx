import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { gitlabService } from '../../services/gitlab';

interface ProjectData {
  name: string;
  group_id: string;
  description?: string;
  visibility?: string;
  issues_enabled?: boolean;
  wiki_enabled?: boolean;
  default_branch?: string;
}

interface ImportResult {
  row: number;
  data: ProjectData;
  status: 'success' | 'error' | 'pending';
  message?: string;
  projectId?: number;
}

interface ImportProjectsProps {
  selectedGroup?: {
    id: number;
    name: string;
    full_path: string;
  };
}

export const ImportProjects: React.FC<ImportProjectsProps> = ({ selectedGroup }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const parseCSV = (content: string): ProjectData[] => {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const projects: ProjectData[] = [];

    lines.forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        projects.push({
          name: parts[0],
          group_id: parts[1],
          description: parts[2] || undefined,
          visibility: parts[3] || 'private',
          issues_enabled: parts[4] === 'true',
          wiki_enabled: parts[5] === 'true',
          default_branch: parts[6] || 'main',
        });
      }
    });

    return projects;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResults([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setParsing(true);
    setError(null);

    try {
      const content = await file.text();
      const projects = parseCSV(content);
      
      if (projects.length === 0) {
        setError('No valid projects found in the file');
        setParsing(false);
        return;
      }

      // Initialize results
      const initialResults: ImportResult[] = projects.map((project, index) => ({
        row: index + 1,
        data: project,
        status: 'pending',
      }));
      setResults(initialResults);
      setParsing(false);

      // Start importing
      setImporting(true);
      let completed = 0;

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        const resultIndex = i;

        try {
          const createdProject = await gitlabService.createProject({
            name: project.name,
            namespace_id: project.group_id ? parseInt(project.group_id) : selectedGroup?.id || 0,
            description: project.description,
            visibility: project.visibility,
          });

          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'success',
              message: 'Project created successfully',
              projectId: createdProject.id,
            };
            return updated;
          });
        } catch (err: any) {
          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'error',
              message: err.response?.data?.message || err.message || 'Failed to create project',
            };
            return updated;
          });
        }

        completed++;
        setProgress((completed / projects.length) * 100);
      }

      setImporting(false);
    } catch (err: any) {
      setError('Failed to parse file: ' + err.message);
      setParsing(false);
    }
  };

  const getStatusChip = (status: ImportResult['status']) => {
    switch (status) {
      case 'success':
        return <Chip label="Success" color="success" size="small" />;
      case 'error':
        return <Chip label="Failed" color="error" size="small" />;
      case 'pending':
        return <Chip label="Pending" color="default" size="small" />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Import Projects from CSV
      </Typography>
      
      {selectedGroup && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Creating projects in: <strong>{selectedGroup.full_path}</strong>
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        CSV Format: name|group_id|description|visibility|issues_enabled|wiki_enabled|default_branch
        <br />
        Example: web-main|110|Main website|private|true|true|main
        {selectedGroup && (
          <>
            <br />
            <strong>Note:</strong> If group_id is empty, projects will be created in {selectedGroup.name}
          </>
        )}
      </Alert>

      <Box sx={{ mb: 3 }}>
        <input
          accept=".csv,.txt"
          style={{ display: 'none' }}
          id="file-upload"
          type="file"
          onChange={handleFileSelect}
          disabled={importing}
        />
        <label htmlFor="file-upload">
          <Button
            variant="contained"
            component="span"
            startIcon={<CloudUploadIcon />}
            disabled={importing}
          >
            Select File
          </Button>
        </label>
        
        {file && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Selected: {file.name}
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {file && !parsing && !importing && results.length === 0 && (
        <Button variant="contained" color="primary" onClick={handleUpload}>
          Start Import
        </Button>
      )}

      {importing && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Importing projects...
          </Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      {results.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Row</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Group ID</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.row}>
                  <TableCell>{result.row}</TableCell>
                  <TableCell>{result.data.name}</TableCell>
                  <TableCell>{result.data.group_id}</TableCell>
                  <TableCell>{result.data.description || '-'}</TableCell>
                  <TableCell>{getStatusChip(result.status)}</TableCell>
                  <TableCell>{result.message || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};