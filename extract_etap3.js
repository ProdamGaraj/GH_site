const fs = require('fs');
const path = 'c:\\Users\\d.tolkunov\\CodeRepository\\GH_site\\visual-cms\\docs\\data-binding-system-spec.md';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
// Lines 1312-1393 (0-indexed: 1311-1392)
const output = lines.slice(1311, 1393).join('\n');
const outPath = 'c:\\Users\\d.tolkunov\\CodeRepository\\GH_site\\etap3_output.txt';
fs.writeFileSync(outPath, output);
console.log('Content written to', outPath);
