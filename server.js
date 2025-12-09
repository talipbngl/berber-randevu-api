// server.js (Modüler Yapı)

require('dotenv').config(); // Yerel ortam değişkenlerini yükler

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path'); // Frontend dosyaları için
const appointmentRoutes = require('./routes/appointmentRoutes'); // Yönlendirmeleri içeri aktarma

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
    // Hata durumunda uygulama bazen yine de çalışmaya devam edebilir
  });

// --- Middleware'ler ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- Statik Dosyalar (Frontend) ---
app.use(express.static('public')); 

// --- API Yönlendirmesi ---
app.use('/api', appointmentRoutes); // Tüm /api istekleri appointmentRoutes'a yönlendirilir

// Ana sayfayı (index.html) sunma
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});