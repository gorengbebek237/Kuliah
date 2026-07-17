// Ubah nama versi setiap kali ada pembaruan pada file HTML/CSS/JS
const CACHE_NAME = 'smart-office-v2'; 
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js'
];

// Event Install: Menyimpan file ke dalam cache baru
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Membuka cache versi baru');
        return cache.addAll(urlsToCache);
      })
  );
});

// Event Activate: MENGHAPUS cache versi lama (v1) agar tidak bentrok
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Event Fetch: Mengambil file dari cache, jika tidak ada ambil dari jaringan
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - kembalikan response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});