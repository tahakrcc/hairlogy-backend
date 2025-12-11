import React, { useState, useEffect } from 'react'
import { LogOut, Calendar, Users, DollarSign, CheckCircle, XCircle, Clock, Trash2, Filter, Send, Phone, MessageSquare, ChevronRight, ChevronLeft } from 'lucide-react'
import { adminAPI, default as api } from '../services/api'
import Toast from '../components/Toast'
import './AdminPage.css'
import { addDays, format, startOfDay, isWithinInterval, parseISO, isSameDay } from 'date-fns'
import { tr } from 'date-fns/locale'

const statusConfig = {
  pending: { label: 'Beklemede', color: 'warning', icon: Clock },
  confirmed: { label: 'Onaylandı', color: 'info', icon: CheckCircle },
  completed: { label: 'Tamamlandı', color: 'success', icon: CheckCircle },
  cancelled: { label: 'İptal', color: 'error', icon: XCircle }
}

function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({ status: '', barberId: '', date: '' })
  const [showAllBookings, setShowAllBookings] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [dayBookings, setDayBookings] = useState([])
  const [closedDates, setClosedDates] = useState([])
  const [showClosedDateForm, setShowClosedDateForm] = useState(false)
  const [closedDateForm, setClosedDateForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [showFilters, setShowFilters] = useState(false)

  const horizonStart = startOfDay(new Date())
  const horizonEnd = startOfDay(addDays(horizonStart, 13)) // 14 günlük görünüm
  const horizonDays = Array.from({ length: 14 }).map((_, idx) => addDays(horizonStart, idx))

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return

    checkBackendConnection().then(() => {
      loadBookings()
      loadStats()
      loadClosedDates()
    })

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadBookings()
        loadStats()
      }
    }, 15000)

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadBookings()
        loadStats()
      }
    }

    const handleFocus = () => {
      loadBookings()
      loadStats()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) {
      loadBookings()
    }
  }, [filters, showAllBookings])

  const checkBackendConnection = async () => {
    try {
      await api.get('/health')
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Backend connection check failed:', error.message)
      }
    }
  }

  const checkAuth = () => {
    const token = localStorage.getItem('adminToken')
    const username = localStorage.getItem('adminUsername')
    const barberId = localStorage.getItem('adminBarberId')
    if (token) {
      setIsAuthenticated(true)
      if (username) setCurrentUser(username)
      const showAll = localStorage.getItem('showAllBookings') === 'true'
      setShowAllBookings(showAll)
      if (barberId && !showAll) {
        setFilters(prev => ({ ...prev, barberId: String(barberId) }))
      }
    }
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    // Form validasyonu
    if (!loginForm.username || !loginForm.password) {
      setToast({ message: 'Lütfen kullanıcı adı ve şifre girin.', type: 'error' })
      return
    }
    
    // Loading state ekle
    setLoginLoading(true)
    
    try {
      const response = await adminAPI.login(loginForm.username, loginForm.password)
      
      if (response && response.data && response.data.token) {
        localStorage.setItem('adminToken', response.data.token)
        localStorage.setItem('adminUsername', response.data.username)
        if (response.data.barber_id) {
          localStorage.setItem('adminBarberId', response.data.barber_id)
          if (!showAllBookings) {
            setFilters(prev => ({ ...prev, barberId: String(response.data.barber_id) }))
          }
        }
        setCurrentUser(response.data.username)
        setIsAuthenticated(true)
        setToast({ message: 'Giriş başarılı!', type: 'success' })
        // Form'u temizle
        setLoginForm({ username: '', password: '' })
      } else {
        setToast({ message: 'Giriş başarısız: Geçersiz yanıt alındı.', type: 'error' })
      }
    } catch (error) {
      console.error('Login error:', error)
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
        code: error.code
      })
      
      // Hata mesajını belirle
      let errorMessage = 'Giriş başarısız'
      const errorStatus = error.response?.status
      const errorData = error.response?.data
      const requestUrl = error.config?.url || 'unknown'

      // Backend'den gelen hata mesajını al
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData
        } else if (errorData.error) {
          errorMessage = errorData.error
        } else if (errorData.message) {
          errorMessage = errorData.message
        }
      } else if (error.message) {
        errorMessage = error.message
      }

      // CORS hatası kontrolü
      if (error.message?.includes('CORS') || error.message?.includes('Access-Control-Allow-Origin') || error.message?.includes('blocked by CORS')) {
        setToast({ 
          message: 'CORS hatası: Backend CORS ayarlarını kontrol edin. Backend\'in frontend domain\'ini allow list\'ine eklemesi gerekiyor.', 
          type: 'error' 
        })
      } 
      // Network hatası
      else if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.code === 'ERR_NETWORK' || error.message?.includes('Failed to fetch')) {
        if (requestUrl.includes('your-backend-url.com')) {
          setToast({ 
            message: 'Backend URL yapılandırılmamış! Netlify Dashboard\'dan VITE_API_URL environment variable\'ını ekleyin.', 
            type: 'error' 
          })
        } else {
          setToast({ 
            message: 'Backend sunucusuna bağlanılamıyor. Lütfen backend\'in çalıştığından emin olun.', 
            type: 'error' 
          })
        }
      } 
      // 401 Unauthorized - Kullanıcı adı veya şifre hatalı
      else if (errorStatus === 401) {
        setToast({ 
          message: 'Kullanıcı adı veya şifre hatalı. Lütfen tekrar deneyin.', 
          type: 'error' 
        })
        // Şifreyi temizle
        setLoginForm(prev => ({ ...prev, password: '' }))
      } 
      // 400 Bad Request
      else if (errorStatus === 400) {
        setToast({ 
          message: errorMessage || 'Kullanıcı adı ve şifre gereklidir.', 
          type: 'error' 
        })
      }
      // 429 Too Many Requests
      else if (errorStatus === 429) {
        setToast({ 
          message: errorMessage || 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.', 
          type: 'error' 
        })
      } 
      // 500 Server Error
      else if (errorStatus === 500) {
        setToast({ 
          message: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.', 
          type: 'error' 
        })
      }
      // Diğer hatalar
      else {
        setToast({ 
          message: `Giriş hatası: ${errorMessage}`, 
          type: 'error' 
        })
      }
    } finally {
      setLoginLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    localStorage.removeItem('adminBarberId')
    setCurrentUser(null)
    setShowAllBookings(false)
    setIsAuthenticated(false)
    setBookings([])
    setStats(null)
  }

  const loadBookings = async (showAll = showAllBookings) => {
    try {
      const params = {}
      if (filters.status) params.status = filters.status
      if (filters.barberId) params.barberId = filters.barberId
      if (filters.date) params.date = filters.date
      if (showAll) params.showAll = 'true'

      const response = await adminAPI.getBookings(params)
      setBookings(response.data)
    } catch (error) {
      if (error.response?.status === 401) {
        handleLogout()
      } else if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
        setToast({ message: 'Backend sunucusuna bağlanılamıyor.', type: 'error' })
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Bilinmeyen hata'
        setToast({ message: `Randevular yüklenirken hata oluştu: ${errorMsg}`, type: 'error' })
      }
    }
  }

  const loadStats = async () => {
    try {
      const response = await adminAPI.getStats()
      setStats(response.data)
    } catch (error) {
      console.error('Load stats error:', error)
    }
  }

  const loadClosedDates = async () => {
    try {
      const response = await adminAPI.getClosedDates()
      setClosedDates(response.data)
    } catch (error) {
      console.error('Load closed dates error:', error)
    }
  }

  const handleCreateClosedDate = async (e) => {
    e.preventDefault()
    try {
      await adminAPI.createClosedDate(closedDateForm)
      setClosedDateForm({ start_date: '', end_date: '', reason: '' })
      setShowClosedDateForm(false)
      loadClosedDates()
      setToast({ message: 'Kapalı tarih aralığı eklendi', type: 'success' })
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Bilinmeyen hata'
      const overlaps = error.response?.data?.overlaps
      if (overlaps?.length) {
        setToast({ message: `${errorMsg}. Çakışan: ${overlaps.map(o => `${o.start_date} - ${o.end_date}`).join(', ')}`, type: 'error' })
      } else {
        setToast({ message: `Kapalı tarih eklenirken hata: ${errorMsg}`, type: 'error' })
      }
    }
  }

  const handleDeleteClosedDate = async (id) => {
    if (!confirm('Bu kapalı tarih aralığını silmek istediğinize emin misiniz?')) return
    try {
      await adminAPI.deleteClosedDate(id)
      loadClosedDates()
      setToast({ message: 'Kapalı tarih silindi', type: 'success' })
    } catch (error) {
      setToast({ message: 'Kapalı tarih silinirken hata oluştu', type: 'error' })
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      await adminAPI.updateBooking(id, newStatus)
      loadBookings()
      loadStats()
      setToast({ message: 'Durum güncellendi', type: 'success' })
    } catch (error) {
      setToast({ message: 'Durum güncellenirken hata oluştu', type: 'error' })
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Bu randevuyu silmek istediğinize emin misiniz?')) return
    try {
      await adminAPI.deleteBooking(id)
      loadBookings()
      loadStats()
      setToast({ message: 'Randevu silindi', type: 'success' })
    } catch (error) {
      setToast({ message: 'Randevu silinirken hata oluştu', type: 'error' })
    }
  }

  const handleCancel = async (id) => {
    if (!window.confirm('Bu randevuyu iptal etmek istediğinize emin misiniz?')) return
    try {
      await adminAPI.updateBooking(id, 'cancelled')
      loadBookings()
      loadStats()
      setToast({ message: 'Randevu iptal edildi', type: 'success' })
    } catch (error) {
      setToast({ message: 'Randevu iptal edilirken hata oluştu', type: 'error' })
    }
  }

  const handleReminder = async (booking) => {
    if (!booking.customer_email) {
      setToast({ message: 'Bu randevuda email adresi yok.', type: 'error' })
      return
    }
    try {
      await adminAPI.sendReminder(booking.id)
      setToast({ message: 'Hatırlatma maili gönderildi', type: 'success' })
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Hatırlatma gönderilemedi'
      setToast({ message: errorMsg, type: 'error' })
    }
  }

  const handleCall = (phone) => {
    window.location.href = `tel:${phone}`
  }

  const handleMessage = (phone) => {
    const message = encodeURIComponent('Merhaba, randevunuz hakkında bilgilendirme yapmak istiyoruz.')
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  const getStatusBadge = (status) => {
    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon
    return (
      <span className={`status-badge ${config.color}`}>
        <Icon size={14} />
        {config.label}
      </span>
    )
  }

  const filteredBookings = bookings.filter((booking) => {
    const matchesStatus = filters.status ? booking.status === filters.status : true
    const matchesBarber = filters.barberId ? String(booking.barber_id || booking.barberId) === String(filters.barberId) : true
    const matchesDate = filters.date ? booking.appointment_date === filters.date : true
    const inHorizon = booking.appointment_date
      ? isWithinInterval(parseISO(booking.appointment_date), { start: horizonStart, end: horizonEnd })
      : true
    return matchesStatus && matchesBarber && matchesDate && inHorizon
  })

  const bookingsByDate = horizonDays.map((day) => {
    const formatted = format(day, 'yyyy-MM-dd')
    return {
      date: formatted,
      label: format(day, "d MMM, EEEE", { locale: tr }),
      bookings: filteredBookings.filter((b) => b.appointment_date === formatted)
    }
  })

  const getStatusCount = (status) => stats?.bookingsByStatus?.find((s) => s.status === status)?.count || 0

  const openDay = (date, bookingsForDay) => {
    setSelectedDay(date)
    setDayBookings(bookingsForDay)
    setShowDetailSheet(true)
    setSelectedBooking(null)
  }

  const closeSheet = () => {
    setShowDetailSheet(false)
    setTimeout(() => {
      setSelectedBooking(null)
      setSelectedDay(null)
      setDayBookings([])
    }, 200)
  }

  if (loading) {
    return <div className="admin-loading">Yükleniyor...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page versace-vertical-border versace-vertical-border-right">
        <div className="admin-login-card">
          <h1>Admin Girişi</h1>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Kullanıcı Adı</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                autoComplete="username"
                required
              />
            </div>
            <div className="form-group">
              <label>Şifre</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              className="login-btn" 
              disabled={loginLoading}
            >
              {loginLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page versace-vertical-border versace-vertical-border-right">
      <header className="admin-header">
        <div className="container header-inner">
          <div className="header-title">
            <h1>Admin</h1>
            <p className="header-sub">14 günlük takvim, mobil öncelikli</p>
          </div>
          <div className="header-actions">
            <button className="refresh-btn outline" onClick={() => loadBookings(showAllBookings)}>Yenile</button>
            <button onClick={handleLogout} className="logout-btn">
              <LogOut size={18} />
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <div className="container">
          <div className="quick-stats">
            <div className="stat-chip">
              <Calendar size={18} />
              <div>
                <p>Toplam</p>
                <strong>{stats?.totalBookings ?? 0}</strong>
              </div>
            </div>
            <div className="stat-chip">
              <Clock size={18} />
              <div>
                <p>Bugün</p>
                <strong>{stats?.todayBookings ?? 0}</strong>
              </div>
            </div>
            <div className="stat-chip">
              <Users size={18} />
              <div>
                <p>Bekleyen</p>
                <strong>{getStatusCount('pending')}</strong>
              </div>
            </div>
            <div className="stat-chip">
              <DollarSign size={18} />
              <div>
                <p>Toplam Gelir</p>
                <strong>{stats?.totalRevenue?.toFixed?.(0) ?? '0'}₺</strong>
              </div>
            </div>
          </div>

          <div className="filter-bar">
            <button className="filter-toggle" onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} />
              Filtreler
            </button>
            <label className="show-all-toggle">
              <input
                type="checkbox"
                checked={showAllBookings}
                onChange={(e) => {
                  const checked = e.target.checked
                  setShowAllBookings(checked)
                  localStorage.setItem('showAllBookings', checked ? 'true' : 'false')
                  if (!checked) {
                    const barberId = localStorage.getItem('adminBarberId')
                    if (barberId) setFilters(prev => ({ ...prev, barberId: String(barberId) }))
                  } else {
                    setFilters(prev => ({ ...prev, barberId: '' }))
                  }
                  loadBookings(checked)
                }}
              />
              <span>Tüm randevular</span>
            </label>
          </div>

          {showFilters && (
            <div className="filters-sheet">
              <div className="filter-group">
                <span>Durum</span>
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
                  <option value="">Hepsi</option>
                  <option value="pending">Beklemede</option>
                  <option value="confirmed">Onaylandı</option>
                  <option value="completed">Tamamlandı</option>
                  <option value="cancelled">İptal</option>
                </select>
              </div>
              <div className="filter-group">
                <span>Berber</span>
                <select value={filters.barberId} onChange={(e) => setFilters({ ...filters, barberId: e.target.value })}>
                  <option value="">Hepsi</option>
                  <option value="1">Hıdır Yasin Gökçeoğlu</option>
                  <option value="2">Emir Gökçeoğlu</option>
                </select>
              </div>
              <div className="filter-group">
                <span>Tarih</span>
                <input
                  type="date"
                  value={filters.date}
                  onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                />
              </div>
              <div className="filter-actions">
                <button className="outline" onClick={() => setFilters({ status: '', barberId: '', date: '' })}>Temizle</button>
                <button className="primary" onClick={() => { setShowFilters(false); loadBookings() }}>Uygula</button>
              </div>
            </div>
          )}

          <section className="card calendar-card">
            <div className="calendar-header">
              <div>
                <p className="muted">14 günlük görünüm</p>
                <strong>{format(horizonStart, 'd MMM', { locale: tr })} - {format(horizonEnd, 'd MMM', { locale: tr })}</strong>
              </div>
            </div>
            <div className="day-strip">
              {bookingsByDate.map(({ date, label, bookings: list }) => (
                <button
                  key={date}
                  className={`day-tile ${list.length ? 'has-booking' : ''} ${isSameDay(parseISO(date), horizonStart) ? 'is-today' : ''}`}
                  onClick={() => openDay(date, list)}
                >
                  <div className="day-tile-head">
                    <span className="day-label">{label}</span>
                    {list.length > 0 && <span className="count-chip">{list.length}</span>}
                  </div>
                  <div className="day-tile-body">
                    {list.length === 0 ? <p className="muted tiny">Kayıt yok</p> : <p className="muted tiny">Detay için dokun</p>}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="card closed-card">
            <div className="closed-header">
              <div>
                <h3>Kapalı Tarihler</h3>
                <p className="muted">Aralık ekle/sil</p>
              </div>
              <button className="refresh-btn" onClick={() => setShowClosedDateForm(!showClosedDateForm)}>
                {showClosedDateForm ? 'İptal' : 'Yeni Ekle'}
              </button>
            </div>

            {showClosedDateForm && (
              <form onSubmit={handleCreateClosedDate} className="closed-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Başlangıç</label>
                    <input
                      type="date"
                      value={closedDateForm.start_date}
                      onChange={(e) => setClosedDateForm({ ...closedDateForm, start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Bitiş</label>
                    <input
                      type="date"
                      value={closedDateForm.end_date}
                      onChange={(e) => setClosedDateForm({ ...closedDateForm, end_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Sebep (opsiyonel)</label>
                  <input
                    type="text"
                    value={closedDateForm.reason}
                    onChange={(e) => setClosedDateForm({ ...closedDateForm, reason: e.target.value })}
                    placeholder="Örn: Tatil, bakım..."
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="outline" onClick={() => setShowClosedDateForm(false)}>Vazgeç</button>
                  <button type="submit" className="primary">Kaydet</button>
                </div>
              </form>
            )}

            {closedDates.length === 0 ? (
              <div className="empty small">Kapalı tarih aralığı yok</div>
            ) : (
              <div className="closed-list">
                {closedDates.map((closedDate) => (
                  <div key={closedDate.id} className="closed-item">
                    <div>
                      <div className="closed-dates">
                        <span>{closedDate.start_date}</span>
                        <ChevronRight size={14} />
                        <span>{closedDate.end_date}</span>
                      </div>
                      {closedDate.reason && <p className="muted tiny">{closedDate.reason}</p>}
                    </div>
                    <button className="icon-btn danger" onClick={() => handleDeleteClosedDate(closedDate.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {showDetailSheet && (
        <div className="sheet-backdrop" onClick={closeSheet}>
          <div className="sheet solid" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-header">
              <div>
                <p className="muted tiny">{selectedDay}</p>
                <h3>Randevular</h3>
              </div>
              <button className="icon-btn" onClick={closeSheet}>
                <XCircle size={18} />
              </button>
            </div>
            {dayBookings.length === 0 ? (
              <div className="empty small">Randevu yok</div>
            ) : (
              <div className="day-booking-list">
                {dayBookings.map((booking) => (
                  <div key={booking.id} className="booking-item">
                    <div className="booking-main">
                      <div className="booking-top">
                        <div>
                          <div className="booking-name">{booking.customer_name}</div>
                          <div className="booking-phone">{booking.customer_phone}</div>
                        </div>
                        <div>{getStatusBadge(booking.status)}</div>
                      </div>
                      <div className="booking-meta">
                        <span>{booking.appointment_time}</span>
                        <span className="price">{booking.service_price}₺</span>
                      </div>
                      <div className="booking-meta">
                        <span>{booking.barber_name}</span>
                        <span>•</span>
                        <span>{booking.service_name}</span>
                      </div>
                    </div>
                    <div className="booking-actions">
                      {booking.status !== 'cancelled' && (
                        <>
                          <button className="icon-btn" onClick={() => handleCall(booking.customer_phone)} aria-label="Ara">
                            <Phone size={16} />
                          </button>
                          <button className="icon-btn" onClick={() => handleMessage(booking.customer_phone)} aria-label="WhatsApp">
                            <MessageSquare size={16} />
                          </button>
                          {booking.customer_email && (
                            <button className="icon-btn" onClick={() => handleReminder(booking)} aria-label="Hatırlatma">
                              <Send size={16} />
                            </button>
                          )}
                        </>
                      )}
                      {booking.status !== 'cancelled' && (
                        <button className="icon-btn warn" onClick={() => handleCancel(booking.id)} aria-label="İptal">
                          <XCircle size={16} />
                        </button>
                      )}
                      <button className="icon-btn danger" onClick={() => handleDelete(booking.id)} aria-label="Sil">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={toast.type === 'error' ? 7000 : 5000}
        />
      )}
    </div>
  )
}

export default AdminPage

