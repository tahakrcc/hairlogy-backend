import React from 'react';
import { MessageCircle, Settings } from 'lucide-react';
import './MaintenancePage.css';

const MaintenancePage = () => {
    const WHATSAPP_NUMBER = '905418938744';
    const WHATSAPP_MESSAGE = encodeURIComponent('Merhaba, randevu sistemi bakımda olduğu için WhatsApp üzerinden randevu almak istiyorum.');
    const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE}`;

    return (
        <div className="maintenance-container">
            <div className="maintenance-glass">
                <div className="icon-wrapper">
                    <Settings className="maintenance-icon" />
                </div>
                <h1>Bakım Çalışması</h1>
                <p className="description">
                    Sizlere daha iyi hizmet verebilmek için sistemimizde teknik bir güncelleme yapıyoruz.
                    Kısa bir süre sonra tekrar görüşmek üzere!
                </p>

                <div className="contact-section">
                    <p>Randevu almak için bize WhatsApp üzerinden ulaşabilirsiniz:</p>
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="whatsapp-button">
                        <MessageCircle /> WhatsApp ile Randevu Al
                    </a>
                </div>

                <div className="footer-logo">
                    <span className="logo-text">Hairlogy</span>
                    <span className="logo-premium">Yasin Premium</span>
                </div>
            </div>

            {/* Floating WhatsApp Button */}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="whatsapp-float-button" aria-label="WhatsApp">
                <MessageCircle size={32} />
            </a>
        </div>
    );
};

export default MaintenancePage;
