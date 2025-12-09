// server.js (MIME Type ve ENOENT Hatalarını Gideren Nihai Yapı)

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
// Bu, Render'ın dosyaları doğru MIME type ile sunmasını sağlar ve ENOENT hatalarını engeller.
app.use(express.static(__dirname)); 

// --- API Yönlendirmesi ---
app.use('/api', appointmentRoutes); 
app.use('/api/admin', adminRoutes);

// Ana sayfayı (index.html) sunma
app.get('/', (req, res) => {
    // KRİTİK DÜZELTME: index.html dosyasının kök dizinde olduğunu kesin olarak belirtiyoruz.
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Admin panelini sunma (admin.html)
app.get('/admin.html', (req, res) => {
    // admin.html dosyasının kök dizinde olduğunu kesin olarak belirtiyoruz.
    res.sendFile(path.join(__dirname, 'admin.html')); 
});

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});