const express = require('express');
const router = express.Router();

// Modelleri içeri aktarma
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');

// Yardımcı fonksiyon: Hizmet süresini dakika cinsinden döndürür
const getServiceDurationMinutes = (serviceType) => {
   
    return 30; 
}


// GET /api/slots: Boş randevu saatlerini döndürür
// routes/appointmentRoutes.js -> router.get('/slots', ...) rotası içinde

// ... (dosyanın başlangıcı, require'lar ve getServiceDurationMinutes aynı kalır) ...

// GET /api/slots: Boş randevu saatlerini döndürür (Şimdi dolu slotları da işaretler)
router.get('/slots', async (req, res) => {
    const { date } = req.query; 
    
    // ... (date kontrolü ve dayOfWeek hesaplaması aynı kalır) ...

    try {
        const queryDate = new Date(date);
        const dayOfWeek = (queryDate.getDay() === 0) ? 7 : queryDate.getDay(); 

        // 1. Çalışma programını çekme
        const scheduleResult = await Schedule.findOne({ day_of_week: dayOfWeek, barber_id: 1 });

        if (!scheduleResult) {
            return res.send({ date: date, slots: [], message: 'Bu günde dükkan kapalıdır.' });
        }

        const { start_shift, end_shift } = scheduleResult;
        const allPossibleSlots = []; // TÜM olası slotlar
        const appointmentDuration = 30; 
        
        let currentTime = new Date(`${date} ${start_shift}`);
        const endTime = new Date(`${date} ${end_shift}`);

        // 2. Olası tüm dilimleri oluşturma
        while (currentTime < endTime) {
            const slotStartTime = String(currentTime.getHours()).padStart(2, '0') + ':' + String(currentTime.getMinutes()).padStart(2, '0');
            
            if (new Date(currentTime.getTime() + appointmentDuration * 60000) > endTime) break;

            allPossibleSlots.push(slotStartTime); // Tüm slotları ekle
            currentTime = new Date(currentTime.getTime() + appointmentDuration * 60000); 
        }

        // 3. Mevcut alınmış randevuları ve Kapattığı Tüm Slotları Belirleme
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

        const bookedAppointments = await Appointment.find({
            start_time: { $gte: startOfDay, $lte: endOfDay }
        });
        
        const blockedSlotsSet = new Set();
        const slotDuration = 30;

        bookedAppointments.forEach(app => {
            let currentBlockTime = app.start_time.getTime();
            const endTime = app.end_time.getTime();
            
            // Başlangıç slotunu bloke et
            const startSlotTime = String(app.start_time.getHours()).padStart(2, '0') + ':' + String(app.start_time.getMinutes()).padStart(2, '0');
            blockedSlotsSet.add(startSlotTime);
            
            // Eğer hizmet 30 dakikadan uzunsa, sonraki slotları da bloke et (Şu an 30 dk olsa da mantığı koruyoruz)
            while (currentBlockTime < endTime - 1) { 
                currentBlockTime += slotDuration * 60000;

                if (currentBlockTime < endTime) {
                    const blockedSlotTime = new Date(currentBlockTime);
                    const slotTimeStr = String(blockedSlotTime.getHours()).padStart(2, '0') + ':' + String(blockedSlotTime.getMinutes()).padStart(2, '0');
                    blockedSlotsSet.add(slotTimeStr);
                }
            }
        });

        // YENİ SONUÇ: Tüm slotları ve dolu olanların listesini döndür
        res.send({ 
            date: date, 
            all_slots: allPossibleSlots, // Tüm olası slotlar
            booked_slots: Array.from(blockedSlotsSet) // Dolu olan slotlar
        });

    } catch (error) {
        console.error('Randevu saatleri çekilirken hata:', error);
        res.status(500).send({ message: 'Sunucu hatası oluştu.' });
    }
});
// ... (POST /book rotası ve dosyanın geri kalanı aynı kalır) ...


// POST /api/book: Yeni randevu kaydeder
router.post('/book', async (req, res) => {
    const { name, phone_number, date, time, service_type } = req.body;

    if (!name || !phone_number || !date || !time || !service_type) {
        return res.status(400).send({ message: 'Lütfen tüm alanları doldurun.' });
    }

    const durationMinutes = getServiceDurationMinutes(service_type); // Hizmet süresini al
    
    const [hour, minute] = time.split(':').map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(hour, minute, 0, 0); 
    
    // Hizmet süresine göre bitiş zamanını hesapla
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000); 
    
    try {
        // 1. Kullanıcıyı bul veya oluştur (Mongoose upsert/find)
        let user = await User.findOneAndUpdate(
            { phone_number: phone_number }, 
            { name: name },                 
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        let userId = user._id;

        // 2. Randevu Çakışma Kontrolü ve Kaydetme (ÖNEMLİ: Çift slot kontrolü için geliştirilmesi gerekecek)
        // Şu anki kod sadece başlangıç saatinde çakışmayı kontrol eder. Daha karmaşık çakışma kontrolü sonraki adımda yapılacak.
        
        const newAppointment = new Appointment({
            user_id: userId,
            start_time: startDateTime,
            end_time: endDateTime,
            service_type: service_type,
        });

        await newAppointment.save();

        res.status(201).send({
            message: 'Randevunuz başarıyla oluşturuldu.',
            appointment_id: newAppointment._id,
            booked_time: startDateTime.toISOString()
        });

    } catch (error) {
        console.error('Randevu kaydı sırasında hata:', error);
        
        if (error.code === 11000) {
            return res.status(409).send({ 
                message: 'Üzgünüz, seçtiğiniz başlangıç saati kısa süre önce dolmuştur. Lütfen başka bir saat seçin.' 
            });
        }
        
        res.status(500).send({ message: 'Sunucu hatası oluştu, randevu kaydedilemedi.' });
    }
});

module.exports = router;