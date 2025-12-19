const express = require('express');
const router = express.Router();

const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');

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

// 1) Randevuları listele
router.get('/appointments', adminAuth, async (req, res) => {
  try {
    const appointments = await Appointment.find({})
      .populate('user_id', 'name phone_number')
      .sort({ start_time: 1 });

    res.json({ count: appointments.length, appointments });
  } catch (error) {
    console.error('Admin Randevu Listeleme Hatası:', error);
    res.status(500).send({ message: 'Sunucu randevuları listelerken hata oluştu.' });
  }
});

// 2) Çalışma saati kaydet/güncelle
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
