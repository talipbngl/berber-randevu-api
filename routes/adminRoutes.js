const express = require('express');
const router = express.Router();

// Modelleri içeri aktarma
const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; 

// --- Middleware: Admin Yetkilendirme Kontrolü ---
const adminAuth = (req, res, next) => {
    // ADMIN_PASSWORD'un ortam değişkenlerinden doğru yüklendiğinden emin olun
   if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length === 0) {
        console.error("HATA AYIKLAMA: ADMIN_PASSWORD ortamda tanımlı DEĞİL. Render'da ayarlı olduğundan emin olun.");
        // Kullanıcıya gizli parolayı göstermeden genel bir hata dönelim
        return res.status(500).send({ message: 'Sunucu yapılandırma hatası: Parola bulunamadı.' });
    }
    
    // Parolayı sorgu parametresi (query parameter) ile alalım: /api/admin?pass=...
    const { pass } = req.query; 

    if (!pass || pass !== ADMIN_PASSWORD) {
        // 401: Yetkisiz (Unauthorized)
        return res.status(401).send({ message: 'Yetkisiz Erişim. Lütfen yönetici parolasını sağlayın.' });
    }
    // Parola doğruysa devam et
    next(); 
};

// --- Yönetici API Uç Noktaları ---

// Sadece yönetici parolası doğruysa randevuları listeler.
// Örnek kullanım: GET /api/admin/appointments?pass=SUPER_SECRET_ADMIN_PASS
router.get('/appointments', adminAuth, async (req, res) => {
    try {
        // Tüm randevuları kullanıcı bilgileriyle birlikte çeker
        const appointments = await Appointment.find({})
                                                .populate('user_id', 'name phone_number') // User modelinden isim ve telefon numarasını çek
                                                .sort({ start_time: 1 }); // En yakın zamana göre sırala

        res.json({ count: appointments.length, appointments });
    } catch (error) {
        console.error('Admin Randevu Listeleme Hatası:', error);
        res.status(500).send({ message: 'Sunucu randevuları listelerken hata oluştu.' });
    }
});

// Yeni Çalışma Saati Kaydetme veya Güncelleme (Örnek)
// Randevuları yönetme yetkisi sadece admin'de olmalı.
router.post('/schedule', adminAuth, async (req, res) => {
    const { day_of_week, start_shift, end_shift } = req.body;
    
    if (!day_of_week || !start_shift || !end_shift) {
        return res.status(400).send({ message: 'Lütfen tüm program alanlarını doldurun.' });
    }

    try {
        const schedule = await Schedule.findOneAndUpdate(
            { day_of_week: day_of_week, barber_id: 1 }, // Mevcut günü bul
            { start_shift, end_shift },
            { new: true, upsert: true } // Yoksa oluştur
        );

        res.status(200).json({ message: 'Çalışma saatleri başarıyla güncellendi.', schedule });
    } catch (error) {
        console.error('Admin Çalışma Saati Güncelleme Hatası:', error);
        res.status(500).send({ message: 'Çalışma saatleri güncellenirken hata oluştu.' });
    }
});

module.exports = router;