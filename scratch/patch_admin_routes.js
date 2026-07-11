const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

// 1. Add imports
const routerImports = `import { useNavigate, useParams } from 'react-router-dom'\nimport { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'`;
code = code.replace(/import \{ useState\, useEffect \} from 'react'/, `import { useState, useEffect } from 'react'\n${routerImports}`);

// 2. Replace activeTab state with useParams
const oldActiveTab = `const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard', 'bookings', 'barbers', 'customers', 'services', 'hours', 'settings'`;
const newActiveTab = `const { tab } = useParams()
  const navigate = useNavigate()
  const activeTab = tab || 'dashboard'
  
  const [timeFilter, setTimeFilter] = useState('monthly') // 'weekly', 'monthly', '3monthly', '6monthly', 'alltime', 'custom'
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [chartData, setChartData] = useState([])`;

code = code.replace(oldActiveTab, newActiveTab);

// 3. Update handleTabChange
const oldHandleTabChange = `  const handleTabChange = (targetTab) => {
    if (activeTab === targetTab) return

    let isDirty = false
    if (activeTab === 'hours') {
      isDirty = originalWorkingHours && JSON.stringify(workingHours) !== JSON.stringify(originalWorkingHours)
    } else if (activeTab === 'settings') {
      isDirty = originalGeneralSettings && JSON.stringify(generalSettings) !== JSON.stringify(originalGeneralSettings)
    }

    if (isDirty) {
      setUnsavedModal({ isOpen: true, targetTab })
    } else {
      setActiveTab(targetTab)
    }
  }`;
const newHandleTabChange = `  const handleTabChange = (targetTab) => {
    if (activeTab === targetTab) return

    let isDirty = false
    if (activeTab === 'hours') {
      isDirty = originalWorkingHours && JSON.stringify(workingHours) !== JSON.stringify(originalWorkingHours)
    } else if (activeTab === 'settings') {
      isDirty = originalGeneralSettings && JSON.stringify(generalSettings) !== JSON.stringify(originalGeneralSettings)
    }

    if (isDirty) {
      setUnsavedModal({ isOpen: true, targetTab })
    } else {
      navigate(\`/admin/\${targetTab}\`)
    }
  }`;
code = code.replace(oldHandleTabChange, newHandleTabChange);

// 4. Update loadStats
const oldLoadStats = `  const loadStats = async () => {
    try {
      const res = await api.get('/api/admin/stats', { headers: { Authorization: \`Bearer \${localStorage.getItem('adminToken')}\` } })
      setStats(res.data)
    } catch (e) { console.error(e) }
  }`;

const newLoadStats = `  const loadStats = async () => {
    try {
      let url = '/api/admin/stats?';
      if (timeFilter === 'custom') {
        if (customDateRange.start) url += \`&startDate=\${customDateRange.start}\`;
        if (customDateRange.end) url += \`&endDate=\${customDateRange.end}\`;
      } else {
        url += \`&filter=\${timeFilter}\`;
      }
      const res = await api.get(url, { headers: { Authorization: \`Bearer \${localStorage.getItem('adminToken')}\` } })
      setStats(res.data)
      if (res.data.chartData) setChartData(res.data.chartData)
    } catch (e) { console.error(e) }
  }
  
  useEffect(() => {
    if (isAuthenticated && activeTab === 'dashboard') {
      loadStats()
    }
  }, [timeFilter, customDateRange, isAuthenticated, activeTab])`;

code = code.replace(oldLoadStats, newLoadStats);

// 5. Replace Dashboard Tab JSX
const oldDashboard = `<div className="dashboard-tab">
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
            </div>`;

const newDashboard = `<div className="dashboard-tab">
               <div className="time-filter-section" style={{marginBottom: '20px', padding: '15px', backgroundColor: '#1e1e1e', borderRadius: '8px', border: '1px solid #333'}}>
                  <div className="filter-buttons" style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px'}}>
                    {['weekly', 'monthly', '3monthly', '6monthly', 'alltime', 'custom'].map(f => (
                       <button 
                         key={f} 
                         className={\`btn-secondary \${timeFilter === f ? 'active' : ''}\`}
                         style={timeFilter === f ? {backgroundColor: '#D4AF37', color: '#000'} : {}}
                         onClick={() => setTimeFilter(f)}
                       >
                         {f === 'weekly' && 'Haftalık'}
                         {f === 'monthly' && 'Aylık'}
                         {f === '3monthly' && '3 Aylık'}
                         {f === '6monthly' && '6 Aylık'}
                         {f === 'alltime' && 'Tüm Zamanlar'}
                         {f === 'custom' && 'Özel Tarih'}
                       </button>
                    ))}
                  </div>
                  
                  {timeFilter === 'custom' && (
                     <div className="custom-date-picker" style={{display: 'flex', gap: '15px', alignItems: 'center'}}>
                       <div>
                         <label style={{display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px'}}>Başlangıç:</label>
                         <input type="date" className="search-input" value={customDateRange.start} onChange={e => setCustomDateRange({...customDateRange, start: e.target.value})} />
                       </div>
                       <div>
                         <label style={{display: 'block', fontSize: '0.8rem', color: '#aaa', marginBottom: '5px'}}>Bitiş:</label>
                         <input type="date" className="search-input" value={customDateRange.end} onChange={e => setCustomDateRange({...customDateRange, end: e.target.value})} />
                       </div>
                     </div>
                  )}
               </div>

               <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon"><DollarSign /></div>
                    <div className="stat-info">
                      <p>Seçilen Aralık Cirosu</p>
                      <h3 style={{color: '#D4AF37'}}>{stats?.selectedRevenue || 0}₺</h3>
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon"><Calendar /></div>
                    <div className="stat-info">
                      <p>Seçilen Aralık Randevuları</p>
                      <h3>{stats?.selectedBookings || 0}</h3>
                    </div>
                  </div>
               </div>

               <div className="chart-container card" style={{height: '400px', padding: '20px', marginTop: '20px'}}>
                 <h3 style={{marginBottom: '20px'}}>Gelir ve Randevu Grafiği</h3>
                 {chartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                       <XAxis dataKey="date" stroke="#aaa" />
                       <YAxis yAxisId="left" stroke="#D4AF37" orientation="left" />
                       <YAxis yAxisId="right" stroke="#4ade80" orientation="right" />
                       <Tooltip contentStyle={{backgroundColor: '#1e1e1e', borderColor: '#333'}} />
                       <Line yAxisId="left" type="monotone" name="Ciro (₺)" dataKey="revenue" stroke="#D4AF37" activeDot={{ r: 8 }} />
                       <Line yAxisId="right" type="monotone" name="Randevu" dataKey="bookings" stroke="#4ade80" />
                     </LineChart>
                   </ResponsiveContainer>
                 ) : (
                   <div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa'}}>
                     Bu tarih aralığında veri bulunamadı.
                   </div>
                 )}
               </div>
            </div>`;

code = code.replace(oldDashboard, newDashboard);

fs.writeFileSync('src/pages/AdminPage.jsx', code, 'utf8');
