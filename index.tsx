
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום ה-Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

function mount() {
  try {
      const container = document.getElementById('root');
      if (container) {
        const root = createRoot(container);
        root.render(
          <React.StrictMode>
            <App />
          </React.StrictMode>
        );
      } else {
        setTimeout(mount, 10);
      }
  } catch (err: any) {
      document.body.innerHTML = `<div style="color:white; padding:20px;">
        <h1>Application Error</h1>
        <pre>${err.toString()}</pre>
        <pre>${err.stack}</pre>
      </div>`;
  }
}

mount();
