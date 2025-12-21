import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, Clock, Star, Globe, Instagram, Youtube, MessageCircle } from 'lucide-react'
import Diamond3D from '../components/Diamond3D'
import { useLanguage } from '../contexts/LanguageContext'
import './HomePage.css'

const barbers = [
  {
    id: 1,
    name: 'Hıdır Yasin Gökçeoğlu',
    image: '/yasin-new.jpg',
    instagram: 'https://www.instagram.com/hairology_yasin?igsh=eWZlN3c4emF2bTRu&utm_source=qr',
    tiktok: 'https://www.tiktok.com/@hidir_yasin?_r=1&_t=ZS-9281Gzsz8VQ',
    youtube: 'https://youtube.com/@hdrgokceoglu5095?si=lL8J2m-HA_r6tK1H'
  },
  {
    id: 2,
    name: 'Emir Gökçeoğlu',
    image: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg',
    instagram: 'https://www.instagram.com/emirgokceoglu1?igsh=YjBjYm1tYWVheTR4',
    tiktok: 'https://www.tiktok.com/@emirgokceoglu?_r=1&_t=ZS-9284iyXxzcq'
  }
]

const services = [
  { id: 1, name: 'Saç Kesimi', duration: 30, price: 150 },
  { id: 2, name: 'Saç ve Sakal', duration: 45, price: 200 },
  { id: 3, name: 'Sakal', duration: 20, price: 100 },
  { id: 4, name: 'Çocuk Tıraşı', duration: 25, price: 120 },
  { id: 5, name: 'Bakım/Mask', duration: 30, price: 180 }
]

const galleryImages = [
  { id: 1, image: '/yasin-new.jpg', title: 'Modern Kesim' },
  { id: 2, image: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg', title: 'Fade Tasarımı' },
  { id: 3, image: '/yasin-new.jpg', title: 'Klasik Tıraş' },
  { id: 4, image: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg', title: 'Sakal Tasarımı' },
  { id: 5, image: '/yasin-new.jpg', title: 'Premium Hizmet' },
  { id: 6, image: '/WhatsApp%20Image%202025-12-09%20at%2012.00.59.jpeg', title: 'Özel Kesim' }
]

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
  const sectionsRef = useRef([])

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
                onClick={() => navigate('/berber-sec')}
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
            {barbers.map((barber, index) => (
              <div
                key={barber.id}
                className={`barber-showcase-card ${index % 2 === 0 ? 'left-align' : 'right-align'}`}
                onClick={() => navigate(`/randevu/${barber.id}`)}
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
                      navigate(`/randevu/${barber.id}`)
                    }}
                  >
                    <span className="golden-text">{t('hero.bookAppointment')}</span>
                  </button>
                </div>
              </div>
            ))}
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
                  href="https://www.google.com/maps/search/?api=1&query=%C4%B0n%C3%B6n%C3%BC+Caddesi+No:174+Ye%C5%9Filyurt+Malatya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link address-link"
                >
                  İnönü, İnönü Cd. No:174, 44090 Yeşilyurt/Malatya (Movenpick Hotel -1. Kat)
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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ color: '#ffffff' }}
        >
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 1.77.633 3.462 1.745 4.921l-1.103 4.029 4.143-1.087zm9.641-7.411c-.02-.588-.315-.995-.611-1.143-.293-.148-1.733-.855-2.003-.951-.271-.097-.472-.148-.673.148-.2.296-.777.951-.951 1.148-.175.196-.349.222-.647.073-.297-.149-1.258-.46-2.396-1.472-.888-.79-1.488-1.767-1.66-2.063-.173-.296-.018-.457.13-.604.135-.133.303-.346.452-.519.148-.172.197-.295.295-.494.099-.197.05-.37-.025-.519-.074-.148-.673-1.614-.922-2.209-.241-.577-.487-.498-.669-.507-.173-.008-.371-.008-.571-.008-.2 0-.523.074-.795.369-.271.296-1.041 1.012-1.041 2.467 0 1.455 1.062 2.861 1.209 3.056.148.196 2.094 3.195 5.071 4.475.707.304 1.258.486 1.69.621.71.222 1.357.191 1.867.116.57-.084 1.758-.714 2.004-1.405.247-.69.247-1.282.173-1.406-.073-.122-.27-.197-.568-.344z" />
        </svg>
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
    </div>
  )
}

export default HomePage
