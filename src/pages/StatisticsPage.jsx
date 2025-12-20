import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, TrendingUp, Users, Calendar, DollarSign, Filter } from 'lucide-react'
import { adminAPI } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import './AdminPage.css' // Reusing Admin styles for consistency
import './StatisticsPage.css' // Specific stats styles

function StatisticsPage() {
    const navigate = useNavigate()
    const { t } = useLanguage()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState(null)
    const [dateRange, setDateRange] = useState('7') // 7, 30, 90

    useEffect(() => {
        loadStats()
    }, [])

    const loadStats = async () => {
        try {
            const response = await adminAPI.getStats(true) // showAll=true
            setStats(response.data)
        } catch (error) {
            console.error('Error loading stats:', error)
        } finally {
            setLoading(false)
        }
    }

    // Group trends by date
    const processTrends = () => {
        // We have stats.trends and stats.siteVisits
        const dailyData = {}

        // 1. Process Revenue/Visitors (from Bookings)
        if (stats?.trends) {
            stats.trends.forEach(item => {
                const date = item._id.date
                if (!dailyData[date]) {
                    dailyData[date] = { date, revenue: 0, customers: 0, siteVisits: 0 }
                }
                dailyData[date].revenue += item.revenue
                dailyData[date].customers += item.count // This is distinct customers (bookings)
            })
        }

        // 2. Process Site Visits (from DailyStats)
        if (stats?.siteVisits) {
            stats.siteVisits.forEach(item => {
                const date = item.date
                if (!dailyData[date]) {
                    dailyData[date] = { date, revenue: 0, customers: 0, siteVisits: 0 }
                }
                dailyData[date].siteVisits = item.visits
            })
        }

        // Convert to array and sort
        return Object.values(dailyData)
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Newest first
            .slice(0, parseInt(dateRange))
    }

    if (loading) return <div className="loading">Yükleniyor...</div>

    const trendData = processTrends()

    return (
        <div className="admin-page versace-vertical-border versace-vertical-border-right">
            <header className="admin-header">
                <div className="container header-inner">
                    <button className="back-btn" onClick={() => navigate('/admin')}>
                        <ArrowLeft size={20} />
                        Geri Dön
                    </button>
                    <div className="header-title">
                        <h1>İstatistikler</h1>
                        <p className="header-sub">Detaylı gelir ve ziyaretçi raporu</p>
                    </div>
                    <div style={{ width: 40 }}></div>
                </div>
            </header>

            <main className="admin-main">
                <div className="container">

                    {/* Summary Cards */}
                    <div className="quick-stats three-up">
                        <div className="stat-chip highlight">
                            <Users size={20} />
                            <div>
                                <p>Toplam Randevu</p>
                                <strong>{stats?.totalBookings || 0}</strong>
                            </div>
                        </div>
                        <div className="stat-chip highlight">
                            <Calendar size={20} />
                            <div>
                                <p>Bugün</p>
                                <strong>{stats?.todayBookings || 0}</strong>
                            </div>
                        </div>
                        <div className="stat-chip highlight">
                            <DollarSign size={20} />
                            <div>
                                <p>Toplam Gelir</p>
                                <strong>{stats?.totalRevenue || 0}₺</strong>
                            </div>
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="stats-filter-container">
                        <div className="filter-label">
                            <Filter size={16} />
                            <span>Görünüm:</span>
                        </div>
                        <div className="filter-options">
                            <button
                                className={`filter-btn ${dateRange === '7' ? 'active' : ''}`}
                                onClick={() => setDateRange('7')}
                            >Son 7 Gün</button>
                            <button
                                className={`filter-btn ${dateRange === '30' ? 'active' : ''}`}
                                onClick={() => setDateRange('30')}
                            >Son 30 Gün</button>
                            <button
                                className={`filter-btn ${dateRange === '90' ? 'active' : ''}`}
                                onClick={() => setDateRange('90')}
                            >Son 3 Ay</button>
                        </div>
                    </div>

                    {/* Daily Breakdown List */}
                    <div className="booking-sections">
                        <div className="section-header">
                            <h2>Günlük Gelir & Ziyaretçi</h2>
                        </div>

                        <div className="stats-list">
                            {trendData.length > 0 ? (
                                trendData.map((day, index) => (
                                    <div key={index} className="booking-card stat-card">
                                        <div className="stat-card-date">
                                            <span className="stat-day">{new Date(day.date).getDate()}</span>
                                            <span className="stat-month">
                                                {new Date(day.date).toLocaleDateString('tr-TR', { month: 'long' })}
                                            </span>
                                            <span className="stat-year">{new Date(day.date).getFullYear()}</span>
                                        </div>
                                        <div className="stat-card-metrics">
                                            <div className="stat-metric" title="Siteye Giren Kişi Sayısı">
                                                <Users size={16} className="text-blue" />
                                                <span className="metric-value">{day.siteVisits || 0} Ziyaret</span>
                                            </div>
                                            <div className="stat-metric" title="Gerçekleşen Randevu Sayısı">
                                                <Users size={16} className="text-gray" />
                                                <span className="metric-value">{day.customers} Müşteri</span>
                                            </div>
                                            <div className="stat-metric" title="Toplam Ciro">
                                                <TrendingUp size={16} className="text-gold" />
                                                <span className="metric-value revenue">{day.revenue}₺</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-bookings">
                                    Veri bulunamadı.
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}

export default StatisticsPage
