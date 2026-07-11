import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { registerSW } from 'virtual:pwa-register'

// Catch the event early before React mounts
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.deferredPrompt = e;
});

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Yeni bir sürüm mevcut. Uygulamayı güncellemek ister misiniz?')) {
      updateSW(true)
    }
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
