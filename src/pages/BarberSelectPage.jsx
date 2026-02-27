import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Scissors } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { barbersAPI } from '../services/api'
import './BarberSelectPage.css'

function BarberSelectPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [barbers, setBarbers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadBarbers = async () => {
      try {
        const response = await barbersAPI.getAll()
        if (response.data && response.data.length > 0) {
          setBarbers(response.data.map(b => ({
            id: b.barber_id || b.id,
            name: b.name,
            image: b.image_url || '',
            experience: b.experience || ''
          })))
        }
      } catch (err) {
        // API error
      } finally {
        setLoading(false)
      }
    }
    loadBarbers()
  }, [])

  const handleBarberSelect = (barberId) => {
    navigate(`/randevu/${barberId}`)
  }

  return (
    <div className="barber-select-page versace-vertical-border versace-vertical-border-right">
      <header className="barber-select-header">
        <div className="container">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={20} />
            {t('booking.back')}
          </button>
          <h1>Usta Seçin</h1>
        </div>
      </header>

      <main className="barber-select-main">
        <div className="container">
          <div className="barber-select-content">
            <p className="select-description">Randevu almak için bir usta seçin</p>

            <div className="barbers-grid">
              {loading ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px', gridColumn: '1 / -1' }}>Yükleniyor...</div>
              ) : barbers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px', gridColumn: '1 / -1' }}>Berber bilgisi yüklenemedi</div>
              ) : (
                barbers.map((barber) => (
                  <div
                    key={barber.id}
                    className="barber-card greek-key-corner"
                    onClick={() => handleBarberSelect(barber.id)}
                  >
                    <div className="barber-image-wrapper">
                      <img src={barber.image} alt={barber.name} loading="lazy" />
                      <div className="barber-overlay">
                        <Scissors size={32} />
                      </div>
                    </div>
                    <div className="barber-info">
                      <h3>{barber.name}</h3>
                      <p className="barber-experience">{barber.experience}</p>
                    </div>
                    <button className="golden-button">
                      <span className="golden-text">Randevu Al</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BarberSelectPage
