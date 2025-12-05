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
  'deployment',
  'permission-tree',
  'api-reference',
  'troubleshooting',
];

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'ko'];

// Extract YAML frontmatter from markdown content
function extractFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[1];
    const body = match[2];
    const metadata = {};

    // Parse simple YAML frontmatter
    frontmatter.split('\n').forEach((line) => {
      const [key, value] = line.split(':').map((s) => s.trim());
      if (key && value) {
        metadata[key] = value.replace(/^["']|["']$/g, '');
      }
    });

    return { metadata, content: body };
  }

  return { metadata: {}, content };
}

// Get a specific documentation file
router.get('/:lang/:docId', async (req, res) => {
  try {
    const { lang, docId } = req.params;

    // Validate language
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return res.status(404).json({ error: 'Language not supported' });
    }

    // Validate docId to prevent directory traversal
    if (!ALLOWED_DOCS.includes(docId)) {
      return res.status(404).json({ error: 'Documentation not found' });
    }

    // Try language-specific file first
    let filePath = path.join(DOCS_PATH, lang, `${docId}.md`);
    let content = null;

    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Fallback to root directory for backward compatibility
        filePath = path.join(DOCS_PATH, `${docId}.md`);
        try {
          content = await fs.readFile(filePath, 'utf-8');
        } catch (fallbackError) {
          if (fallbackError.code === 'ENOENT') {
            return res.status(404).json({ error: 'Documentation file not found' });
          }
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }

    // Extract frontmatter and return as JSON
    const { metadata, content: markdownContent } = extractFrontmatter(content);

    res.json({
      content: markdownContent,
      metadata,
      language: lang,
      path: `${lang}/${docId}`,
    });
  } catch (error) {
    logger.error('Documentation fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documentation' });
  }
});

// Get list of available documentation for a language
router.get('/:lang', async (req, res) => {
  try {
    const { lang } = req.params;

    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      return res.status(404).json({ error: 'Language not supported' });
    }

    const docs = await Promise.all(
      ALLOWED_DOCS.map(async (id) => {
        const langPath = path.join(DOCS_PATH, lang, `${id}.md`);
        const rootPath = path.join(DOCS_PATH, `${id}.md`);

        // Check if language-specific version exists
        let exists = false;
        try {
          await fs.access(langPath);
          exists = true;
        } catch {
          // Check root directory
          try {
            await fs.access(rootPath);
            exists = true;
          } catch {
            exists = false;
          }
        }

        return {
          id,
          path: `/api/docs/${lang}/${id}`,
          exists,
        };
      }),
    );

    res.json(docs.filter((doc) => doc.exists));
  } catch (error) {
    logger.error('Documentation list error:', error);
    res.status(500).json({ error: 'Failed to list documentation' });
  }
});

// Get list of all available documentation
router.get('/', async (req, res) => {
  try {
    const languages = SUPPORTED_LANGUAGES.map((lang) => ({
      code: lang,
      name: lang === 'en' ? 'English' : '한국어',
      path: `/api/docs/${lang}`,
    }));

    res.json({
      languages,
      documents: ALLOWED_DOCS,
    });
  } catch (error) {
    logger.error('Documentation list error:', error);
    res.status(500).json({ error: 'Failed to list documentation' });
  }
});

export default router;