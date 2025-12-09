// routes/appointmentRoutes.js

const express = require('express');
const router = express.Router();

// Modelleri içeri aktarma
const User = require('../models/User');
const Appointment = require('../models/Appointment');
const Schedule = require('../models/Schedule');

// Yardımcı fonksiyon: Tüm hizmetler 30 dakika olarak sabitlendi.
const getServiceDurationMinutes = (serviceType) => {
    return 30; 
}


// GET /api/slots: Boş randevu saatlerini döndürür (Dolu olanları işaretler)
router.get('/slots', async (req, res) => {
    const { date } = req.query; 
    
    if (!date) {
        return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });
    }

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
            
            const startSlotTime = String(app.start_time.getHours()).padStart(2, '0') + ':' + String(app.start_time.getMinutes()).padStart(2, '0');
            blockedSlotsSet.add(startSlotTime);
            
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


// POST /api/book: Yeni randevu kaydeder
router.post('/book', async (req, res) => {
    const { name, phone_number, date, time, service_type } = req.body;

    if (!name || !phone_number || !date || !time || !service_type) {
        return res.status(400).send({ message: 'Lütfen tüm alanları doldurun.' });
    }

    const durationMinutes = getServiceDurationMinutes(service_type); 
    
    const [hour, minute] = time.split(':').map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(hour, minute, 0, 0); 
    
    const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000); 
    
    try {
        let user = await User.findOneAndUpdate(
            { phone_number: phone_number }, 
            { name: name },                 
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        let userId = user._id;

        // KAPSAMLI ÇAKIŞMA KONTROLÜ
        const conflictingAppointment = await Appointment.findOne({
            $or: [
                { start_time: { $lt: endDateTime }, end_time: { $gt: startDateTime } }
            ]
        });

        if (conflictingAppointment) {
             return res.status(409).send({ 
                message: 'Üzgünüz, seçtiğiniz saat dilimi başka bir randevu ile çakışıyor. Lütfen başka bir saat seçin.' 
            });
        }
        
        // Randevuyu Kaydetme
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


// POST /api/user-appointments: Telefon numarasıyla aktif randevuları listeler (İptal ekranı için)
router.post('/user-appointments', async (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number) {
        return res.status(400).send({ message: 'Telefon numarası gereklidir.' });
    }
    
    const now = new Date();

    try {
        const user = await User.findOne({ phone_number: phone_number });
        
        if (!user) {
            return res.status(404).send({ message: 'Bu numaraya kayıtlı aktif randevu bulunmamaktadır.' });
        }

        const activeAppointments = await Appointment.find({
            user_id: user._id,
            start_time: { $gte: now } 
        }).sort({ start_time: 1 }); 

        if (activeAppointments.length === 0) {
            return res.status(404).send({ message: 'Bu numaraya kayıtlı aktif randevu bulunmamaktadır.' });
        }

        res.status(200).send({ 
            appointments: activeAppointments.map(app => ({
                id: app._id,
                time: app.start_time,
                service: app.service_type
            }))
        });

    } catch (error) {
        console.error('Kullanıcı randevuları listeleme hatası:', error);
        res.status(500).send({ message: 'Sunucu hatası oluştu.' });
    }
});


// DELETE /api/cancel-id/:id: Randevu ID'si ile randevuyu siler
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


module.exports = router;