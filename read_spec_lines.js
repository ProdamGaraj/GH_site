const fs = require('fs');
const path = 'c:\\Users\\d.tolkunov\\CodeRepository\\GH_site\\visual-cms\\docs\\data-binding-system-spec.md';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
// Lines 1312-1500 (0-indexed: 1311-1499)
const output = lines.slice(1311, 1500).join('\n');
console.log(output);
