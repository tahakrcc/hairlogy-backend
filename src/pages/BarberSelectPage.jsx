import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Scissors } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import './BarberSelectPage.css'

const barbers = [
  {
    id: 1,
    name: 'Hıdır Yasin Gökçeoğlu',
    image: '/WhatsApp%20Image%202025-12-09%20at%2000.46.04.jpeg',
    experience: '7 Yıl Deneyim',
    instagram: 'https://www.instagram.com/hairology_yasin?igsh=eWZlN3c4emF2bTRu&utm_source=qr',
    tiktok: 'https://www.tiktok.com/@hidir_yasin?_r=1&_t=ZS-9281Gzsz8VQ',
    youtube: 'https://youtube.com/@hdrgokceoglu5095?si=lL8J2m-HA_r6tK1H'
  },
  {
    id: 2,
    name: 'Emir Gökçeoğlu',
    image: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg',
    experience: '2 Yıl Deneyim',
    instagram: 'https://www.instagram.com/emir',
    tiktok: 'https://www.tiktok.com/@emir'
  }
]

function BarberSelectPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()

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
              {barbers.map((barber) => (
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
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BarberSelectPage

