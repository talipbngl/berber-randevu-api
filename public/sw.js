self.addEventListener('install', (event) => {
  console.log('Service Worker: Kuruldu');
});

self.addEventListener('fetch', (event) => {
  // Uygulamanın offline çalışması istenirse buraya cache mantığı eklenebilir.
  // Şimdilik sadece isteği iletmesi yeterli.
  event.respondWith(fetch(event.request));
});