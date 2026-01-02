
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום ה-Service Worker בצורה אמינה יותר
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => console.log('SW registered with scope:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

function mount() {
  const container = document.getElementById('root');
  if (!container) {
    console.warn("Root container not found, retrying...");
    setTimeout(mount, 50);
    return;
  }

  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("App mounted successfully");
  } catch (err: any) {
    console.error("Mount error:", err);
    container.innerHTML = `
      <div style="background:#020617; color:white; padding:40px; font-family:sans-serif; height:100vh;">
        <h1 style="color:#f59e0b;">שגיאה בטעינת המשחק</h1>
        <p>משהו השתבש במהלך ההפעלה. נסה לרענן את הדף.</p>
        <div style="background:#1e293b; padding:15px; border-radius:10px; font-family:monospace; font-size:12px; margin-top:20px; overflow:auto;">
          ${err.toString()}<br/>
          ${err.stack}
        </div>
        <button onclick="location.reload()" style="margin-top:20px; padding:10px 20px; background:#3b82f6; border:none; color:white; border-radius:5px; cursor:pointer;">רענן דף</button>
      </div>
    `;
  }
}

// הפעלה מושהית קלות כדי לוודא שה-DOM מוכן ב-100%
if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}
