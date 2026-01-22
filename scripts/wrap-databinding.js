// Node.js script to wrap DndContext in DataBindingProvider
const fs = require('fs');
const path = require('path');

const file = 'c:\\Users\\d.tolkunov\\CodeRepository\\GH_site\\visual-cms\\frontend\\src\\pages\\Editor.tsx';

// Read file content
let content = fs.readFileSync(file, 'utf8');

// Show lines around 580 and 728
const lines = content.split('\n');
console.log('=== Lines 578-590 (1-indexed 578-590) ===');
for (let i = 577; i < 590 && i < lines.length; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
console.log('');
console.log('=== Lines 725-731 (1-indexed 725-731) ===');
for (let i = 724; i < 731 && i < lines.length; i++) {
    console.log(`${i+1}: ${lines[i]}`);
}
console.log('');

// Define replacements
// Pattern 1: After "return (" insert DataBindingProvider before DndContext
const oldPattern1 = '  return (\n    <DndContext';
const newPattern1 = '  return (\n    <DataBindingProvider pageId={id || \'new\'}>\n      <DndContext';

// Pattern 2: Close DataBindingProvider after DndContext
const oldPattern2 = '    </DndContext>\n  );';
const newPattern2 = '      </DndContext>\n    </DataBindingProvider>\n  );';

let replaced1 = false;
let replaced2 = false;

if (content.includes(oldPattern1)) {
    content = content.replace(oldPattern1, newPattern1);
    replaced1 = true;
    console.log('Pattern 1 (LF) replaced');
}

if (content.includes(oldPattern2)) {
    content = content.replace(oldPattern2, newPattern2);
    replaced2 = true;
    console.log('Pattern 2 (LF) replaced');
}

if (replaced1 && replaced2) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('');
    console.log('=== File updated successfully ===');
} else {
    console.log('');
    console.log('=== Replacements not complete, file NOT updated ===');
    if (!replaced1) console.log('Pattern 1 not found');
    if (!replaced2) console.log('Pattern 2 not found');
}
