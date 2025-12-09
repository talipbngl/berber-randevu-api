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
router.get('/slots', async (req, res) => {
    const { date } = req.query; 
    
    if (!date) {
        return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });
    }

    try {
        const queryDate = new Date(date);
        const dayOfWeek = (queryDate.getDay() === 0) ? 7 : queryDate.getDay(); // 1=Pazartesi, 7=Pazar

        // 1. Çalışma programını çekme
        const scheduleResult = await Schedule.findOne({ 
            day_of_week: dayOfWeek, 
            barber_id: 1 
        });

        if (!scheduleResult) {
            return res.send({ date: date, slots: [], message: 'Bu günde dükkan kapalıdır.' });
        }

        const { start_shift, end_shift } = scheduleResult;
        const availableSlots = [];
        const appointmentDuration = 30; // Temel slot süresi 30 dakika
        
        let currentTime = new Date(`${date} ${start_shift}`);
        const endTime = new Date(`${date} ${end_shift}`);

        // 2. Olası tüm dilimleri oluşturma
        while (currentTime < endTime) {
            const slotStartTime = String(currentTime.getHours()).padStart(2, '0') + ':' + String(currentTime.getMinutes()).padStart(2, '0');
            
            // Eğer bir sonraki slot (30 dk sonra) bitiş saatini aşacaksa, döngüyü kır
            if (new Date(currentTime.getTime() + appointmentDuration * 60000) > endTime) break;

            availableSlots.push(slotStartTime);
            currentTime = new Date(currentTime.getTime() + appointmentDuration * 60000); // 30 dakika ekle
        }

        // 3. Mevcut alınmış randevuları çekme
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

        const bookedAppointments = await Appointment.find({
            start_time: { $gte: startOfDay, $lte: endOfDay }
        });
        
        // Randevu başlangıç saatlerini HH:MM formatına çevirme
        const bookedTimes = bookedAppointments.map(app => 
            String(app.start_time.getHours()).padStart(2, '0') + ':' + String(app.start_time.getMinutes()).padStart(2, '0')
        );

        // 4. Boş olanları filtreleme
        const finalSlots = availableSlots.filter(slot => !bookedTimes.includes(slot));

        res.send({ 
            date: date, 
            slots: finalSlots 
        });

    } catch (error) {
        console.error('Randevu saatleri çekilirken hata:', error);
        res.status(500).send({ message: 'Sunucu hatası oluştu.' });
    }
});


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