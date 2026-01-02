
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// רישום ה-Service Worker בצורה חסינה לשגיאות Origin
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // בדיקה האם אנחנו בסביבת פיתוח מוגבלת (כמו AI Studio) שבה SW עלול להיחסם
    const isRestrictedEnv = window.location.hostname.includes('goog') || 
                           window.location.hostname.includes('ai.studio') ||
                           window.location.protocol === 'file:';

    if (!isRestrictedEnv) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('SW registered with scope:', reg.scope))
        .catch(err => {
          // שגיאת SW לא אמורה לעצור את המשחק
          console.warn('Service Worker registration skipped or failed:', err);
        });
    } else {
      console.log('Service Worker skipped in development/restricted environment.');
    }
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
    console.error("Mount error detected:", err);
    container.innerHTML = `
      <div style="background:#020617; color:white; padding:40px; font-family:sans-serif; height:100vh; text-align:right;" dir="rtl">
        <h1 style="color:#f59e0b; font-size: 2rem;">שגיאה קריטית בטעינה</h1>
        <p>המשחק לא הצליח לעלות. ייתכן שיש בעיה בקבצי המקור או בדפדפן.</p>
        <div style="background:#1e293b; padding:15px; border-radius:10px; font-family:monospace; font-size:12px; margin-top:20px; overflow:auto; direction: ltr; text-align: left;">
          ${err.toString()}<br/>
          ${err.stack}
        </div>
        <button onclick="location.reload()" style="margin-top:20px; padding:12px 24px; background:#3b82f6; border:none; color:white; border-radius:8px; cursor:pointer; font-weight:bold;">נסה לרענן את הדף</button>
      </div>
    `;
  }
}

// הפעלה בטוחה
if (document.readyState === 'complete') {
  mount();
} else {
  window.addEventListener('load', mount);
}
