const { addDays, format, parseISO, isWithinInterval } = require('date-fns');

const stats = {
  trends: [],
  bookingTrends: [
    { _id: '2026-06-27', count: 20 },
    { _id: '2026-07-05', count: 10 }
  ]
};

const now = new Date('2026-07-11T12:00:00Z');
let startDate = addDays(now, -30);
let endDate = now;

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
console.log('tRev:', tRev);
console.log('tAppt:', tAppt);
console.log('cData:', cData);
