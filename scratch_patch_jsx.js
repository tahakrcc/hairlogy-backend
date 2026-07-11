const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

// 1. Add selectedCustomer state
if (!code.includes('selectedCustomer')) {
  code = code.replace(/const \[customerSearch, setCustomerSearch\] = useState\(''\);/, `const [customerSearch, setCustomerSearch] = useState('');\n    const [selectedCustomer, setSelectedCustomer] = useState(null);`);
}

// 2. Add Eye icon to lucide-react import
if (!code.includes('Eye,')) {
  code = code.replace(/import \{ LogOut/, 'import { LogOut, Eye');
}

// 3. Update search filter logic
const oldFilter = `Array.isArray(customers) ? customers : []).filter(c => String(c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || String(c.phone || '').includes(customerSearch))`;
const newFilter = `Array.isArray(customers) ? customers : []).filter(c => 
                         String(c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
                         String(c.phone || '').includes(customerSearch) || 
                         String(c.last_booking || '').includes(customerSearch)
                       )`;
code = code.replace(oldFilter, newFilter);

// 4. Update the Customers Table
const oldTableStr = `                   <table className="data-table">
                     <thead>
                       <tr>
                         <th>MǬYteri Ad</th>
                         <th>Telefon</th>
                         <th>Toplam Randevu</th>
                         <th>Son Randevu Tarihi</th>
                       </tr>
                     </thead>
                     <tbody>
                       {(Array.isArray(customers) ? customers : []).filter(c => 
                         String(c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
                         String(c.phone || '').includes(customerSearch) || 
                         String(c.last_booking || '').includes(customerSearch)
                       ).map((c, i) => (
                         <tr key={i}>
                           <td>{c.name}</td>
                           <td>{c.phone}</td>
                           <td>{c.total_bookings}</td>
                           <td>{c.last_booking}</td>
                         </tr>
                       ))}
                       {Array.isArray(customers) && customers.length === 0 && <tr><td colSpan="4" className="text-center muted">MǬYteri bulunamad.</td></tr>}
                     </tbody>
                   </table>`;

// Note: MǬYteri Ad is what was read by Select-String. I'll use a regex to replace the table safely.
const tableRegex = /<table className="data-table">[\s\S]*?<\/table>/;

const newTableHtml = `<table className="data-table">
                     <thead>
                       <tr>
                         <th>Müşteri Adı</th>
                         <th>Telefon</th>
                         <th>Toplam Randevu</th>
                         <th>Son Randevu Tarihi</th>
                         <th></th>
                       </tr>
                     </thead>
                     <tbody>
                       {(Array.isArray(customers) ? customers : []).filter(c => 
                         String(c.name || '').toLowerCase().includes(customerSearch.toLowerCase()) || 
                         String(c.phone || '').includes(customerSearch) || 
                         String(c.last_booking || '').includes(customerSearch)
                       ).map((c, i) => (
                         <tr key={i}>
                           <td>{c.name}</td>
                           <td>{c.phone}</td>
                           <td>{c.total_bookings}</td>
                           <td>{c.last_booking}</td>
                           <td>
                             <button className="customer-eye-btn" onClick={() => setSelectedCustomer(c)}>
                               <Eye size={20} />
                             </button>
                           </td>
                         </tr>
                       ))}
                       {Array.isArray(customers) && customers.length === 0 && <tr><td colSpan="5" className="text-center muted">Müşteri bulunamadı.</td></tr>}
                     </tbody>
                   </table>`;

if (tableRegex.test(code)) {
    code = code.replace(tableRegex, newTableHtml);
} else {
    console.log("Could not find data-table in customers-tab");
}

// 5. Add Customer Details Modal
const modalHtml = `
            {selectedCustomer && (
              <div className="modal-overlay" onClick={() => setSelectedCustomer(null)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h2>Müşteri Detayları</h2>
                    <button className="close-btn" onClick={() => setSelectedCustomer(null)}><X size={24} /></button>
                  </div>
                  <div className="modal-body customer-modal-details">
                    <div className="detail-row">
                      <strong>Ad Soyad:</strong>
                      <span>{selectedCustomer.name}</span>
                    </div>
                    <div className="detail-row">
                      <strong>Telefon:</strong>
                      <span>{selectedCustomer.phone}</span>
                    </div>
                    {selectedCustomer.email && (
                      <div className="detail-row">
                        <strong>E-posta:</strong>
                        <span>{selectedCustomer.email}</span>
                      </div>
                    )}
                    <div className="detail-row">
                      <strong>Toplam Randevu:</strong>
                      <span>{selectedCustomer.total_bookings}</span>
                    </div>
                    <div className="detail-row">
                      <strong>Son Randevu:</strong>
                      <span>{selectedCustomer.last_booking}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
`;

// Insert the modal at the end of the admin-content div or just before the final return closing div
const finalDivIndex = code.lastIndexOf('</div>\n    </div>\n  )\n}');
if (finalDivIndex !== -1 && !code.includes('customer-modal-details')) {
    code = code.slice(0, finalDivIndex) + modalHtml + code.slice(finalDivIndex);
} else {
    console.log("Could not insert modal");
}

fs.writeFileSync('src/pages/AdminPage.jsx', code, 'utf8');
console.log("AdminPage.jsx patched successfully.");
