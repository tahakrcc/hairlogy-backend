const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8').replace(/\r\n/g, '\n');

// 1. Change activeTab default
content = content.replace("const [activeTab, setActiveTab] = useState('bookings') // 'bookings', 'services', 'hours', 'settings'",
  "const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard', 'bookings', 'barbers', 'customers', 'services', 'hours', 'settings'");

// 2. Add imports: TrendingUp, Users, DollarSign
if (!content.includes('TrendingUp')) {
  content = content.replace("import { Plus, X, Edit2, Trash2, Check, Clock, Calendar, Scissors, Settings, LogOut, ChevronLeft, ChevronRight } from 'lucide-react'",
    "import { Plus, X, Edit2, Trash2, Check, Clock, Calendar, Scissors, Settings, LogOut, ChevronLeft, ChevronRight, TrendingUp, Users, DollarSign } from 'lucide-react'");
}

// 3. Replace layout header and nav
const oldHeaderNav = `<div className="admin-page versace-vertical-border versace-vertical-border-right">
      <header className="admin-header">
        <div className="container header-inner">
          <div className="header-title">
            <h1>Admin</h1>
            <p className="header-sub">14 günlük takvim, mobil öncelikli</p>
          </div>
          <div className="header-actions">
            <button
              className={\`maintenance-toggle-btn \${maintenanceMode ? 'active' : ''}\`}
              onClick={handleToggleMaintenance}
              disabled={maintenanceLoading}
              title={maintenanceMode ? 'Bakım Modunu Kapat' : 'Bakım Modunu Aç'}
            >
              <Settings size={18} className={maintenanceLoading ? 'spin' : ''} />
              <span>{maintenanceMode ? 'Bakımı Kapat' : 'Siteyi Bakıma Al'}</span>
            </button>
            <button
              className="create-booking-btn"
              onClick={() => setShowCreateBookingModal(true)}
              title="Yeni Randevu Oluştur"
            >
              <Plus size={18} />
              <span>Randevu Ekle</span>
            </button>
            <button className="refresh-btn outline" onClick={() => loadBookings(showAllBookings)}>Yenile</button>
            <button onClick={handleLogout} className="logout-btn">
              <LogOut size={18} />
              <span>Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="admin-tabs">
        <div className="container">
          <button
            className={\`tab-btn \${activeTab === 'bookings' ? 'active' : ''}\`}
            onClick={() => handleTabChange('bookings')}
          >
            <Calendar size={16} />
            <span>Randevular</span>
          </button>
          <button
            className={\`tab-btn \${activeTab === 'services' ? 'active' : ''}\`}
            onClick={() => handleTabChange('services')}
          >
            <Scissors size={16} />
            <span>Hizmetler</span>
          </button>
          <button
            className={\`tab-btn \${activeTab === 'hours' ? 'active' : ''}\`}
            onClick={() => handleTabChange('hours')}
          >
            <Clock size={16} />
            <span>Saatler</span>
          </button>
          <button
            className={\`tab-btn \${activeTab === 'settings' ? 'active' : ''}\`}
            onClick={() => handleTabChange('settings')}
          >
            <Settings size={16} />
            <span>Ayarlar</span>
          </button>
        </div>
      </nav>`;

const newLayout = `<div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <h2>Hairlogy</h2>
          <span className="badge">Admin</span>
        </div>
        <nav className="sidebar-nav">
          <button className={\`nav-item \${activeTab === 'dashboard' ? 'active' : ''}\`} onClick={() => handleTabChange('dashboard')}><TrendingUp size={18} /><span>Dashboard</span></button>
          <button className={\`nav-item \${activeTab === 'bookings' ? 'active' : ''}\`} onClick={() => handleTabChange('bookings')}><Calendar size={18} /><span>Randevular</span></button>
          <button className={\`nav-item \${activeTab === 'barbers' ? 'active' : ''}\`} onClick={() => handleTabChange('barbers')}><Users size={18} /><span>Koltuk Yönetimi</span></button>
          <button className={\`nav-item \${activeTab === 'customers' ? 'active' : ''}\`} onClick={() => handleTabChange('customers')}><Users size={18} /><span>Müşteriler</span></button>
          <button className={\`nav-item \${activeTab === 'services' ? 'active' : ''}\`} onClick={() => handleTabChange('services')}><Scissors size={18} /><span>Hizmetler</span></button>
          <button className={\`nav-item \${activeTab === 'hours' ? 'active' : ''}\`} onClick={() => handleTabChange('hours')}><Clock size={18} /><span>Çalışma Saatleri</span></button>
          <button className={\`nav-item \${activeTab === 'settings' ? 'active' : ''}\`} onClick={() => handleTabChange('settings')}><Settings size={18} /><span>Genel Ayarlar</span></button>
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <LogOut size={18} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <header className="admin-topbar">
          <div className="topbar-left">
            <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
          </div>
          <div className="topbar-right">
             <button
              className={\`maintenance-toggle-btn \${maintenanceMode ? 'active' : ''}\`}
              onClick={handleToggleMaintenance}
              disabled={maintenanceLoading}
              title={maintenanceMode ? 'Bakım Modunu Kapat' : 'Bakım Modunu Aç'}
            >
              <Settings size={18} className={maintenanceLoading ? 'spin' : ''} />
              <span>{maintenanceMode ? 'Bakımı Kapat' : 'Siteyi Bakıma Al'}</span>
            </button>
            <button className="create-booking-btn" onClick={() => setShowCreateBookingModal(true)}>
              <Plus size={18} /> Yeni Randevu
            </button>
          </div>
        </header>`;

if (content.includes(oldHeaderNav)) {
  content = content.replace(oldHeaderNav, newLayout);
  console.log('Replaced header/nav with sidebar layout successfully.');
} else {
  console.log('Could not find oldHeaderNav string! Maybe formatting mismatch.');
}

// 4. Add the new tabs after <main className="admin-main">\n        <div className="container">
const mainContainerSplit = `<main className="admin-main">\n        <div className="container">`;
const newTabs = `
          {/* ============ DASHBOARD TAB ============ */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-tab">
               <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon"><DollarSign /></div>
                    <div className="stat-info">
                      <p>Haftalık Ciro</p>
                      <h3>{stats?.weeklyRevenue || 0}₺</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><DollarSign /></div>
                    <div className="stat-info">
                      <p>Aylık Ciro</p>
                      <h3>{stats?.monthlyRevenue || 0}₺</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><DollarSign /></div>
                    <div className="stat-info">
                      <p>3 Aylık Ciro</p>
                      <h3>{stats?.threeMonthlyRevenue || 0}₺</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Calendar /></div>
                    <div className="stat-info">
                      <p>Toplam Randevu</p>
                      <h3>{stats?.totalBookings || 0}</h3>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* ============ MÜŞTERİLER TAB ============ */}
          {activeTab === 'customers' && (
            <div className="customers-tab card">
               <div className="section-header">
                 <div>
                   <h3>Müşteri Listesi</h3>
                   <p className="muted">Geçmiş randevu alan tüm müşteriler</p>
                 </div>
                 <input 
                   type="text" 
                   placeholder="İsim veya telefon ile ara..." 
                   value={customerSearch}
                   onChange={e => setCustomerSearch(e.target.value)}
                   className="search-input"
                 />
               </div>
               <div className="table-responsive">
                 <table className="data-table">
                   <thead>
                     <tr>
                       <th>Müşteri Adı</th>
                       <th>Telefon</th>
                       <th>Toplam Randevu</th>
                       <th>Son Randevu Tarihi</th>
                     </tr>
                   </thead>
                   <tbody>
                     {customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).map((c, i) => (
                       <tr key={i}>
                         <td>{c.name}</td>
                         <td>{c.phone}</td>
                         <td>{c.total_bookings}</td>
                         <td>{c.last_booking}</td>
                       </tr>
                     ))}
                     {customers.length === 0 && <tr><td colSpan="4" className="text-center muted">Müşteri bulunamadı.</td></tr>}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {/* ============ KOLTUK / BERBER TAB ============ */}
          {activeTab === 'barbers' && (
            <div className="barbers-tab card">
               <div className="section-header">
                 <div>
                   <h3>Koltuk Yönetimi</h3>
                   <p className="muted">Sistemdeki koltukları (berberleri) yönetin</p>
                 </div>
                 <button className="btn-primary" onClick={() => {
                   setBarberForm({ name: '', active: true, role: 'barber', special_hours: null, special_break: null })
                   setEditingBarberId(null)
                   setShowBarberModal(true)
                 }}>
                   <Plus size={16} />
                   <span>Yeni Koltuk Ekle</span>
                 </button>
               </div>
               <div className="barbers-grid">
                  {Object.values(barbers).map((b, i) => (
                     <div key={i} className="barber-card card">
                        <div className="barber-card-header">
                          <h4>{b.name}</h4>
                          <span className={\`status-badge \${b.active ? 'success' : 'error'}\`}>{b.active ? 'Aktif' : 'Pasif'}</span>
                        </div>
                        <p className="muted" style={{marginBottom: '1rem'}}>Koltuk No: {b.barber_id}</p>
                        
                        <div className="barber-card-actions">
                          <button className="icon-btn" onClick={() => {
                            setBarberForm({ 
                              name: b.name, 
                              active: b.active, 
                              role: b.role, 
                              special_hours: b.special_hours || null, 
                              special_break: b.special_break || null 
                            })
                            setEditingBarberId(b.barber_id)
                            setShowBarberModal(true)
                          }} title="Düzenle">
                            <Edit2 size={16} />
                          </button>
                          <button className="icon-btn danger" onClick={() => handleDeleteBarber(b.barber_id)} title="Sil">
                            <Trash2 size={16} />
                          </button>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          )}
`;
if (content.includes(mainContainerSplit) && !content.includes('DASHBOARD TAB')) {
  content = content.replace(mainContainerSplit, mainContainerSplit + newTabs);
  console.log('Added dashboard, customers, barbers tabs successfully.');
}

const barberModalJSX = `
      {/* BERBER/KOLTUK MODAL */}
      {showBarberModal && (
        <div className="modal-overlay" onClick={() => setShowBarberModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingBarberId ? 'Koltuk Düzenle' : 'Yeni Koltuk Ekle'}</h2>
              <button className="close-btn" onClick={() => setShowBarberModal(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveBarber}>
              <div className="form-group">
                <label>Koltuk / Berber Adı</label>
                <input
                  type="text"
                  value={barberForm.name}
                  onChange={e => setBarberForm({...barberForm, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  id="barber_active"
                  checked={barberForm.active}
                  onChange={e => setBarberForm({...barberForm, active: e.target.checked})}
                />
                <label htmlFor="barber_active">Aktif (Randevu Alınabilir)</label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBarberModal(false)}>İptal</button>
                <button type="submit" className="btn-primary" disabled={savingService}>
                  {savingService ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
`;

// 5. Add closing div replacement
const oldEnd = `      )}
    </div >
  )
}`;
const newEnd = `      )}
${barberModalJSX}
      </div>
    </div>
  )
}`;
if (content.includes(oldEnd)) {
  content = content.replace(oldEnd, newEnd);
  console.log('Replaced end closing div layout successfully.');
}

fs.writeFileSync('src/pages/AdminPage.jsx', content, 'utf8');
