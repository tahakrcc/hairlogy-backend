const fs = require('fs');
const f = 'src/pages/AdminPage.jsx';
const lines = fs.readFileSync(f, 'utf-8').split('\n');
console.log('Before:', lines.length, 'lines');
// Remove lines 1792-1899 (0-indexed: 1791-1898)
const newLines = [...lines.slice(0, 1791), ...lines.slice(1899)];
fs.writeFileSync(f, newLines.join('\n'), 'utf-8');
console.log('After:', newLines.length, 'lines');
console.log('Removed lines 1792-1899 (old duplicate code)');
