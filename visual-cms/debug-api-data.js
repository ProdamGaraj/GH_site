const http = require('http');
const DS_ID = 'fcf4abe2-e393-4b63-8d04-cc344831c6c5';
http.get(`http://localhost:5000/api/data-sources/${DS_ID}/data`, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const r = JSON.parse(d);
    console.log('Type:', typeof r, 'isArray:', Array.isArray(r), 'keys:', Object.keys(r).join(','));
    const items = Array.isArray(r) ? r : Array.isArray(r.data) ? r.data : [r];
    console.log('Items count:', items.length);
    items.forEach((it, i) => console.log(i, 'title:', it.title, '| slug:', it.slug, '| id:', it.id));
  });
});
