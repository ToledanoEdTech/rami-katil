import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום ה-Service Worker רק בסביבת ייצור
if ((import.meta as any).env?.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration failed:', err));
  });
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}