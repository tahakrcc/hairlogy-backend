import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import AdminPage from './pages/AdminPage'
import BarberSelectPage from './pages/BarberSelectPage'
import MaintenancePage from './pages/MaintenancePage'
import LoadingScreen from './components/LoadingScreen'
import './App.css'
import './styles/greek-key-patterns.css'

function App() {
  const [loading, setLoading] = useState(true)
  // Bakım Modu Ayarı - Gerçek ortamda backendden veya env'den çekilebilir
  const [maintenanceMode, setMaintenanceMode] = useState(true)

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000) // 2 seconds loading

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <LanguageProvider>
      <Router>
        <div className="app">
          <Routes>
            {/* Admin paneli her zaman aktif kalmalı */}
            <Route path="/admin" element={<AdminPage />} />

            {/* Bakım modu aktifse tüm sayfalar Bakım Sayfasına yönlenir */}
            {maintenanceMode ? (
              <>
                <Route path="/" element={<MaintenancePage />} />
                <Route path="*" element={<MaintenancePage />} />
              </>
            ) : (
              <>
                <Route path="/" element={<HomePage />} />
                <Route path="/berber-sec" element={<BarberSelectPage />} />
                <Route path="/randevu/:barberId" element={<BookingPage />} />
              </>
            )}
          </Routes>
        </div>
      </Router>
    </LanguageProvider>
  )
}

export default App

