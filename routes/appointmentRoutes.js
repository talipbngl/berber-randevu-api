const express = require('express');
const router = express.Router();

const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');
const DailySchedule = require('../models/DailySchedule');

// Tüm hizmetler 30 dk
const getServiceDurationMinutes = () => 30;

// ===============================
//  TIME HELPERS (TZ/parse sorunlarını bitirir)
// ===============================
function parseLocalDateOnly(dateStr) {
  // "YYYY-MM-DD" -> local Date (00:00)
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function parseLocalDateTime(dateStr, timeStr) {
  // "YYYY-MM-DD" + "HH:mm" -> local Date
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr).split(':').map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return new Date('invalid');
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// ===============================
//  MAIL (SADECE GMAIL OAUTH2 - Render uyumlu)
// ===============================
function buildGmailOAuthClient() {
  const user = process.env.EMAIL_USER;
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!user || !clientId || !clientSecret || !refreshToken) {
    console.warn(
      'E-POSTA: OAuth env eksik (EMAIL_USER / GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN).'
    );
    return null;
  }

  const oAuth2Client = new OAuth2Client(clientId, clientSecret);
  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  return { user, clientId, clientSecret, refreshToken, oAuth2Client };
}

const gmailAuth = buildGmailOAuthClient();

async function sendAppointmentConfirmation(name, phone, date, time, service) {
  if (!gmailAuth) {
    console.warn('E-POSTA: gmailAuth yok, mail atlandı.');
    return;
  }

  const { user, clientId, clientSecret, refreshToken, oAuth2Client } = gmailAuth;

  // 1) Access token al
  let accessToken;
  try {
    const tokenResponse = await oAuth2Client.getAccessToken();
    accessToken = tokenResponse?.token;
    if (!accessToken) throw new Error('Access token alınamadı (token boş).');
  } catch (err) {
    console.error('E-POSTA: Access token alma hatası:', err?.message || err);
    return;
  }

  // 2) Transporter (timeout’lu)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken,
      accessToken,
    },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  const appointmentTime = parseLocalDateTime(date, time);

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
    from: user,
    to: user,
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
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-POSTA: Gmail OAuth2 ile gönderildi.', info?.messageId || info?.response || '');
  } catch (err) {
    console.error('❌ E-POSTA: Gmail OAuth2 gönderim hatası:', err?.message || err);
  }
}

// ===============================
//  SLOT LISTELEME (DailySchedule override + geçmiş saat filtresi)
// ===============================
router.get('/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });

  try {
    const queryDate = parseLocalDateOnly(date);
    const now = new Date();

    if (Number.isNaN(queryDate.getTime())) {
      return res.status(400).send({ message: 'Geçersiz tarih formatı.' });
    }

    const dayOfWeek = queryDate.getDay() === 0 ? 7 : queryDate.getDay();

    // ✅ 1) Önce "o güne özel" saat var mı?
    const daily = await DailySchedule.findOne({ date: String(date), barber_id: 1 });

    // ✅ 2) Yoksa haftalık düzene düş
    const weekly = daily
      ? null
      : await Schedule.findOne({ day_of_week: dayOfWeek, barber_id: 1 });

    const scheduleToUse = daily || weekly;

    if (!scheduleToUse) {
      return res.send({ date, all_slots: [], booked_slots: [], message: 'Bu günde dükkan kapalıdır.' });
    }

    const { start_shift, end_shift } = scheduleToUse;
    const appointmentDuration = 30;

    let currentTime = parseLocalDateTime(date, start_shift);
    const endTime = parseLocalDateTime(date, end_shift);

    // Bugün mü? (geçmiş saat filtresi sadece bugün çalışsın)
    const isToday =
      queryDate.getFullYear() === now.getFullYear() &&
      queryDate.getMonth() === now.getMonth() &&
      queryDate.getDate() === now.getDate();

    const allSlots = [];
    while (currentTime < endTime) {
      if (new Date(currentTime.getTime() + appointmentDuration * 60000) > endTime) break;

      // ✅ sadece bugünse geçmiş saatleri filtrele
      if (!isToday || currentTime > now) {
        const slotStr =
          String(currentTime.getHours()).padStart(2, '0') + ':' + String(currentTime.getMinutes()).padStart(2, '0');
        allSlots.push(slotStr);
      }

      currentTime = new Date(currentTime.getTime() + appointmentDuration * 60000);
    }

    // booked slots (aynı)
    const startOfDay = parseLocalDateOnly(date);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);

    const bookedAppointments = await Appointment.find({
      start_time: { $gte: startOfDay, $lte: endOfDay },
      status: { $ne: 'Canceled' },
    });

    const blockedSet = new Set();
    bookedAppointments.forEach((app) => {
      let t = app.start_time.getTime();
      const end = app.end_time.getTime();
      while (t < end) {
        const d = new Date(t);
        const s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
        blockedSet.add(s);
        t += 30 * 60000;
      }
    });

    res.send({ date, all_slots: allSlots, booked_slots: Array.from(blockedSet) });
  } catch (error) {
    console.error('Slot çekme hatası:', error);
    res.status(500).send({ message: 'Sunucu hatası oluştu.' });
  }
});

// ===============================
//  RANDEVU AL (Güncellendi: Mükerrer randevu engeli)
// ===============================
router.post('/book', async (req, res) => {
  const { name, phone_number, date, time, service_type } = req.body;
  // ... (Giriş kontrolleri aynı)

  const startDateTime = parseLocalDateTime(date, time);
  const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

  try {
    const user = await User.findOneAndUpdate(
      { phone_number },
      { name },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // --- GÜNCELLEME: Aynı gün mükerrer randevu kontrolü ---
    const startOfDay = new Date(startDateTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startDateTime);
    endOfDay.setHours(23, 59, 59, 999);

    const existingApp = await Appointment.findOne({
      user_id: user._id,
      status: { $ne: 'Canceled' },
      start_time: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingApp) {
      return res.status(400).send({ 
        message: 'Aynı gün için zaten aktif bir randevunuz bulunuyor. Lütfen mevcut randevunuzu iptal edin veya başka bir gün seçin.' 
      });
    }

    // ... (Conflict kontrolü ve kaydetme işlemleri aynı kalıyor)
    const conflict = await Appointment.findOne({
      status: { $ne: 'Canceled' },
      start_time: { $lt: endDateTime },
      end_time: { $gt: startDateTime },
    });

    if (conflict) return res.status(409).send({ message: 'Bu saat dilimi az önce doldu.' });

    const newAppointment = new Appointment({
      user_id: user._id,
      start_time: startDateTime,
      end_time: endDateTime,
      service_type,
      // Randevu tarihinden tam 10 gün sonra silinmesi için:
      expireAt: new Date(startDateTime.getTime() + 10 * 24 * 60 * 60 * 1000) 
    });

    await newAppointment.save();
    sendAppointmentConfirmation(name, phone_number, date, time, service_type);

    res.status(201).send({ message: 'Randevunuz başarıyla oluşturuldu.' });
  } catch (error) {
    res.status(500).send({ message: 'Sunucu hatası.' });
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
//  ID İLE İPTAL
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

  const startDateTime = parseLocalDateTime(date, time);
  if (Number.isNaN(startDateTime.getTime())) {
    return res.status(400).send({ message: 'Tarih veya saat formatı geçersiz.' });
  }

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
