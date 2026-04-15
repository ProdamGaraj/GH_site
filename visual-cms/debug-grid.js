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
    const grid = findNode(page.structure, 'gh-premium-1771840286937-100');
    if (grid) {
      console.log('Grid children count:', grid.children ? grid.children.length : 0);
      if (grid.children) grid.children.forEach((c, i) => console.log(i, c.id, c.tag, c.props?.name || ''));
    } else { console.log('Grid not found'); }
  });
});
