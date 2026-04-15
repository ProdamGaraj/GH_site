const http = require('http');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:5000${path}`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

async function main() {
  // 1. Check all pages for a header with content  
  const pages = await httpGet('/api/pages');
  const allPages = pages.items || pages;
  console.log('Total pages:', allPages.length);
  
  for (const p of allPages) {
    const page = await httpGet(`/api/pages/${p.id}`);
    if (!page.structure) continue;
    
    function findNodes(node, result) {
      if (!node) return;
      if (node.metadata?.linkedBlockId === '7441cdc0-3d58-4b18-aa3b-fd7549f8e807' || 
          node.id === 'gh-tpl-1776150116604-1' ||
          node.tagName === 'header') {
        result.push({
          id: node.id,
          tagName: node.tagName,
          children: node.children ? node.children.length : 0,
          linkedBlockId: node.metadata?.linkedBlockId
        });
      }
      if (node.children) node.children.forEach(c => findNodes(c, result));
    }
    
    const headers = [];
    findNodes(page.structure, headers);
    if (headers.length > 0) {
      console.log(`\nPage "${page.name}" (${page.slug}):`);
      headers.forEach(h => console.log(`  header: id=${h.id}, tag=${h.tagName}, children=${h.children}, linkedBlockId=${h.linkedBlockId}`));
    }
  }
  
  // 2. Check block versions  
  try {
    const blockVersions = await httpGet('/api/blocks/7441cdc0-3d58-4b18-aa3b-fd7549f8e807/versions');
    console.log('\nBlock versions:', Array.isArray(blockVersions) ? blockVersions.length : 'N/A');
  } catch(e) {
    console.log('\nBlock versions API not available');
  }
}

main().catch(console.error);
