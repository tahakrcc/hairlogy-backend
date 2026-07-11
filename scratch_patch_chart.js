const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

const newChartBlock = `               <div className="chart-container card" style={{padding: '20px', marginTop: '20px'}}>
                 <h3 style={{marginBottom: '20px'}}>Gelir ve Randevu Grafiği</h3>
                 <div style={{width: '100%', overflowX: 'auto', paddingBottom: '10px'}}>
                   <div style={{minWidth: '500px', height: '350px'}}>
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
                 </div>
               </div>`;

// We'll just replace the broken chunk.
const regex = /<div className="chart-container card" style=\{\{padding: '20px', marginTop: '20px'\}\}>[\s\S]*?<\/div>[\s\S]*?\)\}[\s\S]*?<\/div>/;

if (regex.test(code)) {
    code = code.replace(regex, newChartBlock);
    fs.writeFileSync('src/pages/AdminPage.jsx', code, 'utf8');
    console.log("Chart block restored successfully");
} else {
    console.log("Regex did not match!");
}
