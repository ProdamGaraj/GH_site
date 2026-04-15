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

function httpPut(path, body) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 5000, path, method: 'PUT', headers: { 'Content-Type': 'application/json' } };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Get page versions
  const versions = await httpGet('/api/pages/5f597235-130e-4f57-a0ac-1eb1f77af920/versions');
  console.log('Versions count:', Array.isArray(versions) ? versions.length : 'not array');
  
  if (Array.isArray(versions)) {
    versions.forEach((v, i) => {
      console.log(`  v${i}: id=${v.id}, version=${v.version}, createdAt=${v.createdAt}`);
    });
  }
  
  // 2. Find the version that had the header content
  for (const v of (Array.isArray(versions) ? versions : [])) {
    // Load version structure
    const ver = await httpGet(`/api/pages/5f597235-130e-4f57-a0ac-1eb1f77af920/versions/${v.id}`);
    const struct = ver.structure || ver;
    
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
    
    const header = findNode(struct, 'gh-tpl-1776150116604-1');
    const childCount = header ? (header.children ? header.children.length : 0) : -1;
    console.log(`  Version ${v.version} (${v.id}): header children=${childCount}`);
    
    if (childCount > 0) {
      console.log('  >>> FOUND VERSION WITH HEADER CONTENT!');
      console.log('  Header first child:', header.children[0].id, header.children[0].tagName);
      
      // Restore header to library block
      const headerBlock = header;
      console.log('  Restoring header block to library...');
      const result = await httpPut('/api/blocks/7441cdc0-3d58-4b18-aa3b-fd7549f8e807', {
        structure: headerBlock
      });
      console.log('  Restore result:', result.status);
      break;
    }
  }
}

main().catch(console.error);
