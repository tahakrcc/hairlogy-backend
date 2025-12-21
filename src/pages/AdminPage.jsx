import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Calendar, Users, DollarSign, CheckCircle, XCircle, Clock, Trash2, Filter, Send, Phone, MessageSquare, ChevronRight, ChevronLeft, Plus, Scissors, X, Settings, TrendingUp } from 'lucide-react'
import { adminAPI, barbersAPI, servicesAPI, settingsAPI, default as api } from '../services/api'
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
  const navigate = useNavigate()
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
  const [closedDateForm, setClosedDateForm] = useState({ start_date: '', end_date: '', reason: '', barberId: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateBookingModal, setShowCreateBookingModal] = useState(false)
  const [createBookingForm, setCreateBookingForm] = useState({
    barberId: '',
    serviceName: '',
    servicePrice: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    appointmentDate: '',
    appointmentTime: ''
  })
  const [availableTimesForDate, setAvailableTimesForDate] = useState([])
  const [loadingAvailableTimes, setLoadingAvailableTimes] = useState(false)
  const [creatingBooking, setCreatingBooking] = useState(false)
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sendingReport, setSendingReport] = useState(false)
  const [barbers, setBarbers] = useState({})
  const [services, setServices] = useState([])
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)

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
      loadBarbers()
      loadServices()
      loadMaintenanceStatus()
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
      // Safely log error without string conversion issues
      const errorInfo = {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message || String(error),
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        // Firebase errors might have additional properties
        errorCode: error.code || error.response?.data?.code,
        errorDetails: error.response?.data
      }

      // Better error logging
      console.error('Login error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        fullError: error
      })

      // Hata mesajını belirle
      let errorMessage = 'Giriş başarısız'
      const errorStatus = error.response?.status
      const errorData = error.response?.data
      const requestUrl = error.config?.url || 'unknown'

      // Backend'den gelen hata mesajını al
      // Önce userMessage'ı kontrol et (axios interceptor'dan gelir)
      if (error.userMessage) {
        errorMessage = error.userMessage
      } else if (errorData) {
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
      // 404 Not Found - Backend endpoint bulunamadı
      else if (errorStatus === 404) {
        setToast({
          message: 'Backend API endpoint bulunamadı. Backend URL\'ini kontrol edin veya Netlify\'da VITE_API_URL environment variable\'ını ayarlayın.',
          type: 'error'
        })
      }
      // 401 Unauthorized - Kullanıcı adı veya şifre hatalı
      else if (errorStatus === 401) {
        setToast({
          message: errorMessage || 'Kullanıcı adı veya şifre hatalı.',
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
        // Backend'den gelen detaylı hata mesajını göster
        const serverError = errorData?.error || errorMessage
        setToast({
          message: serverError || 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.',
          type: 'error'
        })
      }
      // Diğer hatalar
      else {
        // Eğer errorMessage çok kısa veya anlamsızsa, daha açıklayıcı bir mesaj göster
        let displayMessage = errorMessage
        if (errorMessage.length <= 3 || errorMessage === 'FA' || errorMessage === 'FA') {
          displayMessage = 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin ve tekrar deneyin.'
        }
        setToast({
          message: displayMessage,
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
      console.error('Load stats error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      })
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }

  const loadClosedDates = async () => {
    try {
      const response = await adminAPI.getClosedDates()
      setClosedDates(response.data)
    } catch (error) {
      console.error('Load closed dates error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url
      })
      if (error.response?.status === 401) {
        handleLogout()
      }
    }
  }

  const loadBarbers = async () => {
    try {
      const response = await barbersAPI.getAll()
      const barbersMap = {}
      response.data.forEach(barber => {
        // Use barber_id (1, 2) as key if available, otherwise fallback to _id
        const key = barber.barber_id || barber.id
        barbersMap[key] = barber
      })
      setBarbers(barbersMap)
    } catch (error) {
      console.error('Load barbers error:', error)
    }
  }

  const loadServices = async () => {
    try {
      const response = await servicesAPI.getAll()
      setServices(response.data)
    } catch (error) {
      console.error('Load services error:', error)
    }
  }

  const loadMaintenanceStatus = async () => {
    try {
      const response = await settingsAPI.getMaintenanceMode()
      setMaintenanceMode(response.data.maintenanceMode)
    } catch (error) {
      console.error('Load maintenance status error:', error)
    }
  }

  const handleToggleMaintenance = async () => {
    if (!window.confirm(`Bakım modunu ${maintenanceMode ? 'KAPATMAK' : 'AÇMAK'} istediğinize emin misiniz?`)) return

    setMaintenanceLoading(true)
    try {
      const newValue = !maintenanceMode
      await adminAPI.toggleMaintenanceMode(newValue)
      setMaintenanceMode(newValue)
      setToast({ message: `Bakım modu ${newValue ? 'AÇILDI' : 'KAPATILDI'}`, type: 'success' })
    } catch (error) {
      setToast({ message: 'Bakım modu güncellenirken hata oluştu', type: 'error' })
    } finally {
      setMaintenanceLoading(false)
    }
  }

  const loadAdminAvailableTimes = async (barberId, date) => {
    if (!barberId || !date) {
      setAvailableTimesForDate([])
      return
    }

    setLoadingAvailableTimes(true)
    try {
      const response = await adminAPI.getAvailableTimes(barberId, date)
      // Sadece müsait saatleri göster (dolu saatleri gösterme)
      const availableTimes = response.data?.availableTimes || []
      console.log('Available times loaded:', availableTimes)
      setAvailableTimesForDate(availableTimes)
    } catch (error) {
      console.error('Load available times error:', error)
      setAvailableTimesForDate([])
    } finally {
      setLoadingAvailableTimes(false)
    }
  }

  const handleCreateClosedDate = async (e) => {
    e.preventDefault()
    try {
      await adminAPI.createClosedDate(closedDateForm)
      setClosedDateForm({ start_date: '', end_date: '', reason: '', barberId: '' })
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

  const handleCreateBooking = async (e) => {
    e.preventDefault()

    // Telefon validasyonu
    const phone = createBookingForm.customerPhone.replace(/[^0-9]/g, '');
    if (phone.length !== 10) {
      setToast({ message: 'Telefon numarası eksik! Başında 0 olmadan 10 hane giriniz. (Örn: 5XX...)', type: 'error' });
      return;
    }
    if (!phone.startsWith('5')) {
      setToast({ message: 'Telefon numarası 5 ile başlamalıdır.', type: 'error' });
      return;
    }

    if (!createBookingForm.barberId || !createBookingForm.serviceName || !createBookingForm.customerName ||
      !createBookingForm.customerPhone || !createBookingForm.appointmentDate || !createBookingForm.appointmentTime) {
      setToast({ message: 'Lütfen tüm zorunlu alanları doldurun', type: 'error' })
      return
    }

    // Barbers yüklenmemişse kontrol et
    if (Object.keys(barbers).length === 0) {
      setToast({ message: 'Berberler yükleniyor, lütfen bekleyin...', type: 'error' })
      return
    }

    setCreatingBooking(true)
    try {
      console.log('Looking up barber:', createBookingForm.barberId);
      console.log('Barber keys:', Object.keys(barbers));

      let selectedBarber = barbers[createBookingForm.barberId]

      // If direct lookup fails (because key is MongoID but we have numeric ID), search by value
      if (!selectedBarber) {
        console.log('Direct lookup failed, searching by property...');
        selectedBarber = Object.values(barbers).find(b => {
          console.log(`Checking barber ${b.name}: id=${b.id}, barber_id=${b.barber_id}`);
          return String(b.barber_id) === String(createBookingForm.barberId) ||
            String(b.id) === String(createBookingForm.barberId);
        });
      }

      console.log('Found Barber:', selectedBarber);

      // Barber kontrolü
      if (!selectedBarber) {
        setToast({ message: `Hata: Berber bulunamadı (ID: ${createBookingForm.barberId})`, type: 'error' })
        setCreatingBooking(false)
        return
      }

      const selectedService = services.find(s => s.name === createBookingForm.serviceName)

      // Service kontrolü
      if (!selectedService) {
        setToast({ message: 'Lütfen geçerli bir hizmet seçin', type: 'error' })
        setCreatingBooking(false)
        return
      }

      // BarberId'yi number'a çevir
      // Backend'de barber'ın id field'ı kullanılacak
      // Eğer barber'ın numeric_id'si varsa onu kullan, yoksa id field'ını kullan
      let barberIdValue = createBookingForm.barberId;

      // Backend'de barber'ın id field'ı (numeric) kullanılacak
      // Frontend'den Firestore doc ID gönderiyoruz, backend bunu id field'ına çevirecek
      // Ama eğer numeric_id varsa, onu kullan
      if (selectedBarber.numeric_id) {
        barberIdValue = selectedBarber.numeric_id;
      } else if (selectedBarber.id && typeof selectedBarber.id === 'number') {
        barberIdValue = selectedBarber.id;
      } else {
        // Firestore doc ID'yi gönder, backend bunu id field'ına çevirecek
        barberIdValue = createBookingForm.barberId;
      }

      console.log('[Admin Create Booking] Barber ID conversion:', {
        original: createBookingForm.barberId,
        selectedBarber: {
          id: selectedBarber.id,
          numeric_id: selectedBarber.numeric_id,
          name: selectedBarber.name
        },
        final: barberIdValue,
        finalType: typeof barberIdValue
      })

      const bookingData = {
        barberId: barberIdValue,
        barberName: selectedBarber.name,
        serviceName: createBookingForm.serviceName.trim(),
        servicePrice: selectedService.price || parseFloat(createBookingForm.servicePrice) || 0,
        customerName: createBookingForm.customerName.trim(),
        customerPhone: createBookingForm.customerPhone.trim(),
        customerEmail: createBookingForm.customerEmail ? createBookingForm.customerEmail.trim() : null,
        appointmentDate: createBookingForm.appointmentDate.trim(),
        appointmentTime: createBookingForm.appointmentTime.trim()
      }

      // Debug log
      console.log('Sending booking data:', bookingData)
      console.log('Form values:', createBookingForm)

      const response = await adminAPI.createBooking(bookingData)

      console.log('Booking created response:', response.data)

      setToast({ message: 'Randevu başarıyla oluşturuldu', type: 'success' })
      setShowCreateBookingModal(false)
      setCreateBookingForm({
        barberId: '',
        serviceName: '',
        servicePrice: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        appointmentDate: '',
        appointmentTime: ''
      })

      // Wait for bookings to reload before closing modal
      // Force reload with current filters
      await loadBookings(showAllBookings)
      await loadStats()

      // Also clear any date filter if set, to show the new booking
      if (filters.date) {
        setFilters(prev => ({ ...prev, date: '' }))
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Randevu oluşturulamadı'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setCreatingBooking(false)
    }
  }

  const handleSendDailyReport = async () => {
    if (!reportDate) {
      setToast({ message: 'Lütfen bir tarih seçin', type: 'error' })
      return
    }

    setSendingReport(true)
    try {
      const response = await adminAPI.sendDailyReport(reportDate)
      setToast({
        message: `Günlük rapor emaili gönderildi (${response.data.totalBookings} randevu)`,
        type: 'success'
      })
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Rapor gönderilemedi'
      setToast({ message: errorMsg, type: 'error' })
    } finally {
      setSendingReport(false)
    }
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
    const isClosed = closedDates.some(cd => {
      const start = cd.start_date
      const end = cd.end_date
      if (formatted >= start && formatted <= end) {
        // If viewing specific barber, check if close applies to them
        if (filters.barberId) {
          return !cd.barber_id || String(cd.barber_id) === String(filters.barberId)
        }
        // If viewing All, only show closed if GLOBAL close (or maybe if all barbers closed, but checking global is safer for "shop closed")
        return !cd.barber_id
      }
      return false
    })

    return {
      date: formatted,
      label: format(day, "d MMM, EEEE", { locale: tr }),
      bookings: filteredBookings.filter((b) => b.appointment_date === formatted),
      isClosed
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
            <button
              className={`maintenance-toggle-btn ${maintenanceMode ? 'active' : ''}`}
              onClick={handleToggleMaintenance}
              disabled={maintenanceLoading}
              title={maintenanceMode ? 'Bakım Modunu Kapat' : 'Bakım Modunu Aç'}
            >
              <Settings size={18} className={maintenanceLoading ? 'spin' : ''} />
              {maintenanceMode ? 'Bakımı Kapat' : 'Siteyi Bakıma Al'}
            </button>
            <button
              className="create-booking-btn"
              onClick={() => setShowCreateBookingModal(true)}
              title="Yeni Randevu Oluştur"
            >
              <Plus size={18} />
              Randevu Ekle
            </button>
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
              <DollarSign size={18} />
              <div>
                <p>Toplam Gelir</p>
                <strong>{stats?.totalRevenue ?? 0}₺</strong>
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
              {bookingsByDate.map(({ date, label, bookings: list, isClosed }) => (
                <button
                  key={date}
                  className={`day-tile ${list.length ? 'has-booking' : ''} ${isSameDay(parseISO(date), horizonStart) ? 'is-today' : ''} ${isClosed ? 'is-closed' : ''}`}
                  onClick={() => openDay(date, list)}
                >
                  <div className="day-tile-head">
                    <span className="day-label">{label}</span>
                    {list.length > 0 && <span className="count-chip">{list.length}</span>}
                    {isClosed && <span className="status-badge error" style={{ fontSize: '10px', padding: '2px 6px' }}>KAPALI</span>}
                  </div>
                  <div className="day-tile-body">
                    {isClosed ? (
                      <p className="muted tiny text-danger">Bu tarih kapalı</p>
                    ) : list.length === 0 ? (
                      <p className="muted tiny">Kayıt yok</p>
                    ) : (
                      <p className="muted tiny">Detay için dokun</p>
                    )}
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

                <div className="form-group">
                  <label>Berber (Opsiyonel)</label>
                  <select
                    value={closedDateForm.barberId || ''}
                    onChange={(e) => setClosedDateForm({ ...closedDateForm, barberId: e.target.value })}
                  >
                    <option value="">Hepsi (Tüm Dükkan Kapalı)</option>
                    {Object.values(barbers).map(barber => (
                      <option key={barber.id} value={barber.barber_id}>{barber.name}</option>
                    ))}
                  </select>
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
                      <span className="badge-barber">
                        {(() => {
                          if (!closedDate.barber_id) return 'Tümü';
                          const b = Object.values(barbers).find(barber =>
                            String(barber.barber_id) === String(closedDate.barber_id) ||
                            String(barber.id) === String(closedDate.barber_id)
                          );
                          return b ? b.name : 'Bilinmeyen';
                        })()}
                      </span>
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
      </main >

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
      )
      }

      <div className="admin-footer-actions" style={{ padding: '20px', textAlign: 'center' }}>
        <button
          className="golden-button outline"
          onClick={() => navigate('/admin/stats')}
          style={{ width: '100%', maxWidth: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto' }}
        >
          <TrendingUp size={20} />
          İstatistikler ve Raporlar
        </button>
      </div>

      {/* Create Booking Modal */}
      {
        showCreateBookingModal && (
          <div className="modal-overlay" onClick={() => setShowCreateBookingModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Yeni Randevu Oluştur</h2>
                <button className="modal-close" onClick={() => setShowCreateBookingModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateBooking} className="create-booking-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Berber *</label>
                    <select
                      value={createBookingForm.barberId}
                      onChange={(e) => {
                        const newBarberId = e.target.value
                        setCreateBookingForm({ ...createBookingForm, barberId: newBarberId, appointmentTime: '' })
                        if (newBarberId && createBookingForm.appointmentDate) {
                          loadAdminAvailableTimes(newBarberId, createBookingForm.appointmentDate)
                        }
                      }}
                      required
                    >
                      <option value="">Seçiniz</option>
                      {Object.values(barbers).map(barber => (
                        <option key={barber.id} value={barber.barber_id || barber.id}>{barber.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tarih *</label>
                    <input
                      type="date"
                      value={createBookingForm.appointmentDate}
                      onChange={(e) => {
                        const newDate = e.target.value
                        setCreateBookingForm({ ...createBookingForm, appointmentDate: newDate, appointmentTime: '' })
                        if (newDate && createBookingForm.barberId) {
                          loadAdminAvailableTimes(createBookingForm.barberId, newDate)
                        }
                      }}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Saat *</label>
                    {loadingAvailableTimes ? (
                      <div>Yükleniyor...</div>
                    ) : (
                      <select
                        value={createBookingForm.appointmentTime}
                        onChange={(e) => setCreateBookingForm({ ...createBookingForm, appointmentTime: e.target.value })}
                        required
                        disabled={!createBookingForm.barberId || !createBookingForm.appointmentDate}
                      >
                        <option value="">Seçiniz</option>
                        {availableTimesForDate.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))}
                        {availableTimesForDate.length === 0 && createBookingForm.barberId && createBookingForm.appointmentDate && (
                          <option disabled>Bu tarihte müsait saat yok</option>
                        )}
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Hizmet *</label>
                    <select
                      value={createBookingForm.serviceName}
                      onChange={(e) => {
                        const selected = services.find(s => s.name === e.target.value)
                        setCreateBookingForm({
                          ...createBookingForm,
                          serviceName: e.target.value,
                          servicePrice: selected ? selected.price.toString() : ''
                        })
                      }}
                      required
                    >
                      <option value="">Seçiniz</option>
                      {services.map(service => (
                        <option key={service.id} value={service.name}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    {createBookingForm.serviceName && (
                      <div style={{ marginTop: '8px', fontSize: '14px', color: '#FFD700', fontWeight: 'bold' }}>
                        Fiyat: {services.find(s => s.name === createBookingForm.serviceName)?.price || 0}₺
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>Müşteri Adı *</label>
                  <input
                    type="text"
                    value={createBookingForm.customerName}
                    onChange={(e) => setCreateBookingForm({ ...createBookingForm, customerName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Telefon *</label>
                    <input
                      type="tel"
                      value={createBookingForm.customerPhone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.startsWith('0')) val = val.substring(1);
                        if (val.length > 10) val = val.substring(0, 10);
                        setCreateBookingForm({ ...createBookingForm, customerPhone: val });
                      }}
                      placeholder="5XX XXX XX XX"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={createBookingForm.customerEmail}
                      onChange={(e) => setCreateBookingForm({ ...createBookingForm, customerEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateBookingModal(false)}>
                    İptal
                  </button>
                  <button type="submit" className="btn-primary" disabled={creatingBooking}>
                    {creatingBooking ? 'Oluşturuluyor...' : 'Randevu Oluştur'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Daily Report Section */}
      <div className="daily-report-section">
        <div className="container">
          <div className="daily-report-card">
            <h3>Günlük Rapor Gönder</h3>
            <p>Seçtiğiniz gündeki tüm randevular bilgileriyle beraber admin emailine gönderilir.</p>
            <div className="report-form">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                max={format(addDays(new Date(), 13), 'yyyy-MM-dd')}
                min={format(new Date(), 'yyyy-MM-dd')}
                className="report-date-input"
              />
              <button
                onClick={handleSendDailyReport}
                disabled={sendingReport || !reportDate}
                className="send-report-btn"
              >
                {sendingReport ? 'Gönderiliyor...' : 'Raporu Email Gönder'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {
        toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
            duration={toast.type === 'error' ? 7000 : 5000}
          />
        )
      }
    </div >
  )
}

export default AdminPage

