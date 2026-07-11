const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

// 1. Add Menu import
code = code.replace(/import \{ ([^}]+) \} from 'lucide-react'/, (match, p1) => {
  if (!p1.includes('Menu')) {
    return `import { ${p1}, Menu } from 'lucide-react'`;
  }
  return match;
});

// 2. Add isMobileMenuOpen state
if (!code.includes('isMobileMenuOpen')) {
  // Try to insert after activeTab fallback
  code = code.replace(/const activeTab = tab \|\| 'dashboard'/, `const activeTab = tab || 'dashboard'\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)`);
}

// 3. Update handleTabChange
if (!code.includes('setIsMobileMenuOpen(false)')) {
  code = code.replace(
    /const handleTabChange = \(tab\) => \{\s*navigate\(`\/admin\/\$\{tab\}`\)\s*\}/,
    `const handleTabChange = (tab) => {\n    navigate(\`/admin/\${tab}\`)\n    setIsMobileMenuOpen(false)\n  }`
  );
}

// 4. Update sidebar className
if (!code.includes('mobile-overlay')) {
  code = code.replace(
    /<aside className="admin-sidebar">/,
    `<div className={\`mobile-overlay \${isMobileMenuOpen ? 'show' : ''}\`} onClick={() => setIsMobileMenuOpen(false)}></div>\n        <aside className={\`admin-sidebar \${isMobileMenuOpen ? 'open' : ''}\`}>`
  );
}

// 5. Add Menu button
if (!code.includes('mobile-menu-btn')) {
  code = code.replace(
    /<div className="topbar-left">\s*<h2>\{activeTab/,
    `<div className="topbar-left">\n              <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>\n                <Menu size={24} />\n              </button>\n              <h2>{activeTab`
  );
}

fs.writeFileSync('src/pages/AdminPage.jsx', code);
console.log('Patched AdminPage.jsx successfully');
