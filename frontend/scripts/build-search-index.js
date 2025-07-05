const fs = require('fs');
const path = require('path');

// Function to strip markdown syntax
function stripMarkdown(content) {
  return content
    // Remove code blocks
    .replace(/```[^`]*```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove bold and italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove horizontal rules
    .replace(/^---+$/gm, '')
    // Remove blockquotes
    .replace(/^>\s*/gm, '')
    // Remove list markers
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Remove tables
    .replace(/\|[^|]+\|/g, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Function to extract title from markdown
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'Untitled';
}

// Build the search index
function buildSearchIndex() {
  const docsDir = path.join(__dirname, '../public/docs');
  const manifestPath = path.join(docsDir, 'manifest.json');
  
  // Read manifest to get all docs
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const searchIndex = [];

  manifest.forEach(section => {
    section.items.forEach(item => {
      const filePath = path.join(docsDir, `${item.slug}.md`);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const title = item.title || extractTitle(content);
        const plainContent = stripMarkdown(content);
        
        // Create excerpt (first 200 characters)
        const excerpt = plainContent.substring(0, 200).trim() + '...';
        
        searchIndex.push({
          slug: item.slug,
          title: title,
          section: section.title,
          content: plainContent,
          excerpt: excerpt,
        });
        
        console.log(`Indexed: ${title}`);
      } else {
        console.warn(`Warning: File not found - ${filePath}`);
      }
    });
  });

  // Write search index
  const indexPath = path.join(docsDir, 'search-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(searchIndex, null, 2));
  
  console.log(`\nSearch index created with ${searchIndex.length} documents`);
  console.log(`Output: ${indexPath}`);
}

// Run the script
buildSearchIndex();