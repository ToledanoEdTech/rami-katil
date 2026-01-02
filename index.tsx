
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום SW
if ('serviceWorker' in navigator) {
  const isProduction = window.location.hostname.includes('github.io');
  if (isProduction) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

const initApp = () => {
  const container = document.getElementById('root');
  if (!container) return;
  
  try {
    const root = createRoot(container);
    root.render(<App />);
    
    // הסרת מסך הטעינה
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 500);
      }
    }, 800);
  } catch (e) {
    console.error("Render error:", e);
  }
};

// בגלל השימוש ב-Babel, אנחנו מוודאים שה-DOM מוכן
if (document.readyState === 'complete') {
  initApp();
} else {
  window.addEventListener('load', initApp);
}
