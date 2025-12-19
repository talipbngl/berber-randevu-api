// server.js (public klasörüne uyumlu - revize)

require('dotenv').config();
const rateLimit = require('express-rate-limit');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// --- MongoDB Bağlantısı ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('HATA: MONGODB_URI ortam değişkeni tanımlanmamış. Bağlantı yapılamıyor.');
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB bağlantısı başarılı!'))
    .catch((err) => console.error('❌ MongoDB bağlantı hatası:', err.message));
}

// --- Rate Limit (API için) ---
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 1 dakikada 30 istek (10 biraz agresifti)
  message: 'Çok fazla istek gönderdiniz. Lütfen 1 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Statik Dosyalar ---
app.use(express.static(path.join(__dirname, 'public')));

// --- API Routes ---
// Not: admin paneli limitlenmesin istersen /api/admin’a da limiter koyabiliriz.
// Şimdilik ana API limitli, admin ayrı.
app.use('/api', apiLimiter, appointmentRoutes);
app.use('/api/admin', adminRoutes);

// --- Sayfalar ---
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Sunucu
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});
