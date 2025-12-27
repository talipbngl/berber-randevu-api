const express = require('express');
const router = express.Router();

const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');
const DailySchedule = require('../models/DailySchedule');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Admin Auth ---
const adminAuth = (req, res, next) => {
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length === 0) {
    console.error('KRİTİK HATA: ADMIN_PASSWORD ortamda tanımlı değil!');
    return res
      .status(500)
      .send({ message: 'Sunucu yapılandırma hatası: Yönetici parolası eksik.' });
  }

  const { pass } = req.query;

  if (!pass || pass !== ADMIN_PASSWORD) {
    return res.status(401).send({ message: 'Yetkisiz Erişim. Parola Hatalı.' });
  }

  next();
};

// 1) Randevuları listele (Güncellendi: Geçmiş günler gizlendi)
router.get('/appointments', adminAuth, async (req, res) => {
  try {
    // Bugünün başlangıcı (00:00:00)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Sadece başlangıç zamanı bugünün başından büyük olanları getir
    const appointments = await Appointment.find({
      start_time: { $gte: startOfToday }
    })
      .populate('user_id', 'name phone_number')
      .sort({ start_time: 1 });

    res.json({ count: appointments.length, appointments });
  } catch (error) {
    console.error('Admin Randevu Listeleme Hatası:', error);
    res.status(500).send({ message: 'Sunucu randevuları listelerken hata oluştu.' });
  }
});

/**
 * 2A) (ESKİ) Haftalık çalışma saati kaydet/güncelle
 * NOT: Bu endpoint gün bazlı olduğu için gelecek haftaları da etkiler.
 * İstersen admin panelden bunu artık kullanmazsın.
 */
router.post('/schedule', adminAuth, async (req, res) => {
  const { day_of_week, start_shift, end_shift } = req.body;

  if (!day_of_week || !start_shift || !end_shift) {
    return res.status(400).send({ message: 'Lütfen tüm program alanlarını doldurun.' });
  }

  try {
    const schedule = await Schedule.findOneAndUpdate(
      { day_of_week: Number(day_of_week), barber_id: 1 },
      { start_shift, end_shift },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: 'Çalışma saatleri başarıyla güncellendi.', schedule });
  } catch (error) {
    console.error('Admin Çalışma Saati Güncelleme Hatası:', error);
    res.status(500).send({ message: 'Çalışma saatleri güncellenirken hata oluştu.' });
  }
});

/**
 * 2B) ✅ YENİ: Sadece seçilen TARİH için çalışma saati kaydet/güncelle
 * Frontend admin.js bunu çağıracak:
 * POST /api/admin/schedule-day?pass=...
 * body: { date: "YYYY-MM-DD", start_shift: "09:00", end_shift: "18:00" }
 */
router.post('/schedule-day', adminAuth, async (req, res) => {
  const { date, start_shift, end_shift } = req.body;

  if (!date || !start_shift || !end_shift) {
    return res.status(400).send({ message: 'Tarih ve saatler zorunludur.' });
  }

  // Basit format kontrolü: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).send({ message: 'Geçersiz tarih formatı. Örn: 2025-12-30' });
  }

  try {
    const daily = await DailySchedule.findOneAndUpdate(
      { date: String(date), barber_id: 1 },
      { start_shift, end_shift },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({ message: 'Sadece bu tarih için saatler güncellendi.', daily });
  } catch (error) {
  console.error('Admin Gün Bazlı Saat Güncelleme Hatası:', error);
  res.status(500).send({
    message: 'Gün bazlı saatler güncellenirken hata oluştu.',
    details: error?.message || String(error),
    code: error?.code,
  });
}

});

/**
 * 2C) ✅ OPSİYONEL: O tarihe özel kaydı sil (haftalık düzene geri dön)
 * DELETE /api/admin/schedule-day?pass=...
 * body: { date: "YYYY-MM-DD" }
 */
router.delete('/schedule-day', adminAuth, async (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.status(400).send({ message: 'date zorunludur.' });
  }

  try {
    const result = await DailySchedule.deleteOne({ date: String(date), barber_id: 1 });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: 'Bu tarihe ait özel saat kaydı bulunamadı.' });
    }

    res.status(200).send({ message: 'O tarihe özel saat kaydı silindi. Haftalık düzene dönüldü.' });
  } catch (error) {
    console.error('Admin Gün Bazlı Saat Silme Hatası:', error);
    res.status(500).send({ message: 'Gün bazlı saat silinirken hata oluştu.' });
  }
});

// 3) Randevu durumu güncelle
router.patch('/appointment/:id', adminAuth, async (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;

  if (!status || !['Pending', 'Completed', 'Canceled'].includes(status)) {
    return res.status(400).send({ message: 'Geçerli bir durum (Pending, Completed, Canceled) belirtin.' });
  }

  try {
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true, runValidators: true }
    );

    if (!updatedAppointment) {
      return res.status(404).send({ message: 'Belirtilen ID ile randevu bulunamadı.' });
    }

    res.status(200).send({
      message: 'Randevu durumu başarıyla güncellendi.',
      appointment: updatedAppointment,
    });
  } catch (error) {
    console.error('Randevu durumu güncelleme hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu, durum güncellenemedi.' });
  }
});

module.exports = router;
