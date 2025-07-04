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

interface GroupData {
  name: string;
  path: string;
  parent_id?: string;
  description?: string;
  visibility?: string;
}

interface ImportResult {
  row: number;
  data: GroupData;
  status: 'success' | 'error' | 'pending';
  message?: string;
  groupId?: number;
}

interface ImportGroupsProps {
  selectedGroup?: {
    id: number;
    name: string;
    full_path: string;
  };
}

export const ImportGroups: React.FC<ImportGroupsProps> = ({ selectedGroup }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const parseCSV = (content: string): GroupData[] => {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const groups: GroupData[] = [];

    lines.forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 2) {
        groups.push({
          name: parts[0],
          path: parts[1],
          parent_id: parts[2] || undefined,
          description: parts[3] || undefined,
          visibility: parts[4] || 'private',
        });
      }
    });

    return groups;
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
      const groups = parseCSV(content);
      
      if (groups.length === 0) {
        setError('No valid groups found in the file');
        setParsing(false);
        return;
      }

      // Initialize results
      const initialResults: ImportResult[] = groups.map((group, index) => ({
        row: index + 1,
        data: group,
        status: 'pending',
      }));
      setResults(initialResults);
      setParsing(false);

      // Start importing
      setImporting(true);
      let completed = 0;

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const resultIndex = i;

        try {
          const createdGroup = await gitlabService.createGroup({
            name: group.name,
            path: group.path,
            description: group.description,
            visibility: group.visibility,
            parent_id: group.parent_id ? parseInt(group.parent_id) : selectedGroup?.id,
          });

          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'success',
              message: 'Group created successfully',
              groupId: createdGroup.id,
            };
            return updated;
          });
        } catch (err: any) {
          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'error',
              message: err.response?.data?.message || err.message || 'Failed to create group',
            };
            return updated;
          });
        }

        completed++;
        setProgress((completed / groups.length) * 100);
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
        Import Groups from CSV
      </Typography>
      
      {selectedGroup && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Creating groups under: <strong>{selectedGroup.full_path}</strong>
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        CSV Format: name|path|parent_id|description|visibility
        <br />
        Example: Frontend Team|frontend||Frontend development team|private
        {selectedGroup && (
          <>
            <br />
            <strong>Note:</strong> If parent_id is empty, groups will be created under {selectedGroup.name}
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
            Importing groups...
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
                <TableCell>Path</TableCell>
                <TableCell>Parent ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.row}>
                  <TableCell>{result.row}</TableCell>
                  <TableCell>{result.data.name}</TableCell>
                  <TableCell>{result.data.path}</TableCell>
                  <TableCell>{result.data.parent_id || '-'}</TableCell>
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