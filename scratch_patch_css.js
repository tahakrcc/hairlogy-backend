const fs = require('fs');
let css = fs.readFileSync('src/pages/AdminPage.css', 'utf8');

// 1. Update .admin-content for mobile width
if (!css.includes('max-width: 100vw')) {
  css = css.replace(/\.admin-content\s*\{[^}]+\}/g, match => {
    if (match.includes('margin-left: 260px')) {
      return match.replace('}', '  min-width: 0;\n  max-width: 100vw;\n  overflow-x: hidden;\n}');
    }
    return match;
  });
}

// 2. Add Mobile Customers Table Styles
const mobileCustomersCss = `
/* Mobile Customers Table */
@media (max-width: 768px) {
  .customers-tab .data-table th:nth-child(2),
  .customers-tab .data-table td:nth-child(2),
  .customers-tab .data-table th:nth-child(3),
  .customers-tab .data-table td:nth-child(3),
  .customers-tab .data-table th:nth-child(4),
  .customers-tab .data-table td:nth-child(4) {
    display: none;
  }
  
  .customers-tab .data-table th:nth-child(5),
  .customers-tab .data-table td:nth-child(5) {
    display: table-cell;
    text-align: right;
  }
  
  .customer-eye-btn {
    background: transparent;
    border: none;
    color: var(--primary);
    cursor: pointer;
    padding: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
}

@media (min-width: 769px) {
  .customers-tab .data-table th:nth-child(5),
  .customers-tab .data-table td:nth-child(5) {
    display: none;
  }
}

.customer-modal-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 20px;
}
.customer-modal-details .detail-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}
.customer-modal-details .detail-row strong {
  color: var(--text-muted);
}
`;

if (!css.includes('Mobile Customers Table')) {
  css += '\n' + mobileCustomersCss;
}

fs.writeFileSync('src/pages/AdminPage.css', css, 'utf8');
console.log("AdminPage.css updated successfully.");
