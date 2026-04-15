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

function findNode(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    for (const c of node.children) {
      const r = findNode(c, id);
      if (r) return r;
    }
  }
  return null;
}

async function main() {
  const page = await httpGet('/api/pages/5f597235-130e-4f57-a0ac-1eb1f77af920');
  const grid = findNode(page.structure, 'gh-premium-1771840286937-100');
  
  console.log('=== RAW structure (before updateLinkedBlocks) ===');
  console.log('Grid children count:', grid.children.length);
  grid.children.forEach((c, i) => {
    console.log(`  ${i}: id=${c.id}, tagName=${c.tagName}, linkedBlockId=${c.metadata?.linkedBlockId || 'none'}, name=${c.metadata?.name || c.props?.name || ''}`);
  });
}

main().catch(console.error);
