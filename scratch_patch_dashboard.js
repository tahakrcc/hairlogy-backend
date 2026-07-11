const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

const effectCode = `
  useEffect(() => {
    if (!stats || !stats.trends || !stats.bookingTrends) return;

    const now = new Date();
    let startDate = new Date(0);
    let endDate = now;

    if (timeFilter === 'weekly') startDate = addDays(now, -7);
    else if (timeFilter === 'monthly') startDate = addDays(now, -30);
    else if (timeFilter === '3monthly') startDate = addDays(now, -90);
    else if (timeFilter === '6monthly') startDate = addDays(now, -180);
    else if (timeFilter === 'custom' && customDateRange.start && customDateRange.end) {
      startDate = new Date(customDateRange.start);
      endDate = new Date(customDateRange.end);
      endDate.setHours(23, 59, 59, 999);
    }

    let tRev = 0;
    let tAppt = 0;
    const chartMap = {};

    stats.trends.forEach(t => {
      const d = parseISO(t._id.date);
      if (isWithinInterval(d, { start: startDate, end: endDate })) {
        tRev += t.revenue;
        const dateStr = format(d, 'yyyy-MM-dd');
        if (!chartMap[dateStr]) chartMap[dateStr] = { date: dateStr, revenue: 0, bookings: 0 };
        chartMap[dateStr].revenue += t.revenue;
      }
    });

    stats.bookingTrends.forEach(t => {
      const d = parseISO(t._id);
      if (isWithinInterval(d, { start: startDate, end: endDate })) {
        tAppt += t.count;
        const dateStr = format(d, 'yyyy-MM-dd');
        if (!chartMap[dateStr]) chartMap[dateStr] = { date: dateStr, revenue: 0, bookings: 0 };
        chartMap[dateStr].bookings += t.count;
      }
    });

    const cData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));
    setChartData(cData);

    // If these states exist, set them (if they don't, we'll patch the render code to use these local vars or state)
  }, [stats, timeFilter, customDateRange]);

  // We need to store totalRevenue and totalAppointments in state
`;

// Also I need to make sure totalRevenue and totalAppointments state exist for the dashboard to show them.
if (!code.includes('const [dashboardTotalRevenue')) {
  code = code.replace(
    /const \[chartData, setChartData\] = useState\(\[\]\)/,
    `const [chartData, setChartData] = useState([])\n    const [dashboardTotalRevenue, setDashboardTotalRevenue] = useState(0)\n    const [dashboardTotalAppointments, setDashboardTotalAppointments] = useState(0)`
  );
}

// In the useEffect, add setDashboardTotalRevenue
code = code.replace(
  /setChartData\(cData\);/,
  `setChartData(cData);\n    setDashboardTotalRevenue(tRev);\n    setDashboardTotalAppointments(tAppt);`
);

if (!code.includes('setDashboardTotalAppointments(tAppt)')) {
  code = code.replace(/useEffect\(\(\) => \{\n      if \(activeTab === 'customers'\)/, effectCode + `\n  useEffect(() => {\n      if (activeTab === 'customers')`);
}

// Update render code to use the new dashboard stats
code = code.replace(
  /Seçilen Aralık Cirosu<\/span>[\s\S]*?<\/div>[\s\S]*?Seçilen Aralık Randevuları<\/span>[\s\S]*?<\/div>/,
  `Seçilen Aralık Cirosu</span>
                      <div style={{fontSize: '24px', fontWeight: 'bold', color: 'var(--accent)'}}>{dashboardTotalRevenue}₺</div>
                    </div>
                  </div>
                  <div className="stat-card" style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
                    <div className="stat-icon" style={{background: 'var(--bg-card)', padding: '15px', borderRadius: '12px'}}>
                      <Calendar size={32} color="var(--text-secondary)" />
                    </div>
                    <div>
                      <span style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>Seçilen Aralık Randevuları</span>
                      <div style={{fontSize: '24px', fontWeight: 'bold'}}>{dashboardTotalAppointments}</div>`
);

fs.writeFileSync('src/pages/AdminPage.jsx', code);
console.log('Patched AdminPage.jsx dashboard logic successfully');
