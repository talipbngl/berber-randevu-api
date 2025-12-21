const express = require('express');
const router = express.Router();

const nodemailer = require('nodemailer');

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');

// Tüm hizmetler 30 dk
const getServiceDurationMinutes = () => 30;

// ===============================
//  MAIL (SADECE GMAIL OAUTH2)
// ===============================
function buildGmailOAuthTransporter() {
  const user = process.env.EMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.warn('E-POSTA: OAuth env eksik (EMAIL_USER / GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN).');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
    },
  });
}

const gmailTransporter = buildGmailOAuthTransporter();

async function sendAppointmentConfirmation(name, phone, date, time, service) {
  console.log("📩 sendAppointmentConfirmation başladı");

  if (!gmailTransporter) {
    console.warn("❌ gmailTransporter NULL -> OAuth env eksik olabilir");
    return;
  }

  console.log("✅ gmailTransporter var, sendMail deneniyor...", {
    user: process.env.EMAIL_USER,
    hasClientId: !!process.env.GMAIL_CLIENT_ID,
    hasSecret: !!process.env.GMAIL_CLIENT_SECRET,
    hasRefresh: !!process.env.GMAIL_REFRESH_TOKEN,
  });

  const appointmentTime = new Date(`${date} ${time}`);
  const formattedDate = appointmentTime.toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = appointmentTime.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `[KYK RANDV] Yeni Randevu: ${formattedDate} ${formattedTime}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #004d99;">Yeni Randevu Bildirimi</h2>
        <hr style="border: 0; border-top: 1px solid #eee;">
        <ul style="list-style: none; padding: 0;">
          <li style="margin-bottom: 10px;"><strong>Müşteri:</strong> ${name}</li>
          <li style="margin-bottom: 10px;"><strong>Telefon:</strong> ${phone}</li>
          <li style="margin-bottom: 10px;"><strong>Tarih:</strong> ${formattedDate}</li>
          <li style="margin-bottom: 10px;"><strong>Saat:</strong> <b>${formattedTime}</b></li>
          <li style="margin-bottom: 10px;"><strong>Hizmet:</strong> ${service}</li>
        </ul>
        <p style="font-size: 0.9em; color: #777;">Otomatik bildirim.</p>
      </div>
    `,
  };

  try {
    const info = await gmailTransporter.sendMail(mailOptions);
    console.log("✅ SENDMAIL OK:", info?.response || info?.messageId || info);
  } catch (err) {
    console.error("❌ SENDMAIL ERROR FULL:", err);        // <-- asıl önemli
    console.error("❌ SENDMAIL ERROR MSG:", err?.message);
  }
}


// ===============================
//  SLOT LISTELEME
// ===============================
router.get('/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });

  try {
    const queryDate = new Date(date);
    if (Number.isNaN(queryDate.getTime())) {
      return res.status(400).send({ message: 'Geçersiz tarih formatı.' });
    }

    const dayOfWeek = queryDate.getDay() === 0 ? 7 : queryDate.getDay();

    const schedule = await Schedule.findOne({ day_of_week: dayOfWeek, barber_id: 1 });
    if (!schedule) {
      return res.send({ date, all_slots: [], booked_slots: [], message: 'Bu günde dükkan kapalıdır.' });
    }

    const { start_shift, end_shift } = schedule;
    const appointmentDuration = 30;

    let currentTime = new Date(`${date} ${start_shift}`);
    const endTime = new Date(`${date} ${end_shift}`);

    if (Number.isNaN(currentTime.getTime()) || Number.isNaN(endTime.getTime()) || currentTime >= endTime) {
      return res.status(400).send({ message: 'Çalışma saatleri hatalı tanımlanmış.' });
    }

    const allSlots = [];
    while (currentTime < endTime) {
      if (new Date(currentTime.getTime() + appointmentDuration * 60000) > endTime) break;

      const slotStr =
        String(currentTime.getHours()).padStart(2, '0') + ':' + String(currentTime.getMinutes()).padStart(2, '0');

      allSlots.push(slotStr);
      currentTime = new Date(currentTime.getTime() + appointmentDuration * 60000);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      start_time: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'Canceled' },
    });

    const blockedSet = new Set();
    const slotDuration = 30;

    bookedAppointments.forEach((app) => {
      let t = app.start_time.getTime();
      const end = app.end_time.getTime();

      while (t < end) {
        const d = new Date(t);
        const s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        blockedSet.add(s);
        t += slotDuration * 60000;
      }
    });

    res.send({ date, all_slots: allSlots, booked_slots: Array.from(blockedSet) });
  } catch (error) {
    console.error('Slot çekme hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu.' });
  }
});

// ===============================
//  RANDEVU AL
// ===============================
router.post('/book', async (req, res) => {
  console.log("✅ /api/book HIT", { body: req.body });
  const { name, phone_number, date, time, service_type } = req.body;

  if (!name || !phone_number || !date || !time || !service_type) {
    return res.status(400).send({ message: 'Lütfen tüm alanları doldurun.' });
  }

  const durationMinutes = getServiceDurationMinutes(service_type);

  const [hour, minute] = String(time).split(':').map(Number);
  const startDateTime = new Date(date);

  if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(hour) || Number.isNaN(minute)) {
    return res.status(400).send({ message: 'Tarih veya saat formatı geçersiz.' });
  }

  startDateTime.setHours(hour, minute, 0, 0);
  const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

  try {
    const user = await User.findOneAndUpdate(
      { phone_number },
      { name },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const conflict = await Appointment.findOne({
      status: { $ne: 'Canceled' },
      start_time: { $lt: endDateTime },
      end_time: { $gt: startDateTime },
    });

    if (conflict) {
      return res.status(409).send({
        message: 'Üzgünüz, seçtiğiniz saat dilimi başka bir randevu ile çakışıyor. Lütfen başka bir saat seçin.',
      });
    }

    const newAppointment = new Appointment({
      user_id: user._id,
      start_time: startDateTime,
      end_time: endDateTime,
      service_type,
    });

    await newAppointment.save();

    console.log("✅ Mail fonksiyonu çağrılacak");
    sendAppointmentConfirmation(name, phone_number, date, time, service_type);
    console.log("✅ Mail fonksiyonu çağrıldı");

    res.status(201).send({
      message: 'Randevunuz başarıyla oluşturuldu.',
      appointment_id: newAppointment._id,
      booked_time: startDateTime.toISOString(),
    });
  } catch (error) {
    console.error('Randevu kaydı hatası:', error);

    if (error.code === 11000) {
      return res.status(409).send({
        message: 'Üzgünüz, seçtiğiniz başlangıç saati kısa süre önce dolmuştur. Lütfen başka bir saat seçin.',
      });
    }

    res.status(500).send({ message: 'Sunucu hatası oluştu, randevu kaydedilemedi.' });
  }
});

// ===============================
//  KULLANICININ AKTİF RANDEVULARI
// ===============================
router.post('/user-appointments', async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) return res.status(400).send({ message: 'Telefon numarası gereklidir.' });

  try {
    const user = await User.findOne({ phone_number });
    if (!user) return res.status(404).send({ message: 'Bu numaraya kayıtlı aktif randevu bulunmamaktadır.' });

    const now = new Date();

    const activeAppointments = await Appointment.find({
      user_id: user._id,
      start_time: { $gte: now },
      status: { $ne: 'Canceled' },
    }).sort({ start_time: 1 });

    if (activeAppointments.length === 0) {
      return res.status(404).send({ message: 'Bu numaraya kayıtlı aktif randevu bulunmamaktadır.' });
    }

    res.status(200).send({
      appointments: activeAppointments.map((app) => ({
        id: app._id,
        time: app.start_time,
        service: app.service_type,
      })),
    });
  } catch (error) {
    console.error('Kullanıcı randevuları listeleme hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu.' });
  }
});

// ===============================
//  ID İLE İPTAL (Modal)
// ===============================
router.delete('/cancel-id/:id', async (req, res) => {
  const appointmentId = req.params.id;

  try {
    const result = await Appointment.deleteOne({ _id: appointmentId });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: 'Randevu bulunamadı veya daha önce iptal edilmiş.' });
    }

    res.status(200).send({ message: 'Randevunuz başarıyla iptal edilmiştir.' });
  } catch (error) {
    console.error('Randevu ID ile iptal hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu, iptal edilemedi.' });
  }
});

// ===============================
//  TELEFON + TARİH + SAAT İLE İPTAL
// ===============================
router.delete('/cancel', async (req, res) => {
  const { phone_number, date, time } = req.body;

  if (!phone_number || !date || !time) {
    return res.status(400).send({ message: 'Telefon, tarih ve saat zorunludur.' });
  }

  const [hour, minute] = String(time).split(':').map(Number);
  const startDateTime = new Date(date);

  if (Number.isNaN(startDateTime.getTime()) || Number.isNaN(hour) || Number.isNaN(minute)) {
    return res.status(400).send({ message: 'Tarih veya saat formatı geçersiz.' });
  }

  startDateTime.setHours(hour, minute, 0, 0);

  try {
    const user = await User.findOne({ phone_number });
    if (!user) return res.status(404).send({ message: 'Kullanıcı bulunamadı.' });

    const appointment = await Appointment.findOne({
      user_id: user._id,
      start_time: startDateTime,
      status: { $ne: 'Canceled' },
    });

    if (!appointment) {
      return res.status(404).send({ message: 'Bu bilgilere ait aktif randevu bulunamadı.' });
    }

    await Appointment.deleteOne({ _id: appointment._id });

    res.status(200).send({ message: 'Randevunuz başarıyla iptal edilmiştir.' });
  } catch (error) {
    console.error('cancel endpoint hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu, iptal edilemedi.' });
  }
});

module.exports = router;
