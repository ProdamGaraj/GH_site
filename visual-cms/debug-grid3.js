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
    // Check all 4 cards
    const ids = ['gh-premium-1771840286937-74','gh-premium-1771840286937-83','gh-premium-1771840286937-92','gh-premium-1771840286937-99'];
    for (const id of ids) {
      const c = findNode(page.structure, id);
      if (c) {
        console.log(id, '-> tagName:', c.tagName, '| type:', c.type, '| keys:', Object.keys(c).filter(k => k !== 'children' && k !== 'styles').join(','));
      }
    }
  });
});
