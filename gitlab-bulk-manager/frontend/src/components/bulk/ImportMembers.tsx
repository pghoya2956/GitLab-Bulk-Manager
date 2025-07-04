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

interface MemberData {
  email: string;
  group_path: string;
  access_level: string;
  expiry_date?: string;
}

interface ImportResult {
  row: number;
  data: MemberData;
  status: 'success' | 'error' | 'pending';
  message?: string;
}

const accessLevelMap: Record<string, number> = {
  guest: 10,
  reporter: 20,
  developer: 30,
  maintainer: 40,
  owner: 50,
};

interface ImportMembersProps {
  selectedGroup?: {
    id: number;
    name: string;
    full_path: string;
  };
}

export const ImportMembers: React.FC<ImportMembersProps> = ({ selectedGroup }) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const parseCSV = (content: string): MemberData[] => {
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    const members: MemberData[] = [];

    lines.forEach(line => {
      const parts = line.split('|').map(p => p.trim());
      if (parts.length >= 3) {
        members.push({
          email: parts[0],
          group_path: parts[1],
          access_level: parts[2],
          expiry_date: parts[3] || undefined,
        });
      }
    });

    return members;
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
      const members = parseCSV(content);
      
      if (members.length === 0) {
        setError('No valid members found in the file');
        setParsing(false);
        return;
      }

      // Initialize results
      const initialResults: ImportResult[] = members.map((member, index) => ({
        row: index + 1,
        data: member,
        status: 'pending',
      }));
      setResults(initialResults);
      setParsing(false);

      // Start importing
      setImporting(true);
      let completed = 0;

      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const resultIndex = i;

        try {
          // First, find the group by path or use selected group
          let group;
          if (member.group_path) {
            const groups = await gitlabService.getGroups({ search: member.group_path });
            group = groups.find((g: any) => g.full_path === member.group_path);
            
            if (!group) {
              throw new Error(`Group not found: ${member.group_path}`);
            }
          } else if (selectedGroup) {
            group = { id: selectedGroup.id };
          } else {
            throw new Error('No group specified and no default group selected');
          }

          // Get user by email
          const users = await gitlabService.getUsers({ search: member.email });
          const user = users.find((u: any) => u.email === member.email);
          
          if (!user) {
            throw new Error(`User not found: ${member.email}`);
          }

          // Add member to group
          const accessLevel = accessLevelMap[member.access_level.toLowerCase()] || parseInt(member.access_level);
          
          await gitlabService.addGroupMember(group.id, {
            user_id: user.id,
            access_level: accessLevel,
            expires_at: member.expiry_date,
          });

          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'success',
              message: 'Member added successfully',
            };
            return updated;
          });
        } catch (err: any) {
          setResults(prev => {
            const updated = [...prev];
            updated[resultIndex] = {
              ...updated[resultIndex],
              status: 'error',
              message: err.response?.data?.message || err.message || 'Failed to add member',
            };
            return updated;
          });
        }

        completed++;
        setProgress((completed / members.length) * 100);
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
        Import Members from CSV
      </Typography>
      
      {selectedGroup && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Default group for member assignment: <strong>{selectedGroup.full_path}</strong>
        </Alert>
      )}
      
      <Alert severity="info" sx={{ mb: 3 }}>
        CSV Format: email|group_path|access_level|expiry_date
        <br />
        Example: user@example.com|dev-division/frontend|developer|2024-12-31
        <br />
        Access levels: guest, reporter, developer, maintainer, owner (or 10, 20, 30, 40, 50)
        {selectedGroup && (
          <>
            <br />
            <strong>Note:</strong> If group_path is empty, members will be added to {selectedGroup.name}
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
            Importing members...
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
                <TableCell>Email</TableCell>
                <TableCell>Group Path</TableCell>
                <TableCell>Access Level</TableCell>
                <TableCell>Expiry Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.row}>
                  <TableCell>{result.row}</TableCell>
                  <TableCell>{result.data.email}</TableCell>
                  <TableCell>{result.data.group_path}</TableCell>
                  <TableCell>{result.data.access_level}</TableCell>
                  <TableCell>{result.data.expiry_date || '-'}</TableCell>
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