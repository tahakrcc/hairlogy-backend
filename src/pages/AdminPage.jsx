import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Calendar, Users, DollarSign, CheckCircle, XCircle, Clock, Trash2, Filter, Send, Phone, MessageSquare, ChevronRight, ChevronLeft, Plus, Scissors, X, Settings, TrendingUp } from 'lucide-react'
import { adminAPI, barbersAPI, servicesAPI, settingsAPI, default as api } from '../services/api'
import Toast from '../components/Toast'
import './AdminPage.css'
import { addDays, format, startOfDay, isWithinInterval, parseISO, isSameDay, isBefore } from 'date-fns'
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
  const [closedDateType, setClosedDateType] = useState('full') // 'full' or 'partial'
  const [closedDateForm, setClosedDateForm] = useState({ start_date: '', end_date: '', start_time: '', end_time: '', reason: '', barberId: '' })
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

  // Keep dayBookings in sync with global bookings (so deletes/cancels reflect immediately)
  useEffect(() => {
    if (selectedDay) {
      setDayBookings(bookings.filter(b => b.appointment_date === selectedDay))
    }
  }, [bookings, selectedDay])

  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [sendingReport, setSendingReport] = useState(false)
  const [barbers, setBarbers] = useState({})
  const [services, setServices] = useState([])
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, id: null, message: '' })

  // New states for settings
  const [activeTab, setActiveTab] = useState('bookings') // 'bookings', 'services', 'hours', 'settings'
  const [allServices, setAllServices] = useState([])
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [serviceForm, setServiceForm] = useState({ name: '', duration: 30, price: 0, active: true })
  const [workingHours, setWorkingHours] = useState({
    weekday: { start: '09:00', end: '20:00' },
    saturday: { start: '09:00', end: '22:00' },
    sunday: { closed: true },
    slotDuration: 60
  })
  const [savingWorkingHours, setSavingWorkingHours] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [generalSettings, setGeneralSettings] = useState({
    booking_horizon: 14,
    auto_confirm: true
  })
  const [savingGeneralSettings, setSavingGeneralSettings] = useState(false)

  const [originalWorkingHours, setOriginalWorkingHours] = useState(null)
  const [originalGeneralSettings, setOriginalGeneralSettings] = useState(null)
  const [unsavedModal, setUnsavedModal] = useState({ isOpen: false, targetTab: null })

  // New states for Special Working Hours
  const [specialHours, setSpecialHours] = useState([])
  const [showSpecialHourModal, setShowSpecialHourModal] = useState(false)
  const [specialHourForm, setSpecialHourForm] = useState({
    date: '',
    start: '09:00',
    end: '20:00',
    breaks: [],
    is_closed: false,
    barber_id: null
  })
  const [savingSpecialHours, setSavingSpecialHours] = useState(false)

  const horizonStart = startOfDay(new Date())
  const horizonCount = parseInt(generalSettings.booking_horizon) || 14
  const horizonEnd = startOfDay(addDays(horizonStart, horizonCount - 1))
  const horizonDays = Array.from({ length: horizonCount }).map((_, idx) => addDays(horizonStart, idx))

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
      loadAllServices()
      loadWorkingHours()
      loadGeneralSettings()
      loadSpecialHours()
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

  // ============ NEW: Services Management ============
  const loadAllServices = async () => {
    try {
      const response = await adminAPI.getServices()
      setAllServices(response.data)
    } catch (error) {
      console.error('Load all services error:', error)
    }
  }

  const handleCreateService = async (e) => {
    e.preventDefault()
    try {
      await adminAPI.createService(serviceForm)
      setToast({ message: 'Hizmet eklendi', type: 'success' })
      setShowServiceModal(false)
      setServiceForm({ name: '', duration: 30, price: 0, active: true })
      loadAllServices()
      loadServices() // Refresh public services too
    } catch (error) {
      setToast({ message: 'Hizmet eklenirken hata oluştu', type: 'error' })
    }
  }

  const handleUpdateService = async (e) => {
    e.preventDefault()
    try {
      await adminAPI.updateService(editingService.id, serviceForm)
      setToast({ message: 'Hizmet güncellendi', type: 'success' })
      setShowServiceModal(false)
      setEditingService(null)
      setServiceForm({ name: '', duration: 30, price: 0, active: true })
      loadAllServices()
      loadServices()
    } catch (error) {
      setToast({ message: 'Hizmet güncellenirken hata oluştu', type: 'error' })
    }
  }

  const handleDeleteService = async (id) => {
    if (!window.confirm('Bu hizmeti silmek istediğinize emin misiniz?')) return
    try {
      await adminAPI.deleteService(id)
      setToast({ message: 'Hizmet silindi', type: 'success' })
      loadAllServices()
      loadServices()
    } catch (error) {
      setToast({ message: 'Hizmet silinirken hata oluştu', type: 'error' })
    }
  }

  const openEditService = (service) => {
    setEditingService(service)
    setServiceForm({
      name: service.name,
      duration: service.duration || 30,
      price: service.price || 0,
      active: service.active !== false
    })
    setShowServiceModal(true)
  }

  // ============ NEW: Working Hours Management ============
  const loadWorkingHours = async () => {
    try {
      const response = await adminAPI.getWorkingHours()
      setWorkingHours(response.data)
      setOriginalWorkingHours(JSON.parse(JSON.stringify(response.data)))
    } catch (error) {
      console.error('Load working hours error:', error)
    }
  }

  const handleSaveWorkingHours = async () => {
    setSavingWorkingHours(true)
    try {
      await adminAPI.updateWorkingHours(workingHours)
      setOriginalWorkingHours(JSON.parse(JSON.stringify(workingHours)))
      setToast({ message: 'Çalışma saatleri güncellendi', type: 'success' })
      if (unsavedModal.isOpen && unsavedModal.targetTab) {
        setActiveTab(unsavedModal.targetTab)
        setUnsavedModal({ isOpen: false, targetTab: null })
      }
    } catch (error) {
      setToast({ message: 'Çalışma saatleri güncellenirken hata oluştu', type: 'error' })
    } finally {
      setSavingWorkingHours(false)
    }
  }

  const handleAddBreak = (dayStr) => {
    setWorkingHours(prev => {
      const dayData = prev[dayStr] || {};
      const breaks = dayData.breaks || [];
      return {
        ...prev,
        [dayStr]: {
          ...dayData,
          breaks: [...breaks, { start: '12:00', end: '13:00' }]
        }
      };
    });
  };

  const handleUpdateBreak = (dayStr, index, field, value) => {
    setWorkingHours(prev => {
      const dayData = prev[dayStr] || {};
      const breaks = [...(dayData.breaks || [])];
      if (breaks[index]) {
        breaks[index] = { ...breaks[index], [field]: value };
      }
      return {
        ...prev,
        [dayStr]: {
          ...dayData,
          breaks
        }
      };
    });
  };

  const handleRemoveBreak = (dayStr, index) => {
    setWorkingHours(prev => {
      const dayData = prev[dayStr] || {};
      const breaks = (dayData.breaks || []).filter((_, i) => i !== index);
      return {
        ...prev,
        [dayStr]: {
          ...dayData,
          breaks
        }
      };
    });
  };

  const renderBreaks = (dayStr) => {
    const breaks = workingHours[dayStr]?.breaks || [];
    return (
      <div className="breaks-container">
        {breaks.map((b, i) => (
          <div key={i} className="break-item">
            <input type="time" title="Başlangıç" value={b.start || ''} onChange={(e) => handleUpdateBreak(dayStr, i, 'start', e.target.value)} />
            <span>-</span>
            <input type="time" title="Bitiş" value={b.end || ''} onChange={(e) => handleUpdateBreak(dayStr, i, 'end', e.target.value)} />
            <button className="icon-btn danger small" title="Molayı Sil" onClick={() => handleRemoveBreak(dayStr, i)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button className="btn outline small add-break-btn" onClick={() => handleAddBreak(dayStr)}>
          + Mola Ekle
        </button>
      </div>
    );
  };

  // ============ General Settings ============
  const loadGeneralSettings = async () => {
    try {
      const response = await adminAPI.getGeneralSettings()
      setGeneralSettings(response.data)
      setOriginalGeneralSettings(JSON.parse(JSON.stringify(response.data)))
    } catch (error) {
      console.error('Load general settings error:', error)
    }
  }

  const handleSaveGeneralSettings = async () => {
    setSavingGeneralSettings(true)
    try {
      await adminAPI.updateGeneralSettings(generalSettings)
      setOriginalGeneralSettings(JSON.parse(JSON.stringify(generalSettings)))
      setToast({ message: 'Ayarlar kaydedildi', type: 'success' })
      if (unsavedModal.isOpen && unsavedModal.targetTab) {
        setActiveTab(unsavedModal.targetTab)
        setUnsavedModal({ isOpen: false, targetTab: null })
      }
    } catch (error) {
      setToast({ message: 'Ayarlar kaydedilirken hata oluştu', type: 'error' })
    } finally {
      setSavingGeneralSettings(false)
    }
  }

  // ============ NEW: Calendar Toggle ============
  const handleToggleDate = async (date, barberId = null) => {
    try {
      const response = await adminAPI.toggleDate(date, barberId)
      setToast({ message: response.data.isClosed ? 'Tarih kapatıldı' : 'Tarih açıldı', type: 'success' })
      loadClosedDates()
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Tarih güncellenirken hata oluştu'
      setToast({ message: errorMsg, type: 'error' })
    }
  }

  const getCalendarDaysForMonth = (monthDate) => {
    const year = monthDate.getFullYear()
    const month = monthDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days = []

    // Add empty days for alignment
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1 // Monday = 0
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    // Add actual days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d))
    }

    return days
  }

  const isDateClosed = (date, barberId = null) => {
    if (!date) return false
    const dateStr = format(date, 'yyyy-MM-dd')
    return closedDates.some(cd => {
      if (dateStr >= cd.start_date && dateStr <= cd.end_date) {
        if (barberId) {
          return !cd.barber_id || String(cd.barber_id) === String(barberId)
        }
        return !cd.barber_id
      }
      return false
    })
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
      const payload = { ...closedDateForm }
      if (closedDateType === 'full') {
        payload.start_time = ''
        payload.end_time = ''
      }
      await adminAPI.createClosedDate(payload)
      setClosedDateForm({ start_date: '', end_date: '', start_time: '', end_time: '', reason: '', barberId: '' })
      setShowClosedDateForm(false)
      setClosedDateType('full')
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
    try {
      await adminAPI.deleteClosedDate(id)
      loadClosedDates()
      setToast({ message: 'Kapalı tarih silindi', type: 'success' })
      setConfirmDialog({ isOpen: false, type: null, id: null, message: '' })
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
    try {
      await adminAPI.deleteBooking(id)
      loadBookings()
      loadStats()
      setToast({ message: 'Randevu silindi', type: 'success' })
      setConfirmDialog({ isOpen: false, type: null, id: null, message: '' })
    } catch (error) {
      setToast({ message: 'Randevu silinirken hata oluştu', type: 'error' })
    }
  }

  const handleCancel = async (id) => {
    try {
      await adminAPI.updateBooking(id, 'cancelled')
      loadBookings()
      loadStats()
      setToast({ message: 'Randevu iptal edildi', type: 'success' })
      setConfirmDialog({ isOpen: false, type: null, id: null, message: '' })
    } catch (error) {
      setToast({ message: 'Randevu iptal edilirken hata oluştu', type: 'error' })
    }
  }

  const handleConfirmAction = () => {
    if (confirmDialog.type === 'delete') {
      handleDelete(confirmDialog.id)
    } else if (confirmDialog.type === 'cancel') {
      handleCancel(confirmDialog.id)
    } else if (confirmDialog.type === 'deleteClosedDate') {
      handleDeleteClosedDate(confirmDialog.id)
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
    let cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1)
    if (!cleanPhone.startsWith('90')) cleanPhone = '90' + cleanPhone
    window.location.href = `tel:+${cleanPhone}`
  }

  const handleMessage = (phone) => {
    let cleanPhone = phone.replace(/[^0-9]/g, '')
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1)
    if (!cleanPhone.startsWith('90')) cleanPhone = '90' + cleanPhone
    const message = encodeURIComponent('Merhaba, randevunuz hakkında bilgilendirme yapmak istiyoruz.')
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank')
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
      const newBarberId = createBookingForm.barberId;


      let selectedBarber = barbers[createBookingForm.barberId]

      // If direct lookup fails (because key is MongoID but we have numeric ID), search by value
      if (!selectedBarber) {
        selectedBarber = Object.values(barbers).find(b => {
          return String(b.barber_id) === String(createBookingForm.barberId) ||
            String(b.id) === String(createBookingForm.barberId);
        });
      }


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


      const response = await adminAPI.createBooking(bookingData)

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

  const handleTabChange = (targetTab) => {
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
  }

  // ============ NEW: Special Hours Management ============
  const loadSpecialHours = async () => {
    try {
      const response = await adminAPI.getSpecialHours()
      setSpecialHours(response.data || [])
    } catch (error) {
      console.error('Load special hours error:', error)
    }
  }

  const handleAddSpecialBreak = () => {
    setSpecialHourForm(prev => ({
      ...prev,
      breaks: [...prev.breaks, { start: '12:00', end: '13:00' }]
    }))
  }

  const handleUpdateSpecialBreak = (index, field, value) => {
    setSpecialHourForm(prev => {
      const newBreaks = [...prev.breaks]
      newBreaks[index] = { ...newBreaks[index], [field]: value }
      return { ...prev, breaks: newBreaks }
    })
  }

  const handleRemoveSpecialBreak = (index) => {
    setSpecialHourForm(prev => ({
      ...prev,
      breaks: prev.breaks.filter((_, i) => i !== index)
    }))
  }

  const handleSaveSpecialHour = async (e) => {
    e.preventDefault()
    setSavingSpecialHours(true)
    try {
      await adminAPI.createSpecialHour(specialHourForm)
      setToast({ message: 'Özel çalışma saati kaydedildi', type: 'success' })
      setShowSpecialHourModal(false)
      loadSpecialHours()
    } catch (error) {
      setToast({ message: 'Kaydedilirken hata oluştu', type: 'error' })
    } finally {
      setSavingSpecialHours(false)
    }
  }

  const handleDeleteSpecialHour = async (id) => {
    if (!window.confirm('Bu özel çalışma saatini silmek istediğinize emin misiniz?')) return
    try {
      await adminAPI.deleteSpecialHour(id)
      setToast({ message: 'Özel çalışma saati silindi', type: 'success' })
      loadSpecialHours()
    } catch (error) {
      setToast({ message: 'Silinirken hata oluştu', type: 'error' })
    }
  }

  const handleDiscardChanges = () => {
    if (activeTab === 'hours') {
      if (originalWorkingHours) setWorkingHours(JSON.parse(JSON.stringify(originalWorkingHours)))
    } else if (activeTab === 'settings') {
      if (originalGeneralSettings) setGeneralSettings(JSON.parse(JSON.stringify(originalGeneralSettings)))
    }
    setActiveTab(unsavedModal.targetTab)
    setUnsavedModal({ isOpen: false, targetTab: null })
  }

  const handleSaveChangesForTab = () => {
    if (activeTab === 'hours') {
      handleSaveWorkingHours()
    } else if (activeTab === 'settings') {
      handleSaveGeneralSettings()
    }
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
            className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => handleTabChange('bookings')}
          >
            <Calendar size={16} />
            <span>Randevular</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => handleTabChange('services')}
          >
            <Scissors size={16} />
            <span>Hizmetler</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'hours' ? 'active' : ''}`}
            onClick={() => handleTabChange('hours')}
          >
            <Clock size={16} />
            <span>Saatler</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            <Settings size={16} />
            <span>Ayarlar</span>
          </button>
        </div>
      </nav>

      <main className="admin-main">
        <div className="container">

          {/* ============ RANDEVULAR TAB ============ */}
          {activeTab === 'bookings' && (
            <>
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
                      {Object.values(barbers).map(barber => (
                        <option key={barber.barber_id || barber.id} value={barber.barber_id || barber.id}>{barber.name}</option>
                      ))}
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
                    <p className="muted">{horizonCount} günlük görünüm</p>
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
                    {closedDates
                      .filter(cd => !isBefore(parseISO(cd.end_date), startOfDay(new Date())))
                      .map((closedDate) => (
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
                          <button className="icon-btn danger" onClick={() => setConfirmDialog({ isOpen: true, type: 'deleteClosedDate', id: closedDate.id, message: 'Bu kapalı tarih aralığını silmek istediğinize emin misiniz?' })}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            </>
          )}

          {/* ============ HİZMETLER TAB ============ */}
          {activeTab === 'services' && (
            <section className="card services-management-card">
              <div className="section-header">
                <div>
                  <h3>Hizmet Yönetimi</h3>
                  <p className="muted">Hizmetleri ekle, düzenle veya sil</p>
                </div>
                <button className="refresh-btn" onClick={() => {
                  setEditingService(null)
                  setServiceForm({ name: '', duration: 30, price: 0, active: true })
                  setShowServiceModal(true)
                }}>
                  <Plus size={16} />
                  Yeni Hizmet
                </button>
              </div>

              <div className="services-list">
                {allServices.length === 0 ? (
                  <div className="empty small">Henüz hizmet eklenmemiş</div>
                ) : (
                  allServices.map(service => (
                    <div key={service.id} className={`service-item ${!service.active ? 'inactive' : ''}`}>
                      <div className="service-info">
                        <strong>{service.name}</strong>
                        <div className="service-meta">
                          <span>{service.duration} dk</span>
                          <span className="price">{service.price}₺</span>
                          <span className={`status-badge ${service.active ? 'success' : 'error'}`}>
                            {service.active ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                      </div>
                      <div className="service-actions">
                        <button className="icon-btn" onClick={() => openEditService(service)}>
                          <Settings size={16} />
                        </button>
                        <button className="icon-btn danger" onClick={() => handleDeleteService(service.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {/* ============ ÇALIŞMA SAATLERİ TAB ============ */}
          {activeTab === 'hours' && (
            <section className="card working-hours-card">
              <div className="section-header">
                <div>
                  <h3>Çalışma Saatleri</h3>
                  <p className="muted">Randevu alınabilecek saatleri belirleyin</p>
                </div>
              </div>

              <div className="hours-form">
                <div className="hours-row">
                  <div className="hours-row-header">
                    <label>Hafta İçi (Pazartesi - Cuma)</label>
                    <div className="hours-inputs">
                      <input
                        type="time"
                        value={workingHours.weekday?.start || '09:00'}
                        onChange={(e) => setWorkingHours({
                          ...workingHours,
                          weekday: { ...workingHours.weekday, start: e.target.value }
                        })}
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={workingHours.weekday?.end || '20:00'}
                        onChange={(e) => setWorkingHours({
                          ...workingHours,
                          weekday: { ...workingHours.weekday, end: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  {renderBreaks('weekday')}
                </div>

                <div className="hours-row">
                  <div className="hours-row-header">
                    <label>Cumartesi</label>
                    <div className="hours-inputs">
                      <input
                        type="time"
                        value={workingHours.saturday?.start || '09:00'}
                        onChange={(e) => setWorkingHours({
                          ...workingHours,
                          saturday: { ...workingHours.saturday, start: e.target.value }
                        })}
                      />
                      <span>-</span>
                      <input
                        type="time"
                        value={workingHours.saturday?.end || '22:00'}
                        onChange={(e) => setWorkingHours({
                          ...workingHours,
                          saturday: { ...workingHours.saturday, end: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                  {renderBreaks('saturday')}
                </div>

                <div className="hours-row sunday-row">
                  <div className="hours-row-header">
                    <label>Pazar</label>
                    <div className="hours-inputs sunday-inputs">
                      <label className="checkbox-label toggle-switch">
                        <input
                          type="checkbox"
                          checked={!workingHours.sunday?.closed}
                          onChange={(e) => setWorkingHours({
                            ...workingHours,
                            sunday: {
                              ...workingHours.sunday,
                              closed: !e.target.checked,
                              start: workingHours.sunday?.start || '10:00',
                              end: workingHours.sunday?.end || '18:00'
                            }
                          })}
                        />
                        <span className="toggle-slider"></span>
                        <span className="toggle-text">{workingHours.sunday?.closed ? 'Kapalı' : 'Açık'}</span>
                      </label>
                      {!workingHours.sunday?.closed && (
                        <>
                          <input
                            type="time"
                            value={workingHours.sunday?.start || '10:00'}
                            onChange={(e) => setWorkingHours({
                              ...workingHours,
                              sunday: { ...workingHours.sunday, start: e.target.value }
                            })}
                          />
                          <span>-</span>
                          <input
                            type="time"
                            value={workingHours.sunday?.end || '18:00'}
                            onChange={(e) => setWorkingHours({
                              ...workingHours,
                              sunday: { ...workingHours.sunday, end: e.target.value }
                            })}
                          />
                        </>
                      )}
                    </div>
                  </div>
                  {!workingHours.sunday?.closed && renderBreaks('sunday')}
                </div>

                <div className="hours-row">
                  <label>Randevu Aralığı</label>
                  <div className="hours-inputs">
                    <select
                      value={workingHours.slotDuration || 60}
                      onChange={(e) => setWorkingHours({
                        ...workingHours,
                        slotDuration: parseInt(e.target.value)
                      })}
                    >
                      <option value={30}>30 dakika</option>
                      <option value={60}>1 saat</option>
                      <option value={90}>1.5 saat</option>
                    </select>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    className="primary"
                    onClick={handleSaveWorkingHours}
                    disabled={savingWorkingHours}
                  >
                    {savingWorkingHours ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                </div>

                <div className="special-hours-section">
                  <div className="section-header">
                    <div>
                      <h4 style={{ color: '#c8a45a', marginBottom: '4px' }}>Özel Gün Saatleri</h4>
                      <p className="muted" style={{ fontSize: '12px' }}>Belirli bir tarihe özel saat ve mola belirleyin (Genel ayarları ezer)</p>
                    </div>
                    <button className="refresh-btn" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => {
                      setSpecialHourForm({
                        date: format(new Date(), 'yyyy-MM-dd'),
                        start: '09:00',
                        end: '20:00',
                        breaks: [],
                        is_closed: false,
                        barber_id: null
                      })
                      setShowSpecialHourModal(true)
                    }}>
                      <Plus size={14} />
                      Özel Saat Ekle
                    </button>
                  </div>

                  <div className="special-hours-list" style={{ marginTop: '15px', display: 'grid', gap: '10px' }}>
                    {specialHours.length === 0 ? (
                      <div className="empty small" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', textAlign: 'center', color: '#888', fontSize: '13px' }}>Henüz özel bir çalışma saati belirlenmemiş</div>
                    ) : (
                      specialHours.map(sh => (
                        <div key={sh.id} className={`special-hour-item ${sh.is_closed ? 'closed' : ''}`} style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 15px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="special-hour-info">
                            <strong style={{ display: 'block', fontSize: '14px' }}>{format(parseISO(sh.date), 'd MMMM yyyy, EEEE', { locale: tr })}</strong>
                            <div className="special-hour-meta" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                              {sh.is_closed ? (
                                <span className="status-badge error">Tam Gün Kapalı</span>
                              ) : (
                                <>
                                  <Clock size={14} />
                                  <span>{sh.start} - {sh.end}</span>
                                  {sh.breaks?.length > 0 && (
                                    <span style={{ color: '#c8a45a' }}>({sh.breaks.length} Mola)</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          <button className="icon-btn danger" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '6px' }} onClick={() => handleDeleteSpecialHour(sh.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ============ AYARLAR TAB ============ */}
          {activeTab === 'settings' && (
            <section className="card settings-card">
              <div className="section-header">
                <div>
                  <h3>Genel Ayarlar</h3>
                  <p className="muted">Randevu sistemi ayarlarını yönetin</p>
                </div>
              </div>

              <div className="settings-form">
                {/* Booking Horizon */}
                <div className="settings-item">
                  <div className="settings-item-info">
                    <label>Randevu Ufku (Gün)</label>
                    <p className="muted">Müşteriler kaç gün sonrasına kadar randevu alabilir</p>
                  </div>
                  <div className="settings-item-control">
                    <select
                      value={generalSettings.booking_horizon}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, booking_horizon: parseInt(e.target.value) })}
                    >
                      <option value={7}>7 gün</option>
                      <option value={14}>14 gün</option>
                      <option value={21}>21 gün</option>
                      <option value={30}>30 gün</option>
                      <option value={45}>45 gün</option>
                      <option value={60}>60 gün</option>
                    </select>
                  </div>
                </div>



                {/* Auto Confirm */}
                <div className="settings-item">
                  <div className="settings-item-info">
                    <label>Otomatik Onay</label>
                    <p className="muted">Yeni randevular otomatik olarak onaylansın mı</p>
                  </div>
                  <div className="settings-item-control">
                    <div
                      className="toggle-switch"
                      onClick={() => setGeneralSettings({ ...generalSettings, auto_confirm: !generalSettings.auto_confirm })}
                      style={{
                        width: '48px',
                        height: '26px',
                        borderRadius: '13px',
                        background: generalSettings.auto_confirm ? 'linear-gradient(135deg, #c8a45a, #e0c068)' : '#444',
                        position: 'relative',
                        transition: 'background 0.3s',
                        cursor: 'pointer',
                        border: generalSettings.auto_confirm ? '1px solid #c8a45a' : '1px solid #555'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '2px',
                        left: generalSettings.auto_confirm ? '25px' : '3px',
                        transition: 'left 0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    className="primary"
                    onClick={handleSaveGeneralSettings}
                    disabled={savingGeneralSettings}
                  >
                    {savingGeneralSettings ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                  </button>
                </div>
              </div>

              {/* Closed Dates */}
              <div className="closed-ranges-section">
                <h4>Kapalı Tarih Aralıkları</h4>
                <button className="refresh-btn small" onClick={() => setShowClosedDateForm(!showClosedDateForm)}>
                  {showClosedDateForm ? 'İptal' : 'Aralık Ekle'}
                </button>

                {showClosedDateForm && (
                  <form onSubmit={handleCreateClosedDate} className="closed-form compact">
                    <div className="form-row type-selector" style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                      <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={closedDateType === 'full'} onChange={() => setClosedDateType('full')} />
                        <span style={{ fontSize: '13px', color: '#fff' }}>Tüm Gün</span>
                      </label>
                      <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input type="radio" checked={closedDateType === 'partial'} onChange={() => setClosedDateType('partial')} />
                        <span style={{ fontSize: '13px', color: '#fff' }}>Belirli Saat</span>
                      </label>
                    </div>
                    <div className="form-row">
                      <input type="date" value={closedDateForm.start_date} onChange={(e) => setClosedDateForm({ ...closedDateForm, start_date: e.target.value })} required />
                      <span>-</span>
                      <input type="date" value={closedDateForm.end_date} onChange={(e) => setClosedDateForm({ ...closedDateForm, end_date: e.target.value })} required />
                    </div>
                    {closedDateType === 'partial' && (
                      <div className="form-row">
                        <input type="time" title="Başlangıç Saati" value={closedDateForm.start_time} onChange={(e) => setClosedDateForm({ ...closedDateForm, start_time: e.target.value })} required />
                        <span>-</span>
                        <input type="time" title="Bitiş Saati" value={closedDateForm.end_time} onChange={(e) => setClosedDateForm({ ...closedDateForm, end_time: e.target.value })} required />
                      </div>
                    )}
                    <input type="text" placeholder="Sebep (opsiyonel)" value={closedDateForm.reason} onChange={(e) => setClosedDateForm({ ...closedDateForm, reason: e.target.value })} />
                    <button type="submit" className="primary small">Ekle</button>
                  </form>
                )}

                <div className="closed-list">
                  {closedDates
                    .filter(cd => !isBefore(parseISO(cd.end_date), startOfDay(new Date())))
                    .map(cd => (
                      <div key={cd.id} className="closed-item">
                        <div>
                          <span>
                            {cd.start_date} {cd.start_date !== cd.end_date && `→ ${cd.end_date}`}
                            {cd.start_time && cd.end_time && ` (${cd.start_time} - ${cd.end_time})`}
                          </span>
                          <p className="muted tiny">{cd.reason || 'Sebep belirtilmedi'}</p>
                          {cd.barber_name && <span className="status-badge" style={{ marginTop: '4px', fontSize: '11px', display: 'inline-block' }}>{cd.barber_name}</span>}
                        </div>
                        <button className="icon-btn danger" onClick={() => setConfirmDialog({ isOpen: true, type: 'deleteClosedDate', id: cd.id, message: 'Bu kapalı tarih aralığını silmek istediğinize emin misiniz?' })}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          )}


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
                        <button className="icon-btn warn" onClick={() => setConfirmDialog({ isOpen: true, type: 'cancel', id: booking.id, message: 'Bu randevuyu iptal etmek istediğinize emin misiniz?' })} aria-label="İptal">
                          <XCircle size={16} />
                        </button>
                      )}
                      <button className="icon-btn danger" onClick={() => setConfirmDialog({ isOpen: true, type: 'delete', id: booking.id, message: 'Bu randevuyu silmek istediğinize emin misiniz?' })} aria-label="Sil">
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

      {showCreateBookingModal && (
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
                      setCreateBookingForm({ ...createBookingForm, barberId: e.target.value, appointmentDate: '', appointmentTime: '' })
                      setAvailableTimesForDate([])
                    }}
                    required
                  >
                    <option value="">Seçiniz</option>
                    {Object.values(barbers).map(barber => (
                      <option key={barber.barber_id || barber.id} value={barber.barber_id || barber.id}>{barber.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tarih *</label>
                  <input
                    type="date"
                    value={createBookingForm.appointmentDate}
                    onChange={(e) => {
                      setCreateBookingForm({ ...createBookingForm, appointmentDate: e.target.value, appointmentTime: '' })
                      if (createBookingForm.barberId && e.target.value) {
                        loadAdminAvailableTimes(createBookingForm.barberId, e.target.value)
                      }
                    }}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Saat *</label>
                  {loadingAvailableTimes ? (
                    <p className="muted">Yükleniyor...</p>
                  ) : (
                    <select
                      value={createBookingForm.appointmentTime}
                      onChange={(e) => setCreateBookingForm({ ...createBookingForm, appointmentTime: e.target.value })}
                      required
                      disabled={!createBookingForm.appointmentDate}
                    >
                      <option value="">Seçiniz</option>
                      {availableTimesForDate.length > 0 ? (
                        availableTimesForDate.map(time => (
                          <option key={time} value={time}>{time}</option>
                        ))
                      ) : createBookingForm.appointmentDate ? (
                        <option disabled>Bu tarihte müsait saat yok</option>
                      ) : null}
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
      )}

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
      {/* Service Modal */}
      {
        showServiceModal && (
          <div className="modal-overlay" onClick={() => { setShowServiceModal(false); setEditingService(null); }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingService ? 'Hizmet Düzenle' : 'Yeni Hizmet Ekle'}</h2>
                <button className="modal-close" onClick={() => { setShowServiceModal(false); setEditingService(null); }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={editingService ? handleUpdateService : handleCreateService} className="service-form">
                <div className="form-group">
                  <label>Hizmet Adı *</label>
                  <input
                    type="text"
                    value={serviceForm.name}
                    onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                    placeholder="Örn: Saç Kesimi"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Süre (dakika)</label>
                    <input
                      type="number"
                      value={serviceForm.duration}
                      onChange={(e) => setServiceForm({ ...serviceForm, duration: parseInt(e.target.value) || 30 })}
                      min="15"
                      step="15"
                    />
                  </div>
                  <div className="form-group">
                    <label>Fiyat (₺)</label>
                    <input
                      type="number"
                      value={serviceForm.price}
                      onChange={(e) => setServiceForm({ ...serviceForm, price: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 0' }}>
                    <div
                      className="toggle-switch"
                      onClick={(e) => { e.preventDefault(); setServiceForm({ ...serviceForm, active: !serviceForm.active }) }}
                      style={{
                        width: '48px',
                        height: '26px',
                        borderRadius: '13px',
                        background: serviceForm.active ? 'linear-gradient(135deg, #c8a45a, #e0c068)' : '#444',
                        position: 'relative',
                        transition: 'background 0.3s',
                        flexShrink: 0,
                        border: serviceForm.active ? '1px solid #c8a45a' : '1px solid #555'
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#fff',
                        position: 'absolute',
                        top: '2px',
                        left: serviceForm.active ? '25px' : '3px',
                        transition: 'left 0.3s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                      }} />
                    </div>
                    <span style={{ color: serviceForm.active ? '#c8a45a' : '#888', fontSize: '14px', transition: 'color 0.3s' }}>
                      {serviceForm.active ? 'Aktif — müşteriler görebilir' : 'Pasif — müşteriler göremez'}
                    </span>
                  </label>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowServiceModal(false); setEditingService(null); }}>
                    İptal
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingService ? 'Güncelle' : 'Ekle'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      {/* UNSAVED CHANGES MODAL */}
      {unsavedModal.isOpen && (
        <div className="modal-overlay" onClick={() => setUnsavedModal({ isOpen: false, targetTab: null })} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px' }}>
            <div className="modal-header" style={{ borderBottom: 'none', padding: '0 0 16px 0' }}>
              <h2 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                <Clock size={20} />
                Kaydedilmemiş Değişiklikler
              </h2>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
              Bu sayfada yaptığınız değişiklikleri kaydetmediniz. Başka bir sekmeye geçmeden önce kaydetmek ister misiniz?
            </p>
            <div className="modal-actions" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', gap: '10px' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={handleDiscardChanges}>
                Vazgeç
              </button>
              <button
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleSaveChangesForTab}
                disabled={savingWorkingHours || savingGeneralSettings}
              >
                {(savingWorkingHours || savingGeneralSettings) ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      {confirmDialog.isOpen && (
        <div className="modal-overlay" onClick={() => setConfirmDialog({ isOpen: false, type: null, id: null, message: '' })} style={{ zIndex: 9999 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header" style={{ borderBottom: 'none', justifyContent: 'center' }}>
              <div className="warning-icon" style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                <Trash2 size={32} color="#ef4444" />
              </div>
            </div>
            <div className="modal-body" style={{ padding: '10px 20px 30px' }}>
              <h3 style={{ marginBottom: '15px' }}>Emin misiniz?</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '15px', lineHeight: '1.5' }}>{confirmDialog.message}</p>

              <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
                <button
                  onClick={() => setConfirmDialog({ isOpen: false, type: null, id: null, message: '' })}
                  className="secondary"
                  style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="danger"
                  style={{ flex: 1, padding: '12px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}
                >
                  Evet, Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
      {/* Special Working Hour Modal */}
      {showSpecialHourModal && (
        <div className="modal-overlay" onClick={() => setShowSpecialHourModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Özel Çalışma Saati Belirle</h2>
              <button className="modal-close" onClick={() => setShowSpecialHourModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveSpecialHour} className="service-form">
              <div className="form-group">
                <label>Tarih *</label>
                <input
                  type="date"
                  required
                  value={specialHourForm.date}
                  onChange={(e) => setSpecialHourForm({ ...specialHourForm, date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="toggle-label" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 0' }}>
                  <div
                    className="toggle-switch"
                    onClick={(e) => { e.preventDefault(); setSpecialHourForm({ ...specialHourForm, is_closed: !specialHourForm.is_closed }) }}
                    style={{
                      width: '48px',
                      height: '26px',
                      borderRadius: '13px',
                      background: specialHourForm.is_closed ? '#ef4444' : 'linear-gradient(135deg, #c8a45a, #e0c068)',
                      position: 'relative',
                      transition: 'background 0.3s',
                      flexShrink: 0,
                      border: specialHourForm.is_closed ? '1px solid #ef4444' : '1px solid #c8a45a'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: specialHourForm.is_closed ? '25px' : '3px',
                      transition: 'left 0.3s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                  <span style={{ color: specialHourForm.is_closed ? '#ef4444' : '#c8a45a', fontSize: '14px', transition: 'color 0.3s' }}>
                    {specialHourForm.is_closed ? 'Tam Gün Kapalı' : 'Açık (Özel Saatli)'}
                  </span>
                </label>
              </div>

              {!specialHourForm.is_closed && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Başlangıç *</label>
                      <input
                        type="time"
                        required
                        value={specialHourForm.start}
                        onChange={(e) => setSpecialHourForm({ ...specialHourForm, start: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Bitiş *</label>
                      <input
                        type="time"
                        required
                        value={specialHourForm.end}
                        onChange={(e) => setSpecialHourForm({ ...specialHourForm, end: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="breaks-config" style={{ marginTop: '10px' }}>
                    <div className="section-header" style={{ marginBottom: '10px' }}>
                      <h5 style={{ margin: 0 }}>Molalar</h5>
                      <button type="button" className="refresh-btn small" onClick={handleAddSpecialBreak}>
                        <Plus size={14} /> Ekle
                      </button>
                    </div>
                    {specialHourForm.breaks.map((brk, idx) => (
                      <div key={idx} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '8px' }}>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <input
                            type="time"
                            value={brk.start}
                            onChange={(e) => handleUpdateSpecialBreak(idx, 'start', e.target.value)}
                          />
                        </div>
                        <span style={{ padding: '0 8px', color: 'rgba(255,255,255,0.5)', lineHeight: '42px' }}>-</span>
                        <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                          <input
                            type="time"
                            value={brk.end}
                            onChange={(e) => handleUpdateSpecialBreak(idx, 'end', e.target.value)}
                          />
                        </div>
                        <button type="button" className="icon-btn danger" style={{ marginLeft: '10px', height: '42px', width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => handleRemoveSpecialBreak(idx)}>
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowSpecialHourModal(false)}>
                  İptal
                </button>
                <button type="submit" className="btn-primary" disabled={savingSpecialHours}>
                  {savingSpecialHours ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div >
  )
}

export default AdminPage
