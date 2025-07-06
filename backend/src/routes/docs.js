import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const router = express.Router();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to documentation files
const DOCS_PATH = path.join(__dirname, '../../../frontend/docs');

// Allowed documentation files for security
const ALLOWED_DOCS = [
  'README',
  'getting-started',
  'features',
  'architecture',
  'components',
  'api-integration',
  'development',
  'testing',
  'deployment'
];

// Get a specific documentation file
router.get('/:docId', async (req, res) => {
  try {
    const { docId } = req.params;
    
    // Validate docId to prevent directory traversal
    if (!ALLOWED_DOCS.includes(docId)) {
      return res.status(404).json({ error: 'Documentation not found' });
    }
    
    const filePath = path.join(DOCS_PATH, `${docId}.md`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      res.type('text/markdown').send(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Documentation file not found' });
      }
      throw error;
    }
  } catch (error) {
    logger.error('Documentation fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documentation' });
  }
});

// Get list of available documentation
router.get('/', async (req, res) => {
  try {
    const docs = ALLOWED_DOCS.map(id => ({
      id,
      path: `/api/docs/${id}`
    }));
    res.json(docs);
  } catch (error) {
    logger.error('Documentation list error:', error);
    res.status(500).json({ error: 'Failed to list documentation' });
  }
});

export default router;