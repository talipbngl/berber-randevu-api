// server.js (MIME Type ve Dosya Yolu Sorunlarını Gideren Nihai Yapı)

require('dotenv').config(); // Yerel ortam değişkenlerini yükler

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path');
const appointmentRoutes = require('./routes/appointmentRoutes'); // Randevu Rotaları
const adminRoutes = require('./routes/adminRoutes');           // Yönetici Rotaları

const app = express();
const PORT = process.env.PORT || 3000;

// *** 1. MongoDB Bağlantısı ***
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('HATA: MONGODB_URI ortam değişkeni tanımlanmamış. Bağlantı yapılamıyor.');
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB bağlantısı başarılı!'))
  .catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
  });

// --- Middleware'ler ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Statik Dosyalar (Frontend) ---
// KRİTİK DÜZELTME: Tüm frontend dosyaları (HTML, JS, CSS) için proje kökünü kullan.
// Bu, sunucunun dosyaları doğru MIME type ile sunmasını sağlar ve 404 hatalarını engeller.
app.use(express.static(__dirname)); 

// --- API Yönlendirmesi ---
app.use('/api', appointmentRoutes); 
app.use('/api/admin', adminRoutes);

// Ana sayfayı (index.html) sunma
// Statik middleware zaten bunu hallettiği için, sadece kök isteğini index.html'e yönlendiriyoruz
app.get('/', (req, res) => {
    // index.html dosyasının kök dizinde olduğunu varsayıyoruz
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Artık /admin.html rotasına açıkça ihtiyacımız yok, çünkü app.use(express.static(__dirname)) bu dosyayı doğrudan sunar.

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});