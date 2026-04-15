// Remove 3 extra static cards from the grid, keeping only the template card (gh-premium-1771840286937-74)
const http = require('http');

const PAGE_ID = '5f597235-130e-4f57-a0ac-1eb1f77af920';
const GRID_ID = 'gh-premium-1771840286937-100';
const TEMPLATE_ID = 'gh-premium-1771840286937-74';
const REMOVE_IDS = ['gh-premium-1771840286937-83', 'gh-premium-1771840286937-92', 'gh-premium-1771840286937-99'];

function httpRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method, headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
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
  // 1. Get page
  const { data: page } = await httpRequest('GET', `/api/pages/${PAGE_ID}`);
  const structure = page.structure;
  
  // 2. Find grid container
  const grid = findNode(structure, GRID_ID);
  if (!grid) { console.error('Grid not found!'); return; }
  
  console.log('Before: grid children count =', grid.children.length);
  grid.children.forEach((c, i) => console.log(' ', i, c.id, c.tagName));
  
  // 3. Remove extra cards, keep only template
  grid.children = grid.children.filter(c => !REMOVE_IDS.includes(c.id));
  
  console.log('After: grid children count =', grid.children.length);
  grid.children.forEach((c, i) => console.log(' ', i, c.id, c.tagName));
  
  // 4. Save
  const { status, data } = await httpRequest('PUT', `/api/pages/${PAGE_ID}`, { structure });
  console.log('Save result:', status, data.id ? 'OK' : JSON.stringify(data));
}

main().catch(console.error);
