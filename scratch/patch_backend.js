const fs = require('fs');
let code = fs.readFileSync('server/index-mongodb.js', 'utf8');

const oldCode = `        const userBarberId = req.user?.barber_id;
        const { showAll } = req.query;
        const filter = {};
        if (userBarberId && showAll !== 'true') filter.barber_id = userBarberId;`;

const newCode = `        const userBarberId = req.user?.barber_id;
        const { showAll, filter: timeFilter, startDate, endDate } = req.query;
        const filter = {};
        if (userBarberId && showAll !== 'true') filter.barber_id = userBarberId;
        
        let minDate, maxDate;
        const now = new Date();
        maxDate = now.toISOString().split('T')[0];
        
        if (timeFilter === 'weekly') {
            const min = new Date(now); min.setDate(now.getDate() - 7);
            minDate = min.toISOString().split('T')[0];
        } else if (timeFilter === 'monthly') {
            const min = new Date(now); min.setMonth(now.getMonth() - 1);
            minDate = min.toISOString().split('T')[0];
        } else if (timeFilter === '3monthly') {
            const min = new Date(now); min.setMonth(now.getMonth() - 3);
            minDate = min.toISOString().split('T')[0];
        } else if (timeFilter === '6monthly') {
            const min = new Date(now); min.setMonth(now.getMonth() - 6);
            minDate = min.toISOString().split('T')[0];
        } else if (timeFilter === 'custom' || (!timeFilter && startDate)) {
            if (startDate) minDate = startDate;
            if (endDate) maxDate = endDate;
        }
        
        if (minDate || maxDate) {
            filter.appointment_date = {};
            if (minDate) filter.appointment_date.$gte = minDate;
            if (maxDate) filter.appointment_date.$lte = maxDate;
        }`;

code = code.replace(oldCode, newCode);

const oldRes = `        res.json({
            totalBookings,
            bookingsByStatus: bookingsByStatus.map(s => ({ status: s._id, count: s.count })),
            todayBookings,
            totalRevenue,
            weeklyRevenue,
            monthlyRevenue,
            threeMonthlyRevenue,
            trends,
            bookingTrends,
            siteVisits: siteVisits.map(v => ({ date: v.date, visits: v.visits }))
        });`;

const newRes = `        const selectedRevenue = allRevenueBookings.reduce((sum, b) => sum + (b.service_price || 0), 0);
        const selectedBookings = allRevenueBookings.length;
        
        // Group by Date for Chart
        const chartMap = {};
        allRevenueBookings.forEach(b => {
            const d = b.appointment_date;
            if (!chartMap[d]) chartMap[d] = { date: d, revenue: 0, bookings: 0 };
            chartMap[d].revenue += (b.service_price || 0);
            chartMap[d].bookings += 1;
        });
        
        let chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

        res.json({
            totalBookings,
            bookingsByStatus: bookingsByStatus.map(s => ({ status: s._id, count: s.count })),
            todayBookings,
            totalRevenue,
            weeklyRevenue,
            monthlyRevenue,
            threeMonthlyRevenue,
            selectedRevenue,
            selectedBookings,
            chartData,
            trends,
            bookingTrends,
            siteVisits: siteVisits.map(v => ({ date: v.date, visits: v.visits }))
        });`;

code = code.replace(oldRes, newRes);
fs.writeFileSync('server/index-mongodb.js', code, 'utf8');
