const CACHE_NAME = 'task-manager-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/signup.html',
  '/profile.html',
  '/offline.html',
  '/style.css',
  '/auth.css',
  '/script.js',
  '/auth.js',
  '/secure-store.js',
  '/profile.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-regular-400.woff2'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch(error => {
        console.error('Cache addAll failed:', error);
      })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Handle CDN resources
  if (requestUrl.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetchAndCache(event.request, STATIC_CACHE);
        })
        .catch(() => {
          return fetch(event.request);
        })
    );
    return;
  }

  // Handle static assets
  if (STATIC_ASSETS.includes(requestUrl.pathname)) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetchAndCache(event.request, STATIC_CACHE);
        })
        .catch(() => {
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // Network first strategy for API requests
  if (requestUrl.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache first strategy for other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetchAndCache(event.request, DYNAMIC_CACHE);
      })
      .catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        return new Response('Offline');
      })
  );
});

// Helper function to fetch and cache
async function fetchAndCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (!response || response.status !== 200) {
      return response;
    }
    const responseToCache = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, responseToCache);
    return response;
  } catch (error) {
    console.error('Fetch and cache failed:', error);
    throw error;
  }
}

// Background sync for offline changes
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncTasks());
  }
});

// Store POST requests for later sync
async function storePostRequest(request) {
  try {
    const offlineData = await request.json();
    // Store in IndexedDB for later sync
    const db = await openDB();
    const tx = db.transaction('offline-tasks', 'readwrite');
    await tx.store.add({
      timestamp: Date.now(),
      data: offlineData
    });
  } catch (error) {
    console.error('Error storing offline request:', error);
  }
}

// Sync stored tasks when back online
async function syncTasks() {
  const db = await openDB();
  const tx = db.transaction('offline-tasks', 'readwrite');
  const store = tx.store;
  const tasks = await store.getAll();

  for (const task of tasks) {
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task.data)
      });
      await store.delete(task.id);
    } catch (error) {
      console.error('Error syncing task:', error);
    }
  }
}

// Open IndexedDB
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('TaskManagerDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offline-tasks')) {
        db.createObjectStore('offline-tasks', { 
          keyPath: 'id',
          autoIncrement: true 
        });
      }
    };
  });
}
