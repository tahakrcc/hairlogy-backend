import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, addDays, isSameDay, isPast, setHours, setMinutes, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, getMonth, getYear, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ArrowLeft, Calendar, Clock, User, Phone, Mail, Scissors, ChevronLeft, Edit2, Download, CheckCircle, X, Grid, List, ChevronRight, RefreshCw } from 'lucide-react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useLanguage } from '../contexts/LanguageContext'
import { bookingsAPI } from '../services/api'
import Toast from '../components/Toast'
import './BookingPage.css'

const barbers = {
  1: { name: 'Hıdır Yasin Gökçeoğlu', id: 1 },
  2: { name: 'Emir Gökçeoğlu', id: 2 }
}

const timeSlots = [
  '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
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
  const navigate = useNavigate()
  const { language, t } = useLanguage()
  const barber = barbers[barberId]
  
  // Hizmetler (süre göstermiyoruz)
  const services = [
    { id: 1, name: 'Saç & Sakal + Yıkama + Fön', price: 600 },
    { id: 2, name: 'Saç Kesimi + Yıkama + Fön', price: 500 },
    { id: 3, name: 'VIP Hizmet (Cilt bakımı, keratinli saç bakımı maskesi, profesyonel masaj)', price: 2500 },
    { id: 4, name: 'Profesyonel Buharlı Cilt Bakımı', price: 500 },
    { id: 5, name: 'Buharlı Keratinli Saç Bakımı Maskesi', price: 500 },
    { id: 6, name: 'VIP House Tıraş', price: 5000 }
  ]
  
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
  const [availableDates, setAvailableDates] = useState([])
  const [availableTimes, setAvailableTimes] = useState([])
  const [bookedTimes, setBookedTimes] = useState([])
  const [dateAvailability, setDateAvailability] = useState({}) // Store availability for each date
  const [loading, setLoading] = useState(false)
  const [expandedStep, setExpandedStep] = useState(1) // Track which step is expanded
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [bookingDetails, setBookingDetails] = useState(null)
  const [calendarView, setCalendarView] = useState(false) // Toggle between list and calendar view
  const [currentMonth, setCurrentMonth] = useState(new Date()) // Current month for calendar view
  const [toast, setToast] = useState(null) // Toast notification state
  const [refreshing, setRefreshing] = useState(false) // Refresh button state
  const [lastRefresh, setLastRefresh] = useState(null) // Last refresh timestamp

  useEffect(() => {
    if (!barber) {
      navigate('/')
      return
    }

    const loadInitialData = () => {
      // Generate available dates (next 14 days, excluding Sundays)
      const dates = []
      const today = new Date()
      for (let i = 0; i < 14; i++) {
        const date = addDays(today, i)
        const dayOfWeek = date.getDay()
        if (dayOfWeek !== 0) { // Not Sunday
          dates.push(date)
        }
      }
      setAvailableDates(dates)
      
      // Load availability for all dates
      loadDateAvailability(dates)
    }

    // Load initial data only once (no auto-refresh)
    loadInitialData()
    setLastRefresh(new Date())
  }, [barberId, barber, navigate])

  const loadDateAvailability = async (dates) => {
    const availability = {}
    
    // Try batch query first (more efficient)
    try {
      const dateStrings = dates.map(date => format(date, 'yyyy-MM-dd'))
      const response = await bookingsAPI.getAvailableTimesBatch(barberId, dateStrings)
      const batchData = response.data
      
      dates.forEach(date => {
        const dateStr = format(date, 'yyyy-MM-dd')
        const data = batchData[dateStr]
        
        if (data) {
          if (data.isClosed) {
            availability[dateStr] = {
              available: 0,
              total: timeSlots.length,
              booked: timeSlots.length,
              isClosed: true
            }
          } else {
            availability[dateStr] = {
              available: data.availableTimes.length,
              total: timeSlots.length,
              booked: data.bookedTimes.length
            }
          }
        } else {
          // Fallback
          availability[dateStr] = {
            available: timeSlots.length,
            total: timeSlots.length,
            booked: 0
          }
        }
      })
    } catch (error) {
      // Fallback to individual queries if batch fails
      console.warn('Batch query failed, falling back to individual queries:', error)
      const promises = dates.map(async (date) => {
        const dateStr = format(date, 'yyyy-MM-dd')
        try {
          const response = await bookingsAPI.getAvailableTimes(barberId, dateStr)
          const { availableTimes: times, bookedTimes: booked, isClosed } = response.data
          
          if (isClosed) {
            return { dateStr, data: {
              available: 0,
              total: timeSlots.length,
              booked: timeSlots.length,
              isClosed: true
            }}
          }
          
          return { dateStr, data: {
            available: times.length,
            total: timeSlots.length,
            booked: booked.length
          }}
        } catch (error) {
          return { dateStr, data: {
            available: timeSlots.length,
            total: timeSlots.length,
            booked: 0
          }}
        }
      })
      
      const results = await Promise.allSettled(promises)
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          availability[result.value.dateStr] = result.value.data
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
      for (let i = 0; i < 14; i++) {
        const date = addDays(today, i)
        const dayOfWeek = date.getDay()
        if (dayOfWeek !== 0) {
          dates.push(date)
        }
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

  // Load available times when date is selected (no auto-refresh)
  useEffect(() => {
    if (selectedDate) {
      loadAvailableTimes()
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
      const response = await bookingsAPI.getAvailableTimes(barberId, dateStr)
      const { availableTimes: times, bookedTimes: booked, isClosed, reason } = response.data
      
      // If date is closed, show message and return
      if (isClosed) {
        setAvailableTimes([])
        setBookedTimes([])
        if (!skipLoading) {
          // Show toast notification
          const Toast = (await import('../components/Toast')).default
          Toast.error(reason || 'Bu tarih randevuya kapalıdır')
        }
        setLoading(false)
        return
      }
      
      // Ensure we have arrays and normalize
      const timesArray = Array.isArray(times) ? times.map(t => String(t).trim()) : []
      const bookedArray = Array.isArray(booked) ? booked.map(t => String(t).trim()).filter(t => t) : []
      
      // Filter out past times for today and break time (sadece 16:00)
      const breakTimeSlots = ['16:00']
      const now = new Date()
      const filteredTimes = timesArray.filter(time => {
        const normalizedTime = String(time).trim()
        // Exclude break time slots (16:00) - unavailable
        if (breakTimeSlots.includes(normalizedTime)) {
          return false
        }
        // Filter out past times for today
        if (isSameDay(selectedDate, now)) {
          const [hours, minutes] = time.split(':').map(Number)
          const slotDateTime = setMinutes(setHours(new Date(selectedDate), hours), minutes)
          return !isBefore(slotDateTime, now)
        }
        return true
      })

      // Calculate booked times from all time slots - if not in availableTimes, it's booked
      const allTimeSlotsNormalized = timeSlots.map(t => String(t).trim())
      const availableTimesNormalized = filteredTimes.map(t => String(t).trim())
      const calculatedBooked = allTimeSlotsNormalized.filter(
        slot => !availableTimesNormalized.includes(slot)
      )
      
      // Merge with bookedArray from API (union, no duplicates)
      const finalBooked = [...new Set([...bookedArray, ...calculatedBooked])]
      
      setAvailableTimes(filteredTimes)
      setBookedTimes(finalBooked)
      
      // Debug log
      console.log('📅 Date:', dateStr)
      console.log('✅ Available times:', availableTimesNormalized)
      console.log('❌ Booked times from API:', bookedArray)
      console.log('🔍 Calculated booked (not in available):', calculatedBooked)
      console.log('🎯 Final booked times:', finalBooked)
      console.log('📊 Response data:', response.data)
      
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
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
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
      setExpandedStep(1)
    } else if (step === 2) {
      setSelectedTime(null)
      setSelectedService(null)
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

    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const deviceToken = getOrCreateDeviceToken()
      
      const bookingResponse = await bookingsAPI.create({
        barberId: parseInt(barberId),
        barberName: barber.name,
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
        for (let i = 0; i < 14; i++) {
          const date = addDays(today, i)
          const dayOfWeek = date.getDay()
          if (dayOfWeek !== 0) {
            dates.push(date)
          }
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

  if (!barber) return null

  return (
    <div className="booking-page versace-vertical-border versace-vertical-border-right">
      <header className="booking-header">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            {t('booking.back')}
          </button>
          <h1>{barber.name} - {t('booking.bookAppointment')}</h1>
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
                          const isFull = availability.available === 0
                          const isAlmostFull = availabilityPercent < 30
                          const canSelect = isAvailable && !isPastDate && !isFull && !isSunday && isCurrentMonth

                          return (
                            <button
                              key={index}
                              className={`calendar-day ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${isPastDate ? 'past' : ''} ${isFull ? 'full' : ''} ${isAlmostFull ? 'almost-full' : ''} ${isSunday ? 'sunday' : ''} ${canSelect ? 'available' : ''}`}
                              onClick={() => canSelect && handleDateSelect(date)}
                              disabled={!canSelect}
                              title={isCurrentMonth && !isSunday ? `${format(date, 'dd MMMM yyyy')} - ${availability.available} müsait` : ''}
                            >
                              <span className="calendar-day-number">{date.getDate()}</span>
                              {isCurrentMonth && !isSunday && !isPastDate && (
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
                                <span className="availability-badge available-badge">{availability.available} {t('booking.step1.available')}</span>
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
                        {timeSlots.map((time, index) => {
                          // Normalize time strings for comparison
                          const normalizedTime = String(time).trim()
                          const normalizedAvailable = Array.isArray(availableTimes) 
                            ? availableTimes.map(t => String(t).trim())
                            : []
                          const normalizedBooked = Array.isArray(bookedTimes)
                            ? bookedTimes.map(t => String(t).trim())
                            : []
                          
                          // Break time only for 16:00 (yemek molası). 17:00 artık kapalı değil.
                          const isBreakTime = time === '16:00'
                          const isBreakTimeSlot = time === '16:00'
                          const isSeventeen = time === '17:00'
                          
                          // A time is available if it's in availableTimes array and not break time slot
                          // 17:00 özel durum: backend listesinde eksik olsa da, booked değilse açık say.
                          const isAvailable = ((normalizedAvailable.includes(normalizedTime) || isSeventeen) && !isBreakTimeSlot)
                          // A time is booked if it's explicitly in bookedTimes array OR not available (after availability calc), excluding break slot
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

                          // A time is disabled if it's break time, booked, past, or not available
                          // Priority: break time slot > booked > past > not available
                          const isDisabled = isBreakTimeSlot || isBooked || isPastTime || !isAvailable
                          
                          return (
                            <button
                              key={index}
                              className={`time-slot ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''} ${isPastTime ? 'past' : ''} ${isBreakTime ? 'break-time' : ''} ${isBreakTimeSlot && !isBreakTime ? 'break-time-slot' : ''} ${isAvailable && !isPastTime && !isBooked && !isBreakTimeSlot ? 'available' : ''} ${isDisabled ? 'disabled-slot' : ''}`}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (!isDisabled) {
                                  handleTimeSelect(time)
                                } else {
                                  // Show feedback when trying to click disabled slot
                                  if (isBreakTimeSlot) {
                                    setToast({ message: 'Bu saat yemek molası', type: 'info' })
                                  } else if (isBooked) {
                                    setToast({ message: 'Bu saat zaten dolu', type: 'warning' })
                                  } else if (isPastTime) {
                                    setToast({ message: 'Bu saat geçmişte', type: 'warning' })
                                  }
                                }
                              }}
                              disabled={isDisabled}
                              style={isDisabled ? { pointerEvents: 'none' } : {}}
                              title={isBreakTimeSlot ? (isBreakTime ? 'Yemek Molası' : 'Yemek molası saati') : isBooked ? t('booking.step1.booked') : isPastTime ? t('booking.step1.past') : !isAvailable ? 'Bu saat müsait değil' : ''}
                            >
                              <span className="time-slot-time">{time}</span>
                              {isBreakTime && <span className="time-slot-label">Yemek Molası</span>}
                              {isBooked && !isPastTime && !isBreakTime && <span className="booked-label">{t('booking.step1.booked')}</span>}
                              {isPastTime && !isBreakTime && <span className="past-label">{t('booking.step1.past')}</span>}
                            </button>
                          )
                        })}
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
                      {services.map(service => (
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
                      ))}
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
                          onChange={handleInputChange}
                          required
                          placeholder="05XX XXX XX XX"
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
                  <span className="summary-value">{barber.name}</span>
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

