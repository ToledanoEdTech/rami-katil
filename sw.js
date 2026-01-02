
const CACHE_NAME = 'aramaic-master-v3';

// רשימת קבצים בסיסית - אנחנו נטען את השאר באופן דינמי
const INITIAL_ASSETS = [
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // נשתמש ב-addAll עם טיפול בשגיאות לכל קובץ בנפרד למקרה שאחד חסר
      return Promise.allSettled(
        INITIAL_ASSETS.map(asset => cache.add(asset))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // נתעלם מבקשות שאינן HTTP/HTTPS (כמו chrome-extension)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // שמירת עותק עדכני במטמון לשימוש עתידי באופליין רק עבור בקשות מוצלחות
        if (event.request.method === 'GET' && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // אם מדובר בניווט (דף בית), נחזיר תמיד את ה-index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
