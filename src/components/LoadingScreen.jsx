import React from 'react'
import { Scissors } from 'lucide-react'
import './LoadingScreen.css'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-brand">
          <h1 className="brand-name">Hairlogy Yasin</h1>
          <div className="brand-divider"></div>
          <span className="brand-premium">Premium</span>
        </div>
        <div className="loading-logo-wrapper">
          <img 
            src="/Gemini_Generated_Image_ii78ufii78ufii78.png" 
            alt="Hairlogy Yasin Premium Logo" 
            className="loading-logo-image"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div className="loading-progress">
          <div className="progress-bar">
            <div className="progress-fill"></div>
          </div>
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        <p className="loading-text">Yükleniyor...</p>
      </div>
    </div>
  )
}

export default LoadingScreen

