
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום SW רק בסביבת פרודקשן אמיתית
if ('serviceWorker' in navigator) {
  const isProduction = window.location.hostname.includes('github.io');
  if (isProduction) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch(err => console.warn('SW registration skipped:', err));
    });
  }
}

const mount = () => {
  const container = document.getElementById('root');
  if (!container) return;
  
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    
    // הסרת מסך הטעינה אחרי שה-React התחיל לעבוד
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }
    }, 1000);
    
  } catch (error) {
    console.error("Mount error:", error);
  }
};

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}
