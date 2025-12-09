// server.js (public Klasörüne Uyumlu Nihai Sürüm)

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
// KRİTİK DÜZELTME: Tüm Frontend dosyalarını 'public' klasöründe arayacağız.
app.use(express.static(path.join(__dirname, 'public'))); 

// --- API Yönlendirmesi ---
app.use('/api', appointmentRoutes); 
app.use('/api/admin', adminRoutes);

// Ana sayfayı (index.html) sunma
// KRİTİK DÜZELTME: Kök istek (/) geldiğinde, public klasörü içindeki index.html dosyasını sunar.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html')); 
});

// Admin panelini sunma (admin.html)
// Bu rota statik middleware tarafından halledilebilir, ancak kesinlik için açıkça tanımlıyoruz.
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html')); 
});


// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});