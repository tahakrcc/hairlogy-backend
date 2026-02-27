import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays, isSameDay, isPast, setHours, setMinutes, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, getMonth, getYear, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, Scissors, ChevronLeft, Edit2, Download, CheckCircle, X, Grid, List, ChevronRight, RefreshCw } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useLanguage } from '../contexts/LanguageContext'
import { bookingsAPI, barbersAPI, servicesAPI, settingsAPI } from '../services/api'
import Toast from '../components/Toast'
import './BookingPage.css'

const timeSlots = [
  '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
]

// Device token management
const getOrCreateDeviceToken = () => {
  const TOKEN_KEY = 'booking_device_token'
  const TOKEN_CREATED_KEY = 'booking_token_created'

  let token = localStorage.getItem(TOKEN_KEY)
  const tokenCreated = localStorage.getItem(TOKEN_CREATED_KEY)

  // If no token or token is older than 3 hours, create new one
  if (!token || !tokenCreated) {
    token = generateDeviceToken()
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_CREATED_KEY, new Date().toISOString())
    return token
  }

  // Check if token is older than 3 hours
  const createdDate = new Date(tokenCreated)
  const now = new Date()
  const hoursDiff = (now - createdDate) / (1000 * 60 * 60)

  if (hoursDiff >= 3) {
    // Reset token
    token = generateDeviceToken()
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_CREATED_KEY, new Date().toISOString())
  }

  return token
}

const generateDeviceToken = () => {
  // Generate a unique device token
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `device_${timestamp}_${random}`
}

function BookingPage() {
  const { barberId } = useParams()
  const isUnifiedMode = !barberId || barberId === 'all'
  const [selectedBarber, setSelectedBarber] = useState(isUnifiedMode ? null : barberId)
  const activeBarberId = isUnifiedMode ? 'all' : barberId

  const navigate = useNavigate()
  const { language, t } = useLanguage()
  const [barbers, setBarbers] = useState({})
  const [barbersLoading, setBarbersLoading] = useState(true)
  const barber = selectedBarber ? barbers[selectedBarber] : null


  // Get date formatting based on language
  const getFormattedDate = (date) => {
    const day = date.getDay()
    const dayNum = date.getDate()
    const month = date.getMonth()
    const days = t('booking.days.short')
    const months = t('booking.months.short')
    const daysFull = t('booking.days.full')
    const monthsFull = t('booking.months.full')
    return {
      dayName: days[day],
      dayNumber: dayNum,
      month: months[month],
      fullDate: `${dayNum} ${monthsFull[month]} ${date.getFullYear()} ${daysFull[day]}`
    }
  }

  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTime, setSelectedTime] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  })
  const [services, setServices] = useState([]) // Hizmetler API'den gelecek
  const [servicesLoading, setServicesLoading] = useState(true)
  const [availableDates, setAvailableDates] = useState([])
  const [availableTimes, setAvailableTimes] = useState([])
  const [bookedTimes, setBookedTimes] = useState([])
  const [allTimeSlots, setAllTimeSlots] = useState([]) // Dinamik time slots
  const [dateAvailability, setDateAvailability] = useState({}) // Store availability for each date
  const [barberAvailability, setBarberAvailability] = useState({}) // Unified format
  const [showBarberSelectModal, setShowBarberSelectModal] = useState(false)
  const [pendingTimeForBarber, setPendingTimeForBarber] = useState(null)

  const [loading, setLoading] = useState(false)
  const [expandedStep, setExpandedStep] = useState(1) // Track which step is expanded
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [calendarView, setCalendarView] = useState(false) // Toggle between list and calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Current month for calendar view
  const [bookingHorizon, setBookingHorizon] = useState(14) // Default 14 days
  const [toast, setToast] = useState(null) // Toast notification state
  const [refreshing, setRefreshing] = useState(false) // Refresh button state
  const [lastRefresh, setLastRefresh] = useState(null) // Last refresh timestamp

  // Load barbers and services from API (PARALLEL)
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [barbersRes, servicesRes] = await Promise.all([
          barbersAPI.getAll(),
          servicesAPI.getAll()
        ])

        if (!isMounted) return;

        // Process Barbers
        const barbersMap = {}
        barbersRes.data.forEach(b => {
          const key = b.barber_id || b.id
          barbersMap[key] = { name: b.name, id: key }
        })
        if (Object.keys(barbersMap).length > 0) {
          setBarbers(barbersMap)
        }

        // Process Services
        setServices(servicesRes.data)

      } catch (error) {
        console.error('Failed to load initial booking data:', error)
      } finally {
        if (isMounted) {
          setBarbersLoading(false)
          setServicesLoading(false)
        }
      }
    }

    loadInitialData()

    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (barbersLoading) return

    if (!isUnifiedMode && !barbers[barberId]) {
      navigate('/')
      return
    }

    const loadInitialData = async () => {
      let horizon = 14
      try {
        const response = await settingsAPI.getBookingHorizon()
        if (response.data && response.data.booking_horizon) {
          horizon = response.data.booking_horizon
          setBookingHorizon(horizon)
        }
      } catch (error) {
        console.error('Error fetching booking horizon:', error)
      }

      // Generate available dates 
      const dates = []
      const today = new Date()
      for (let i = 0; i < horizon; i++) {
        const date = addDays(today, i)
        dates.push(date)
      }
      setAvailableDates(dates)

      // Load availability for all dates
      loadDateAvailability(dates)
    }

    // Load initial data only once (no auto-refresh)
    loadInitialData()
    setLastRefresh(new Date())
  }, [activeBarberId, barbersLoading, navigate])

  const loadDateAvailability = async (dates) => {
    const availability = {}

    // Try batch query first (more efficient)
    try {
      const dateStrings = dates.map(date => format(date, 'yyyy-MM-dd'))
      const response = await bookingsAPI.getAvailableTimesBatch(activeBarberId, dateStrings)
      const batchData = response.data

      dates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const data = batchData[dateStr]

        if (data) {
          let availableCount = data.availableTimes.length;
          let baseTotalCount = data.allSlots ? data.allSlots.length : timeSlots.length;
          let totalCount = baseTotalCount;

          let barberSpecificCounts = {};

          if (isUnifiedMode && data.barberAvailability) {
            availableCount = 0;
            // Initialize barber counts to 0
            Object.keys(barbers).forEach(bId => {
              barberSpecificCounts[bId] = 0;
            });

            Object.values(data.barberAvailability).forEach(ids => {
              availableCount += ids.length;
              ids.forEach(id => {
                if (barberSpecificCounts[id] !== undefined) {
                  barberSpecificCounts[id]++;
                }
              });
            });
            const activeBarbersCount = Object.keys(barbers).length || 2;
            totalCount = baseTotalCount * activeBarbersCount;
          }

          if (data.isClosed) {
            availability[dateStr] = {
              available: 0,
              total: totalCount,
              booked: totalCount,
              isClosed: true,
              barberCounts: {}
            }
          } else {
            availability[dateStr] = {
              available: availableCount,
              total: totalCount,
              booked: totalCount - availableCount,
              barberCounts: barberSpecificCounts
            }
          }
        } else {
          // Fallback
          const activeBarbersCount = isUnifiedMode ? Math.max(1, Object.keys(barbers).length) : 1;
          const fallbackTotal = timeSlots.length * activeBarbersCount;
          availability[dateStr] = {
            available: fallbackTotal,
            total: fallbackTotal,
            booked: 0,
            barberCounts: {}
          }
        }
      })
    } catch (error) {
      // If batch fails, don't spam the server with 14 individual requests. Make them assumed available instead or log an error.
      console.warn('Batch query failed, falling back to empty availability structure:', error)
      const activeBarbersCount = isUnifiedMode ? Math.max(1, Object.keys(barbers).length) : 1;
      const fallbackTotal = timeSlots.length * activeBarbersCount;
      dates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd')
        availability[dateStr] = {
          available: fallbackTotal,
          total: fallbackTotal,
          booked: 0,
          barberCounts: {}
        }
      })
    }

    setDateAvailability(availability)
  }

  // Manual refresh function
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const dates = []
      const today = new Date()
      for (let i = 0; i < bookingHorizon; i++) {
        const date = addDays(today, i)
        dates.push(date)
      }
      await loadDateAvailability(dates)

      if (selectedDate) {
        await loadAvailableTimes()
      }

      setLastRefresh(new Date())
      setToast({ message: 'Bilgiler güncellendi', type: 'success' })
    } catch (error) {
      setToast({ message: 'Yenileme başarısız oldu', type: 'error' })
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (selectedDate) {
      loadAvailableTimes()
      // Reset bookedTimes when date changes
      setBookedTimes([])
    }
  }, [selectedDate, barberId])



  const loadAvailableTimes = async (skipLoading = false) => {
    if (!selectedDate) return

    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    if (!skipLoading) {
      setLoading(true)
    }
    try {
      const response = await bookingsAPI.getAvailableTimes(activeBarberId, dateStr)
      // allSlots now comes from backend
      const { availableTimes: times, bookedTimes: booked, isClosed, reason, allSlots, barberAvailability: availabilityMap } = response.data

      setBarberAvailability(availabilityMap || {})

      // If date is closed, show message and return
      if (isClosed) {
        setAvailableTimes([])
        setBookedTimes([])
        setAllTimeSlots([])
        if (!skipLoading) {
          setToast({ message: reason || 'Bu tarih randevuya kapalıdır', type: 'error' })
        }
        setLoading(false)
        return
      }

      // Update all time slots if provided from backend
      if (allSlots && Array.isArray(allSlots)) {
        setAllTimeSlots(allSlots)
      } else {
        // Fallback for Saturday logic if backend doesn't return allSlots
        const baseTimeSlots = [...timeSlots]
        if (selectedDate.getDay() === 6) { // Saturday
          baseTimeSlots.push('21:00', '22:00')
        }
        setAllTimeSlots(baseTimeSlots)
      }

      // Ensure we have arrays and normalize
      const timesArray = Array.isArray(times) ? times.map(t => String(t).trim()) : []
      const bookedArray = Array.isArray(booked) ? booked.map(t => String(t).trim()).filter(t => t) : []

      // Filter out past times for today
      const now = new Date()
      const filteredTimes = timesArray.filter(time => {
        // Filter out past times for today
        if (isSameDay(selectedDate, now)) {
          const [hours, minutes] = time.split(':').map(Number)
          const slotDateTime = setMinutes(setHours(new Date(selectedDate), hours), minutes)
          return !isBefore(slotDateTime, now)
        }
        return true
      })

      // Calculate booked times
      // Use the slot list that we just determined (from backend or fallback)
      const currentSlots = allSlots && Array.isArray(allSlots) ? allSlots :
        (selectedDate.getDay() === 6 ? [...timeSlots, '21:00', '22:00'] : [...timeSlots])

      const allTimeSlotsNormalized = currentSlots.map(t => String(t).trim())
      const availableTimesNormalized = filteredTimes.map(t => String(t).trim())
      const calculatedBooked = allTimeSlotsNormalized.filter(
        slot => !availableTimesNormalized.includes(slot)
      )

      // Merge with bookedArray from API (union, no duplicates)
      const finalBooked = [...new Set([...bookedArray, ...calculatedBooked])]

      setAvailableTimes(filteredTimes)
      setBookedTimes(finalBooked)



      // Don't reset selectedTime on periodic refresh
      if (!skipLoading) {
        setSelectedTime(null)
      }
    } catch (error) {
      // Only log if it's not a network error or expected error
      if (error.response?.status !== 404) {
        console.error('Error loading available times:', error.message || error)
      }
      // Fallback to all time slots if API fails
      setAvailableTimes(timeSlots.map(t => t.trim()))
      setAllTimeSlots(timeSlots)
      setBookedTimes([])
    } finally {
      if (!skipLoading) {
        setLoading(false)
      }
    }
  }

  const handleDateSelect = (date) => {
    setSelectedDate(date)
    setExpandedStep(2) // Move to next step
  }

  // Calendar view functions
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }) // Sunday start to match Paz-header
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }

  const isDateInAvailableDates = (date) => {
    return availableDates.some(d => isSameDay(d, date))
  }

  const getDateAvailability = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return dateAvailability[dateStr] || { available: timeSlots.length, total: timeSlots.length, booked: 0 }
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const handleTimeSelect = (time) => {
    setSelectedTime(time)
    setExpandedStep(3) // Move to next step
  }

  const handleServiceSelect = (service) => {
    setSelectedService(service)
    setExpandedStep(4) // Move to next step
  }

  const handleStepBack = (step) => {
    if (step === 1) {
      setSelectedDate(null)
      setSelectedTime(null)
      setSelectedService(null)
      if (isUnifiedMode) setSelectedBarber(null)
      setExpandedStep(1)
    } else if (step === 2) {
      setSelectedTime(null)
      setSelectedService(null)
      if (isUnifiedMode) setSelectedBarber(null)
      setExpandedStep(2)
    } else if (step === 3) {
      setSelectedService(null)
      setExpandedStep(3)
    } else if (step === 4) {
      setExpandedStep(4)
    }
  }

  const handleEditStep = (step) => {
    setExpandedStep(step)
    if (step === 1) {
      // Keep date selected, just expand
    } else if (step === 2) {
      // Keep date, expand time selection
      if (isUnifiedMode) setSelectedBarber(null)
    } else if (step === 3) {
      // Keep date and time, expand service selection
    }
  }

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedDate || !selectedTime || !selectedService) {
      setToast({ message: t('booking.step4.required'), type: 'warning' })
      return
    }

    if (!formData.name || !formData.phone) {
      setToast({ message: t('booking.step4.requiredFields'), type: 'warning' })
      return
    }

    // Telefon validasyonu
    const phone = formData.phone.replace(/[^0-9]/g, '');
    if (phone.length !== 10) {
      setToast({ message: 'Telefon numarası eksik! Başında 0 olmadan 10 hane giriniz. (Örn: 5XX...)', type: 'error' });
      return;
    }
    if (!phone.startsWith('5')) {
      setToast({ message: 'Telefon numarası 5 ile başlamalıdır.', type: 'error' });
      return;
    }

    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const deviceToken = getOrCreateDeviceToken()

      const bookingResponse = await bookingsAPI.create({
        barberId: parseInt(selectedBarber || barberId),
        barberName: barber ? barber.name : '',
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email || null,
        appointmentDate: dateStr,
        appointmentTime: selectedTime,
        deviceToken: deviceToken
      })

      const dateStrFormatted = getFormattedDate(selectedDate).fullDate

      // Mail gönderimi backend'de yapılıyor (Mailjet ile)

      // Store booking details for modal
      setBookingDetails({
        barberName: barber.name,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        appointmentDate: dateStrFormatted,
        appointmentTime: selectedTime
      })

      // Store selected date and time before resetting form
      const bookedDate = selectedDate
      const bookedTime = selectedTime

      // Immediately update bookedTimes state to show the booked time as unavailable
      setBookedTimes(prev => {
        if (!prev.includes(bookedTime)) {
          return [...prev, bookedTime]
        }
        return prev
      })

      // Remove from availableTimes immediately
      setAvailableTimes(prev => prev.filter(time => time !== bookedTime))

      // Show success modal
      setShowSuccessModal(true)

      // Refresh available times from Firebase after a short delay
      setTimeout(async () => {
        // Reload availability for all dates
        const dates = []
        const today = new Date()
        for (let i = 0; i < bookingHorizon; i++) {
          const date = addDays(today, i)
          dates.push(date)
        }
        await loadDateAvailability(dates)

        // Reload times for the booked date from Firebase
        if (bookedDate) {
          const dateStr = format(bookedDate, 'yyyy-MM-dd')
          try {
            const response = await bookingsAPI.getAvailableTimes(barberId, dateStr)
            const { availableTimes: times, bookedTimes: booked } = response.data

            // Update state immediately if this date is selected
            if (selectedDate && isSameDay(selectedDate, bookedDate)) {
              const now = new Date()
              const filteredTimes = times.filter(time => {
                if (isSameDay(bookedDate, now)) {
                  const [hours, minutes] = time.split(':').map(Number)
                  const slotDateTime = setMinutes(setHours(new Date(bookedDate), hours), minutes)
                  return !isBefore(slotDateTime, now)
                }
                return true
              })
              setAvailableTimes(filteredTimes)
              setBookedTimes(booked)
            }
          } catch (error) {
            console.error('Error refreshing times after booking:', error)
          }
        }
      }, 500)

      // Reset form
      setSelectedDate(null)
      setSelectedTime(null)
      setSelectedService(null)
      setFormData({ name: '', phone: '', email: '' })
      setExpandedStep(1)
    } catch (error) {
      let errorMessage = error.response?.data?.error || error.response?.data?.message || 'Randevu oluşturulurken bir hata oluştu'

      // Handle token limit error (429 status)
      if (error.response?.status === 429) {
        const hoursRemaining = error.response?.data?.hoursRemaining
        if (hoursRemaining) {
          errorMessage = `Bu cihazdan maksimum 2 randevu alabilirsiniz. ${hoursRemaining} saat sonra tekrar deneyebilirsiniz.`
        } else {
          errorMessage = error.response?.data?.message || errorMessage
        }
      }

      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async () => {
    if (!bookingDetails) return

    try {
      const element = document.getElementById('booking-receipt')
      if (!element) return

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#000000',
        useCORS: true
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [210, 297] // A4
      })

      const imgWidth = 210
      const pageHeight = 297
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      let heightLeft = imgHeight

      let position = 0

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      const fileName = `Randevu_${bookingDetails.customerName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('PDF oluşturulurken bir hata oluştu.')
    }
  }

  if (!isUnifiedMode && !barber) return null
  if (Object.keys(barbers).length === 0) return null
  return (
    <div className="booking-page versace-vertical-border versace-vertical-border-right">
      <header className="booking-header">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            {t('booking.back')}
          </button>
          <h1>{barber ? barber.name : 'Randevu'} - {t('booking.bookAppointment')}</h1>
          <button
            className="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Yenile"
          >
            <RefreshCw size={20} className={refreshing ? 'spinning' : ''} />
            {lastRefresh && (
              <span className="last-refresh">
                {formatDistanceToNow(lastRefresh, { addSuffix: true, locale: tr })}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="booking-main greek-key-bg">
        <div className="container">
          <div className="booking-content">
            <div className="booking-steps">
              {/* Step 1: Date Selection */}
              <div className={`step ${selectedDate && expandedStep !== 1 ? 'collapsed' : ''} ${expandedStep === 1 ? 'expanded' : ''}`}>
                <div className={`step-number ${selectedDate ? 'completed' : expandedStep === 1 ? 'active' : ''}`}>1</div>
                <div className="step-content">
                  <div className="step-header">
                    <h3>{t('booking.step1.title')}</h3>
                    <div className="step-header-actions">
                      {expandedStep === 1 && !selectedDate && (
                        <div className="view-toggle">
                          <button
                            className={`view-toggle-btn ${!calendarView ? 'active' : ''}`}
                            onClick={() => setCalendarView(false)}
                            title={t('booking.step1.listView')}
                          >
                            <List size={18} />
                          </button>
                          <button
                            className={`view-toggle-btn ${calendarView ? 'active' : ''}`}
                            onClick={() => setCalendarView(true)}
                            title={t('booking.step1.calendarView')}
                          >
                            <Grid size={18} />
                          </button>
                        </div>
                      )}
                      {selectedDate && expandedStep !== 1 && (
                        <button
                          className="edit-step-btn"
                          onClick={() => handleEditStep(1)}
                        >
                          <Edit2 size={16} />
                          {t('booking.step1.change')}
                        </button>
                      )}
                      {expandedStep > 1 && (
                        <button
                          className="back-step-btn"
                          onClick={() => handleStepBack(1)}
                        >
                          <ChevronLeft size={18} />
                          {t('booking.step1.back')}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedDate && expandedStep !== 1 ? (
                    <div className="step-selected">
                      <div className="selected-item">
                        <Calendar size={20} />
                        <div>
                          <div className="selected-label">{t('booking.step1.selectedDate')}</div>
                          <div className="selected-value">{getFormattedDate(selectedDate).fullDate}</div>
                        </div>
                      </div>
                    </div>
                  ) : calendarView ? (
                    <div className="calendar-view">
                      <div className="calendar-header">
                        <button className="calendar-nav-btn" onClick={handlePrevMonth}>
                          <ChevronLeft size={20} />
                        </button>
                        <h4 className="calendar-month-title">
                          {t('booking.months.full')[getMonth(currentMonth)]} {getYear(currentMonth)}
                        </h4>
                        <button className="calendar-nav-btn" onClick={handleNextMonth}>
                          <ChevronRight size={20} />
                        </button>
                      </div>
                      <div className="calendar-weekdays">
                        {t('booking.days.short').map((day, i) => (
                          <div key={i} className="calendar-weekday">{day}</div>
                        ))}
                      </div>
                      <div className="calendar-days">
                        {getCalendarDays().map((date, index) => {
                          const isSelected = selectedDate && isSameDay(date, selectedDate)
                          const isPastDate = isPast(date) && !isSameDay(date, new Date())
                          const isCurrentMonth = getMonth(date) === getMonth(currentMonth)
                          const isAvailable = isDateInAvailableDates(date)
                          const isSunday = date.getDay() === 0
                          const availability = getDateAvailability(date)
                          const availabilityPercent = (availability.available / availability.total) * 100
                          const isFull = availability.available === 0 || availability.isClosed
                          const isAlmostFull = availabilityPercent < 30
                          const isClosed = availability.isClosed
                          // Pazar kontrolünü kaldırdık, artık isClosed kontrolü yapılıyor
                          const canSelect = isAvailable && !isPastDate && !isFull && isCurrentMonth && !isClosed

                          return (
                            <button
                              key={index}
                              className={`calendar-day ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${isPastDate ? 'past' : ''} ${isFull ? 'full' : ''} ${isAlmostFull ? 'almost-full' : ''} ${isClosed ? 'closed' : ''} ${canSelect ? 'available' : ''} ${isSunday ? 'sunday' : ''}`}
                              onClick={() => canSelect && handleDateSelect(date)}
                              disabled={!canSelect}
                              title={isCurrentMonth && !isClosed ? `${format(date, 'dd MMMM yyyy')} - ${availability.available} müsait` : ''}
                            >
                              <span className="calendar-day-number">{date.getDate()}</span>
                              {isCurrentMonth && !isClosed && !isPastDate && (
                                <div className="calendar-day-indicator">
                                  {isFull ? (
                                    <span className="indicator-dot full"></span>
                                  ) : isAlmostFull ? (
                                    <span className="indicator-dot almost"></span>
                                  ) : (
                                    <span className="indicator-dot available"></span>
                                  )}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="dates-grid">
                      {availableDates.map((date, index) => {
                        const isSelected = selectedDate && isSameDay(date, selectedDate)
                        const isPastDate = isPast(date) && !isSameDay(date, new Date())
                        const formattedDate = getFormattedDate(date)
                        const dayName = formattedDate.dayName
                        const dayNumber = formattedDate.dayNumber
                        const month = formattedDate.month
                        const dateStr = format(date, 'yyyy-MM-dd')
                        const availability = dateAvailability[dateStr] || { available: timeSlots.length, total: timeSlots.length, booked: 0 }
                        const availabilityPercent = (availability.available / availability.total) * 100
                        const isFull = availability.available === 0 || availability.isClosed
                        const isAlmostFull = availabilityPercent < 30
                        const isClosed = availability.isClosed

                        return (
                          <button
                            key={index}
                            className={`date-card ${isSelected ? 'selected' : ''} ${isPastDate ? 'past' : ''} ${isFull ? 'full' : ''} ${isAlmostFull ? 'almost-full' : ''} ${isClosed ? 'closed' : ''}`}
                            onClick={() => !isPastDate && !isFull && handleDateSelect(date)}
                            disabled={isPastDate || isFull}
                          >
                            <span className="day-name">{dayName}</span>
                            <span className="day-number">{dayNumber}</span>
                            <span className="month">{month}</span>
                            {!isPastDate && (
                              <div className="availability-indicator">
                                {isClosed ? (
                                  <span className="availability-badge closed-badge">Kapalı</span>
                                ) : isFull ? (
                                  <span className="availability-badge full-badge">{t('booking.step1.full')}</span>
                                ) : isAlmostFull ? (
                                  <span className="availability-badge almost-badge">{t('booking.step1.almostFull')}</span>
                                ) : (
                                  isUnifiedMode && availability.barberCounts && Object.keys(availability.barberCounts).length > 0 ? (
                                    <div className="unified-availability-badges">
                                      {Object.entries(availability.barberCounts).map(([bId, count]) => {
                                        if (!barbers[bId]) return null;
                                        return (
                                          <span key={bId} className="availability-badge available-badge" style={{ fontSize: '0.7rem', padding: '2px 6px', marginBottom: '2px' }}>
                                            {barbers[bId].name.split(' ')[0]}: {count}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="availability-badge available-badge">{availability.available} {t('booking.step1.available')}</span>
                                  )
                                )}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Time Selection */}
              <div className={`step ${selectedTime && expandedStep !== 2 ? 'collapsed' : ''} ${expandedStep === 2 ? 'expanded' : ''} ${!selectedDate ? 'disabled' : ''}`}>
                <div className={`step-number ${selectedTime ? 'completed' : expandedStep === 2 ? 'active' : ''}`}>2</div>
                <div className="step-content">
                  <div className="step-header">
                    <h3>{t('booking.step2.title')}</h3>
                    {selectedTime && expandedStep !== 2 && (
                      <button
                        className="edit-step-btn"
                        onClick={() => handleEditStep(2)}
                      >
                        <Edit2 size={16} />
                        {t('booking.step2.change')}
                      </button>
                    )}
                    {expandedStep > 2 && (
                      <button
                        className="back-step-btn"
                        onClick={() => handleStepBack(2)}
                      >
                        <ChevronLeft size={18} />
                        {t('booking.step2.back')}
                      </button>
                    )}
                  </div>

                  {selectedTime && expandedStep !== 2 ? (
                    <div className="step-selected">
                      <div className="selected-item">
                        <Clock size={20} />
                        <div>
                          <div className="selected-label">{t('booking.step2.selectedTime')}</div>
                          <div className="selected-value">{selectedTime}</div>
                        </div>
                      </div>
                    </div>
                  ) : selectedDate ? (
                    loading ? (
                      <p className="step-info">{t('booking.step1.loading')}</p>
                    ) : (
                      <div className="times-grid">
                        {(() => {
                          // Use allTimeSlots from backend. If empty, show nothing or loading.
                          // Fallback to empty array to ensure we don't show wrong times.
                          const activeTimeSlots = allTimeSlots.length > 0 ? allTimeSlots : [];

                          if (activeTimeSlots.length === 0 && !loading) {
                            return <div className="no-times">Müsait saat bulunamadı.</div>;
                          }

                          return activeTimeSlots.map((time, index) => {
                            // Normalize time strings for comparison
                            const normalizedTime = String(time).trim()
                            const normalizedAvailable = Array.isArray(availableTimes)
                              ? availableTimes.map(t => String(t).trim())
                              : []
                            const normalizedBooked = Array.isArray(bookedTimes)
                              ? bookedTimes.map(t => String(t).trim())
                              : []

                            // Break time checks removed
                            const isBreakTime = false
                            const isBreakTimeSlot = false

                            // A time is available if it's in availableTimes array
                            const isAvailable = normalizedAvailable.includes(normalizedTime) && !isBreakTimeSlot

                            // A time is booked if it's explicitly in bookedTimes array OR not available, excluding break slot
                            const isBooked = (normalizedBooked.includes(normalizedTime) || (!isAvailable && !isBreakTimeSlot)) && !isBreakTime

                            const isSelected = selectedTime === time

                            // Check if time is in the past for today
                            const now = new Date()
                            let isPastTime = false
                            if (selectedDate && isSameDay(selectedDate, now)) {
                              const [hours, minutes] = time.split(':').map(Number)
                              const slotDateTime = setMinutes(setHours(new Date(selectedDate), hours), minutes)
                              isPastTime = isBefore(slotDateTime, now)
                            }

                            // Unified Mode Availability
                            const currentAvailableBarberIds = barberAvailability[normalizedTime] || []
                            const hasMultipleBarbers = isUnifiedMode && !selectedBarber && isAvailable && currentAvailableBarberIds.length > 1
                            const hasSingleBarber = isUnifiedMode && !selectedBarber && isAvailable && currentAvailableBarberIds.length === 1
                            const singleBarberName = hasSingleBarber ? barbers[currentAvailableBarberIds[0]]?.name : ''

                            // A time is disabled if it's break time, booked, past, or not available
                            // Priority: break time slot > booked > past > not available
                            const isDisabled = isBreakTimeSlot || isBooked || isPastTime || !isAvailable

                            return (
                              <button
                                key={index}
                                className={`time-slot ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''} ${isPastTime ? 'past' : ''} ${isBreakTime ? 'break-time' : ''} ${isAvailable && !isPastTime && !isBooked ? 'available' : ''} ${isDisabled ? 'disabled-slot' : ''} ${hasMultipleBarbers ? 'multiple-barbers' : ''} ${hasSingleBarber ? 'single-barber' : ''}`}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (!isDisabled) {
                                    if (isUnifiedMode && !selectedBarber) {
                                      if (currentAvailableBarberIds.length === 1) {
                                        setSelectedBarber(currentAvailableBarberIds[0])
                                        handleTimeSelect(time)
                                      } else if (currentAvailableBarberIds.length > 1) {
                                        setPendingTimeForBarber(time)
                                        setShowBarberSelectModal(true)
                                      } else {
                                        handleTimeSelect(time)
                                      }
                                    } else {
                                      handleTimeSelect(time)
                                    }
                                  } else {
                                    // Show feedback when trying to click disabled slot
                                    if (isBreakTimeSlot) {
                                      setToast({ message: 'Bu saat yemek molası', type: 'info' })
                                    } else if (isBooked) {
                                      setToast({ message: 'Bu saat şuan dolu', type: 'warning' })
                                    } else if (isPastTime) {
                                      setToast({ message: 'Bu saat geçmişte kaldı', type: 'warning' })
                                    }
                                  }
                                }}
                                disabled={isDisabled}
                                style={isDisabled ? { pointerEvents: 'none' } : {}}
                                title={isBreakTimeSlot ? (isBreakTime ? 'Yemek Molası' : 'Yemek molası saati') : isBooked ? t('booking.step1.booked') : isPastTime ? t('booking.step1.past') : !isAvailable ? 'Bu saat müsait değil' : ''}
                              >
                                <span className="time-slot-time">{time}</span>
                                {isUnifiedMode && !selectedBarber && isAvailable && !isPastTime && !isBooked && (
                                  <span className="unified-availability-label">
                                    {hasMultipleBarbers ? 'İki Uzman da Boş' : (hasSingleBarber ? `Sadece ${singleBarberName} Boş` : '')}
                                  </span>
                                )}
                                {isBreakTime && <span className="time-slot-label">Yemek Molası</span>}
                                {isBooked && !isPastTime && !isBreakTime && <span className="booked-label">{t('booking.step1.booked')}</span>}
                                {isPastTime && !isBreakTime && <span className="past-label">{t('booking.step1.past')}</span>}
                              </button>
                            )
                          })
                        })()}
                      </div>
                    )
                  ) : (
                    <p className="step-info">{t('booking.step2.selectDateFirst')}</p>
                  )}
                </div>
              </div>

              {/* Step 3: Service Selection */}
              <div className={`step ${selectedService && expandedStep !== 3 ? 'collapsed' : ''} ${expandedStep === 3 ? 'expanded' : ''} ${!selectedTime ? 'disabled' : ''}`}>
                <div className={`step-number ${selectedService ? 'completed' : expandedStep === 3 ? 'active' : ''}`}>3</div>
                <div className="step-content">
                  <div className="step-header">
                    <h3>{t('booking.step3.title')}</h3>
                    {selectedService && expandedStep !== 3 && (
                      <button
                        className="edit-step-btn"
                        onClick={() => handleEditStep(3)}
                      >
                        <Edit2 size={16} />
                        {t('booking.step3.change')}
                      </button>
                    )}
                    {expandedStep > 3 && (
                      <button
                        className="back-step-btn"
                        onClick={() => handleStepBack(3)}
                      >
                        <ChevronLeft size={18} />
                        {t('booking.step3.back')}
                      </button>
                    )}
                  </div>

                  {selectedService && expandedStep !== 3 ? (
                    <div className="step-selected">
                      <div className="selected-item">
                        <Scissors size={20} />
                        <div>
                          <div className="selected-label">{t('booking.step3.selectedService')}</div>
                          <div className="selected-value">{selectedService.name} - {selectedService.price}₺</div>
                        </div>
                      </div>
                    </div>
                  ) : selectedTime ? (
                    <div className="services-list">
                      {servicesLoading ? (
                        <div className="loading-state">
                          <RefreshCw size={24} className="spinning" />
                          <p>Hizmetler yükleniyor...</p>
                        </div>
                      ) : services.length > 0 ? (
                        services.map(service => (
                          <button
                            key={service.id}
                            className={`service-option ${selectedService?.id === service.id ? 'selected' : ''}`}
                            onClick={() => handleServiceSelect(service)}
                          >
                            <Scissors size={20} />
                            <div className="service-info">
                              <span className="service-name">{service.name}</span>
                              <span className="service-details">{service.price}₺</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="empty-state">
                          <p>Aktif hizmet bulunamadı.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="step-info">{t('booking.step3.selectTimeFirst')}</p>
                  )}
                </div>
              </div>

              {/* Step 4: Form */}
              <div className={`step ${expandedStep === 4 ? 'expanded' : ''} ${!selectedService ? 'disabled' : ''}`}>
                <div className={`step-number ${formData.name && formData.phone ? 'active' : expandedStep === 4 ? 'active' : ''}`}>4</div>
                <div className="step-content">
                  <div className="step-header">
                    <h3>{t('booking.step4.title')}</h3>
                    {expandedStep === 4 && selectedService && (
                      <button
                        className="back-step-btn"
                        onClick={() => handleStepBack(3)}
                      >
                        <ChevronLeft size={18} />
                        {t('booking.step3.back')}
                      </button>
                    )}
                  </div>

                  {selectedService ? (
                    <form onSubmit={handleSubmit} className="booking-form">
                      <div className="form-group">
                        <label>
                          <User size={18} />
                          {t('booking.step4.name')} *
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          placeholder={language === 'tr' ? 'Adınız ve soyadınız' : 'Your full name'}
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          <Phone size={18} />
                          {t('booking.step4.phone')} *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={(e) => {
                            let val = e.target.value.replace(/[^0-9]/g, '');
                            if (val.startsWith('0')) val = val.substring(1);
                            if (val.length > 10) val = val.substring(0, 10);
                            setFormData({ ...formData, phone: val });
                          }}
                          required
                          placeholder="5XX XXX XX XX"
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          <Mail size={18} />
                          {t('booking.step4.email')}
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="email@example.com"
                        />
                      </div>
                      <button type="submit" className="golden-button" disabled={loading}>
                        <span className="golden-text">{loading ? (language === 'tr' ? 'Kaydediliyor...' : 'Saving...') : t('booking.step4.submit')}</span>
                      </button>
                    </form>
                  ) : (
                    <p className="step-info">{language === 'tr' ? 'Önce bir hizmet seçiniz' : 'Please select a service first'}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="booking-summary">
              <h3>{t('booking.success.summary.title')}</h3>
              <div className="summary-content">
                <div className="summary-item">
                  <span className="summary-label">{t('booking.success.summary.barber')}</span>
                  <span className="summary-value">{barber ? barber.name : '-'}</span>
                </div>
                {selectedDate && (
                  <div className="summary-item">
                    <span className="summary-label">{t('booking.success.summary.date')}</span>
                    <span className="summary-value">
                      {getFormattedDate(selectedDate).fullDate}
                    </span>
                  </div>
                )}
                {selectedTime && (
                  <div className="summary-item">
                    <span className="summary-label">{t('booking.success.summary.time')}</span>
                    <span className="summary-value">{selectedTime}</span>
                  </div>
                )}
                {selectedService && (
                  <>
                    <div className="summary-item">
                      <span className="summary-label">{t('booking.success.summary.service')}</span>
                      <span className="summary-value">{selectedService.name}</span>
                    </div>
                    <div className="summary-item total">
                      <span className="summary-label">{t('booking.success.summary.total')}</span>
                      <span className="summary-value">{selectedService.price}₺</span>
                    </div>
                  </>
                )}
                {!selectedDate && !selectedTime && !selectedService && (
                  <p className="summary-empty">{t('booking.success.summary.empty')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Success Modal */}
      {showSuccessModal && bookingDetails && (
        <div className="success-modal-overlay" onClick={() => setShowSuccessModal(false)}>
          <div className="success-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowSuccessModal(false)}>
              <X size={20} />
            </button>

            <div className="success-header">
              <div className="success-icon">
                <CheckCircle size={40} />
              </div>
              <h2>{t('booking.success.title')}</h2>
              <p>{t('booking.success.description')}</p>
            </div>

            <div id="booking-receipt" className="booking-receipt">
              <div className="receipt-header-compact">
                <div className="receipt-logo-compact">
                  <Scissors size={24} />
                </div>
                <div className="receipt-title-compact">
                  <h2>Hairlogy Yasin</h2>
                </div>
              </div>

              <div className="receipt-content-compact">
                <div className="receipt-row">
                  <span className="receipt-label-compact">{t('booking.success.receipt.barber')}</span>
                  <span className="receipt-value-compact">{bookingDetails.barberName}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label-compact">{t('booking.success.receipt.date')}</span>
                  <span className="receipt-value-compact">{bookingDetails.appointmentDate}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label-compact">{t('booking.success.receipt.time')}</span>
                  <span className="receipt-value-compact">{bookingDetails.appointmentTime}</span>
                </div>
                <div className="receipt-row">
                  <span className="receipt-label-compact">{t('booking.success.receipt.service')}</span>
                  <span className="receipt-value-compact">{bookingDetails.serviceName}</span>
                </div>
                <div className="receipt-row receipt-total-compact">
                  <span className="receipt-label-compact">{t('booking.success.receipt.total')}</span>
                  <span className="receipt-value-large-compact">{bookingDetails.servicePrice}₺</span>
                </div>
              </div>
            </div>

            <div className="success-actions">
              <button className="download-btn" onClick={handleDownload}>
                <Download size={20} />
                {t('booking.success.download')}
              </button>
              <button className="close-btn" onClick={() => setShowSuccessModal(false)}>
                {t('booking.success.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barber Select Modal for Unified Booking */}
      {showBarberSelectModal && (
        <div className="modal-overlay" onClick={() => {
          setShowBarberSelectModal(false)
          setPendingTimeForBarber(null)
        }}>
          <div className="modal-content barber-select-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header-elegant">
              <h3>{t('booking.step2.title')}</h3>
              <p>{pendingTimeForBarber} saati için uzmanlarımız müsaittir.<br />Lütfen işlemi yapacak uzmanı seçiniz.</p>
            </div>
            <div className="barber-selection-grid">
              {(barberAvailability[pendingTimeForBarber] || []).map(bId => {
                const b = barbers[bId]
                if (!b) return null
                return (
                  <button key={bId} className="barber-select-card" onClick={() => {
                    setSelectedBarber(bId)
                    handleTimeSelect(pendingTimeForBarber)
                    setShowBarberSelectModal(false)
                    setPendingTimeForBarber(null)
                  }}>
                    <strong className="barber-select-name">{b.name}</strong>
                    <span className="barber-select-action">Seç ve İlerle</span>
                  </button>
                )
              })}
            </div>
            <button className="golden-button w-100 mt-4" onClick={() => {
              setShowBarberSelectModal(false)
              setPendingTimeForBarber(null)
            }}>
              <span className="golden-text">İptal</span>
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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

export default BookingPage

