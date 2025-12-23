const CACHE_NAME = 'kyk-berber-v1.1'; // Versiyonu artırarak güncellemeyi zorlayabiliriz

self.addEventListener('install', (event) => {
  console.log('Service Worker: Kuruluyor...');
  // Kurulum anında beklemeden aktif olması için
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Aktif Edildi');
  // Eski cache'leri temizleme mantığı (isteğe bağlı)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Eski Cache Siliniyor');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first (Önce ağ) yaklaşımı: Güncel veri her zaman daha önemli
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});