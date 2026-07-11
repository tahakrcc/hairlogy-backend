const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

code = code.replace(/navigate\(\/admin\/\\\)/g, 'navigate(`/admin/${unsavedModal.targetTab}`)');

fs.writeFileSync('src/pages/AdminPage.jsx', code, 'utf8');
