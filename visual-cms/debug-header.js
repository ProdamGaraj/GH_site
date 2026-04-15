const http = require('http');
http.get('http://localhost:5000/api/pages/5f597235-130e-4f57-a0ac-1eb1f77af920', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const page = JSON.parse(d);
    function findNode(node, id) {
      if (!node) return null;
      if (node.id === id) return node;
      if (node.children) { for (const c of node.children) { const r = findNode(c, id); if (r) return r; } }
      return null;
    }
    const header = findNode(page.structure, 'gh-tpl-1776150116604-1');
    if (header) {
      console.log('Header node:', JSON.stringify({
        id: header.id,
        tagName: header.tagName,
        metadata: header.metadata,
        childrenCount: header.children ? header.children.length : 0
      }, null, 2));
    } else {
      console.log('Header not found!');
      // Look for any node with "header" in name
      function searchByName(node, depth) {
        if (!node) return;
        if (node.metadata?.name?.toLowerCase().includes('header') || node.id?.includes('tpl')) {
          console.log('  Found:', node.id, node.metadata?.name, 'linkedBlockId:', node.metadata?.linkedBlockId, 'children:', node.children?.length || 0);
        }
        if (node.children) node.children.forEach(c => searchByName(c, depth + 1));
      }
      searchByName(page.structure, 0);
    }
  });
});
