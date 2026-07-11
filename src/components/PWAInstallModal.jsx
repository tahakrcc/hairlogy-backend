import React, { useState, useEffect } from 'react';
import { X, Download, Bell } from 'lucide-react';
import { settingsAPI } from '../services/api';
import './PWAInstallModal.css';

const PWAInstallModal = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallModal, setShowInstallModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(ios);

        // Check if already in standalone mode
        const standalone = window.matchMedia('(display-mode: standalone)').matches;
        console.log('PWAInstallModal isStandalone:', standalone);
        setIsStandalone(standalone);
        if (standalone) {
            // Already installed, maybe just ask for notification
            checkNotificationPermission();
            return;
        }

        // Check if event fired before mount
        if (window.deferredPrompt) {
            setDeferredPrompt(window.deferredPrompt);
            if (!sessionStorage.getItem('install_prompt_dismissed')) {
                setShowInstallModal(true);
            }
        }

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            window.deferredPrompt = e;
            setDeferredPrompt(e);
            if (!sessionStorage.getItem('install_prompt_dismissed')) {
                setShowInstallModal(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // For iOS, beforeinstallprompt doesn't fire, so we show a manual guide
        if (ios && !window.navigator.standalone && !sessionStorage.getItem('install_prompt_dismissed')) {
            setShowInstallModal(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const checkNotificationPermission = () => {
        if ('Notification' in window && Notification.permission === 'default' && !sessionStorage.getItem('notification_prompt_shown')) {
            setShowNotificationModal(true);
            sessionStorage.setItem('notification_prompt_shown', 'true');
        }
    };

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
                setShowInstallModal(false);
                checkNotificationPermission();
            }
        } else if (isIOS || !deferredPrompt) {
            // Show custom instructions instead of alert
            setShowIOSInstructions(true);
            setShowInstallModal(false);
        }
    };

    const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
    
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
    
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const handleAllowNotifications = async () => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                if ('serviceWorker' in navigator && 'PushManager' in window) {
                    const registration = await navigator.serviceWorker.ready;
                    // VAPID PUBLIC KEY from your backend
                    const publicVapidKey = 'BPVeG5kVqQfGdUrNpqjH8VuiWQCpatyh48LtS9apEBnu37iP_iPL2W9sYF6S3-n4OHmm8uDmZyXmrzG5dQiHovM';
                    
                    const subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
                    });

                    // Generate a deviceId
                    let deviceId = localStorage.getItem('deviceId');
                    if (!deviceId) {
                        deviceId = 'dev_' + Math.random().toString(36).substr(2, 9);
                        localStorage.setItem('deviceId', deviceId);
                    }

                    // Send to backend
                    await fetch('/api/notifications/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deviceId, subscription })
                    });
                }
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
        }
        setShowNotificationModal(false);
    };

    if (isStandalone) return null;

    return (
        <>
            {/* Yüzen İndirme Butonu (Sol Alt) */}
            <button 
                onClick={() => setShowInstallModal(true)}
                className="pwa-floating-btn"
                aria-label="Uygulamayı İndir"
            >
                <Download size={22} color="#000000" />
                <span className="pwa-floating-btn-text">Uygulamayı İndir</span>
            </button>

            {/* Modals */}
            {(showInstallModal || showNotificationModal || showIOSInstructions) && (
                <div className="pwa-modal-overlay">
            <div className="pwa-modal-content">
                <button 
                    onClick={() => { 
                        setShowInstallModal(false); 
                        setShowNotificationModal(false); 
                        setShowIOSInstructions(false);
                        sessionStorage.setItem('install_prompt_dismissed', 'true');
                    }}
                    className="pwa-modal-close"
                >
                    <X size={20} />
                </button>
                
                {showInstallModal ? (
                    <div>
                        <div className="pwa-icon-container">
                            <Download size={32} />
                        </div>
                        <h3 className="pwa-modal-title">Uygulamamızı Yükleyin</h3>
                        <p className="pwa-modal-text">
                            Randevu almak ve bildirimleri kaçırmamak için Hairlogy uygulamasını ana ekranınıza ekleyin.
                        </p>
                        <button 
                            onClick={handleInstall}
                            className="pwa-action-btn"
                        >
                            {isIOS ? 'Nasıl Yüklenir?' : 'Hemen Yükle'}
                        </button>
                    </div>
                ) : showNotificationModal ? (
                    <div>
                        <div className="pwa-icon-container">
                            <Bell size={32} />
                        </div>
                        <h3 className="pwa-modal-title">Bildirimlere İzin Verin</h3>
                        <p className="pwa-modal-text">
                            Randevu anında ve randevunuza 1 saat kala size hatırlatma gönderebilmemiz için bildirimlere izin verin.
                        </p>
                        <button 
                            onClick={handleAllowNotifications}
                            className="pwa-action-btn"
                        >
                            İzin Ver
                        </button>
                        <button 
                            onClick={() => setShowNotificationModal(false)}
                            className="pwa-cancel-btn"
                        >
                            Şimdi Değil
                        </button>
                    </div>
                ) : showIOSInstructions ? (
                    <div>
                        <div className="pwa-icon-container">
                            <Download size={32} />
                        </div>
                        <h3 className="pwa-modal-title">iOS İçin Kurulum</h3>
                        <div className="pwa-ios-steps">
                            <p className="pwa-ios-step">
                                <span className="pwa-ios-step-number">1</span>
                                <span>Safari'nin alt menüsündeki <strong>Paylaş</strong> ikonuna (Yukarı oklu kare) dokunun.</span>
                            </p>
                            <p className="pwa-ios-step">
                                <span className="pwa-ios-step-number">2</span>
                                <span>Aşağı kaydırıp <strong>Ana Ekrana Ekle</strong> (Add to Home Screen) seçeneğini seçin.</span>
                            </p>
                        </div>
                        <button 
                            onClick={() => setShowIOSInstructions(false)}
                            className="pwa-action-btn"
                        >
                            Anladım
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
        )}
        </>
    );
};

export default PWAInstallModal;
