
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום Service Worker רק ב-Production (GitHub Pages)
if ('serviceWorker' in navigator) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isGoog = window.location.hostname.includes('goog') || window.location.hostname.includes('ai.studio');

  if (!isLocal && !isGoog) {
    window.addEventListener('load', () => {
      // שימוש בנתיב יחסי לרישום
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW Registered:', reg.scope))
        .catch(err => console.warn('SW Failed:', err));
    });
  }
}

const mount = () => {
  const container = document.getElementById('root');
  if (!container) return;
  
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}
