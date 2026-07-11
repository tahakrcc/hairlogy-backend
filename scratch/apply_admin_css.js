const fs = require('fs');
let css = fs.readFileSync('src/pages/AdminPage.css', 'utf8');
const newCss = `

/* =========================================
   NEW SIDEBAR LAYOUT
   ========================================= */
.admin-layout {
  display: flex;
  min-height: 100vh;
  background-color: #121212;
}

.admin-sidebar {
  width: 250px;
  background-color: #1e1e1e;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  position: fixed;
  height: 100vh;
  z-index: 100;
}

.sidebar-brand {
  padding: 20px;
  border-bottom: 1px solid #333;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-brand h2 {
  margin: 0;
  color: #D4AF37; /* Gold */
  font-size: 1.5rem;
}

.sidebar-brand .badge {
  background-color: #333;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.7rem;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 0;
  overflow-y: auto;
}

.sidebar-nav .nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 20px;
  background: transparent;
  border: none;
  color: #aaa;
  text-align: left;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1rem;
}

.sidebar-nav .nav-item:hover, .sidebar-nav .nav-item.active {
  background-color: rgba(212, 175, 55, 0.1);
  color: #D4AF37;
  border-right: 3px solid #D4AF37;
}

.sidebar-footer {
  padding: 20px;
  border-top: 1px solid #333;
}

.sidebar-footer .logout-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background-color: transparent;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.sidebar-footer .logout-btn:hover {
  background-color: #ff4d4f;
  color: #fff;
}

.admin-content {
  flex: 1;
  margin-left: 250px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.admin-topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  background-color: #1e1e1e;
  border-bottom: 1px solid #333;
}

.admin-topbar h2 {
  margin: 0;
  font-size: 1.5rem;
}

.topbar-right {
  display: flex;
  gap: 15px;
}

/* =========================================
   DASHBOARD STATS
   ========================================= */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background-color: #1e1e1e;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.stat-icon {
  background-color: rgba(212, 175, 55, 0.1);
  color: #D4AF37;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon svg {
  width: 24px;
  height: 24px;
}

.stat-info p {
  margin: 0 0 5px 0;
  color: #aaa;
  font-size: 0.9rem;
}

.stat-info h3 {
  margin: 0;
  font-size: 1.5rem;
  color: #fff;
}

/* =========================================
   NEW TABS (KOLTUK YÖNETİMİ, MÜŞTERİLER)
   ========================================= */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  padding: 20px;
}

.section-header h3 {
  margin: 0 0 5px 0;
}

.barbers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  padding: 20px;
}

.barber-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.barber-card-header h4 {
  margin: 0;
}

.barber-card-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  border-top: 1px solid #333;
  padding-top: 15px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th, .data-table td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #333;
}

.data-table th {
  background-color: #111;
  color: #aaa;
  font-weight: 500;
}

/* =========================================
   MOBILE RESPONSIVENESS
   ========================================= */
@media (max-width: 768px) {
  .admin-layout {
    flex-direction: column;
  }
  
  .admin-sidebar {
    width: 100%;
    height: auto;
    position: relative;
    border-right: none;
    border-bottom: 1px solid #333;
  }
  
  .sidebar-nav {
    display: flex;
    overflow-x: auto;
    padding: 10px;
    white-space: nowrap;
  }
  
  .sidebar-nav .nav-item {
    width: auto;
    padding: 10px 15px;
    border-right: none;
    border-bottom: 3px solid transparent;
  }
  
  .sidebar-nav .nav-item.active {
    border-right: none;
    border-bottom: 3px solid #D4AF37;
  }
  
  .sidebar-footer {
    display: none;
  }
  
  .admin-content {
    margin-left: 0;
  }
  
  .admin-topbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
  
  .topbar-right {
    width: 100%;
    justify-content: space-between;
  }
}
`;

if (!css.includes('.admin-layout')) {
  fs.writeFileSync('src/pages/AdminPage.css', css + '\n' + newCss, 'utf8');
}
