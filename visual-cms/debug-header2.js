const http = require('http');
http.get('http://localhost:5000/api/blocks/7441cdc0-3d58-4b18-aa3b-fd7549f8e807', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const block = JSON.parse(d);
    const s = block.structure;
    console.log('Block structure:');
    console.log('  id:', s.id);
    console.log('  tagName:', s.tagName);
    console.log('  children:', s.children ? s.children.length : 0);
    if (s.children && s.children.length > 0) {
      s.children.forEach((c, i) => console.log(`  child[${i}]:`, c.id, c.tagName, c.metadata?.name));
    } else {
      console.log('  EMPTY STRUCTURE');
      console.log('  Full:', JSON.stringify(s).substring(0, 500));
    }
  });
});
