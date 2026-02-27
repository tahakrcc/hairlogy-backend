import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Clock, Star, Globe, Instagram, Youtube, MessageCircle } from 'lucide-react'
import Diamond3D from '../components/Diamond3D'
import { useLanguage } from '../contexts/LanguageContext'
import { barbersAPI, servicesAPI } from '../services/api'
import './HomePage.css'

const TikTokIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
)


function HomePage() {
  const navigate = useNavigate()
  const { language, changeLanguage, t } = useLanguage()
  const [socialMediaOpen, setSocialMediaOpen] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  const [barbers, setBarbers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const sectionsRef = useRef([])

  // Load barbers and services from API
  useEffect(() => {
    const loadData = async () => {
      try {
        const [barbersRes, servicesRes] = await Promise.allSettled([
          barbersAPI.getAll(),
          servicesAPI.getAll()
        ])

        if (barbersRes.status === 'fulfilled') {
          setBarbers(barbersRes.value.data.map(b => ({
            id: b.barber_id || b.id,
            name: b.name,
            image: b.image_url || '',
            experience: b.experience || '',
            instagram: b.social_links?.instagram || '',
            tiktok: b.social_links?.tiktok || '',
            youtube: b.social_links?.youtube || ''
          })))
        }

        if (servicesRes.status === 'fulfilled') {
          setServices(servicesRes.value.data)
        }
      } catch (err) {
        // API error
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  useEffect(() => {
    // Intersection Observer for scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in')
        }
      })
    }, observerOptions)

    sectionsRef.current.forEach(section => {
      if (section) observer.observe(section)
    })

    return () => {
      sectionsRef.current.forEach(section => {
        if (section) observer.unobserve(section)
      })
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Show header when at top or scrolling up
      if (currentScrollY < 50) {
        setHeaderVisible(true)
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Hide header when scrolling down past 100px
        setHeaderVisible(false)
      } else if (currentScrollY < lastScrollY) {
        // Show header when scrolling up
        setHeaderVisible(true)
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollY])

  const handleWhatsAppClick = () => {
    const phoneNumber = '905418938744' // Updated WhatsApp number
    const message = encodeURIComponent(t('whatsapp.message'))
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank')
  }

  const handleLanguageChange = (lang) => {
    changeLanguage(lang)
  }

  return (
    <div className="home-page versace-vertical-border versace-vertical-border-right">
      {/* Header */}
      <header className={`header ${headerVisible ? 'visible' : 'hidden'}`}>
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <div className="logo-diamond-wrapper">
                <video
                  className="diamond-video"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                >
                  <source src="/Video_Ready.mp4" type="video/mp4" />
                </video>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="golden-button"
                onClick={() => navigate('/randevu')}
              >
                <span className="golden-text">{t('header.bookAppointment')}</span>
              </button>
              <div className="language-selector">
                <button
                  className={`lang-btn ${language === 'tr' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('tr')}
                >
                  TR
                </button>
                <button
                  className={`lang-btn ${language === 'en' ? 'active' : ''}`}
                  onClick={() => handleLanguageChange('en')}
                >
                  EN
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Barbers */}
      <section
        id="ustalar"
        className="hero-barbers-section greek-key-bg"
        ref={el => sectionsRef.current[0] = el}
      >
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <div className="hero-logo-wrapper hero-logo-wrapper--large">
                <img
                  src="/Gemini_Generated_Image_ii78ufii78ufii78.png"
                  alt="Hairlogy Yasin Premium Logo"
                  className="hero-logo-image hero-logo-image--large"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
              <div className="hero-brand-text-wrapper">
                <span className="hero-brand-premium">Premium</span>
                <span className="hero-brand-randevu">Randevu</span>
              </div>
              {/* Hero description removed as requested */}
            </div>
          </div>

          <div className="barbers-showcase">
            {loading ? (
              <div className="loading-text" style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Yükleniyor...</div>
            ) : barbers.length === 0 ? (
              <div className="loading-text" style={{ textAlign: 'center', color: '#999', padding: '40px' }}>Berber bilgisi yüklenemedi</div>
            ) : (
              barbers.map((barber, index) => (
                <div
                  key={barber.id}
                  className={`barber-showcase-card ${index % 2 === 0 ? 'left-align' : 'right-align'}`}
                  onClick={() => navigate(`/randevu`)}
                >
                  <div className="barber-showcase-image">
                    <img src={barber.image} alt={barber.name} loading="lazy" decoding="async" />
                    <div className="barber-showcase-overlay"></div>
                    <div className="barber-showcase-number">0{barber.id}</div>
                  </div>
                  <div className="barber-showcase-content">
                    <div className="barber-showcase-name-wrapper">
                      <h3 className="barber-showcase-name">{barber.name}</h3>
                      <div className="barber-showcase-line"></div>
                    </div>
                    <p className="barber-showcase-role">{t('hero.barberRole')}</p>
                    <button
                      className="golden-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/randevu`)
                      }}
                    >
                      <span className="golden-text">{t('hero.bookAppointment')}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>



      {/* Contact Section */}
      <section
        id="iletisim"
        className="contact-section"
        ref={el => sectionsRef.current[2] = el}
      >
        <div className="container">
          <h2 className="section-title">{t('contact.title')}</h2>
          <div className="contact-grid">
            <div className="contact-content-wrapper">
              <div className="contact-card">
                <div className="contact-icon-wrapper">
                  <Globe size={32} />
                </div>
                <h3>{t('contact.address')}</h3>
                <a
                  href="https://maps.google.com/?q=38.351147,38.285103"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link address-link"
                >
                  Haritada Konumu Gör
                </a>
              </div>

              <div className="contact-card">
                <div className="contact-icon-wrapper">
                  <MessageCircle size={32} />
                </div>
                <h3>{t('contact.phone')}</h3>
                <a href="tel:+905418938744" className="contact-link">
                  0541 893 87 44
                </a>
              </div>

              <div className="contact-card">
                <div className="contact-icon-wrapper">
                  <Scissors size={32} />
                </div>
                <h3>{t('contact.email')}</h3>
                <a href="mailto:hairlogyyasin@gmail.com" className="contact-link">
                  hairlogyyasin@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>{t('footer.copyright')}</p>
        </div>
      </footer>

      <button className="whatsapp-button" onClick={handleWhatsAppClick} aria-label="WhatsApp">
        <MessageCircle size={32} color="#ffffff" strokeWidth={2.5} style={{ display: 'block' }} />
      </button>

      {/* Social Media Sidebar (per barber) */}
      <div className={`social-sidebar ${socialMediaOpen ? 'open' : ''}`}>
        <button
          className="social-sidebar-toggle"
          onClick={() => setSocialMediaOpen(!socialMediaOpen)}
          aria-label="Sosyal Medya"
        >
          Sosyal
        </button>
        <div className="social-sidebar-content">
          <h4>Sosyal Medya</h4>
          {barbers.map((barber) => (
            <div className="social-barber" key={barber.id}>
              <div className="social-barber-name">{barber.name}</div>
              <div className="social-barber-links">
                {barber.instagram && (
                  <a
                    href={barber.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${barber.name} Instagram`}
                    className="social-barber-link ig"
                  >
                    <Instagram size={16} />
                  </a>
                )}
                {barber.tiktok && (
                  <a
                    href={barber.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${barber.name} TikTok`}
                    className="social-barber-link tt"
                  >
                    <TikTokIcon size={16} />
                  </a>
                )}
                {barber.youtube && (
                  <a
                    href={barber.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${barber.name} YouTube`}
                    className="social-barber-link yt"
                  >
                    <Youtube size={16} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div >
  )
}

export default HomePage
