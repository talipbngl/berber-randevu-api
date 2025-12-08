// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000; 


const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone_number: { type: String, required: true, unique: true },
});
const User = mongoose.model('User', UserSchema);


const AppointmentSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    start_time: { type: Date, required: true, unique: true }, // Randevu saati tek olmalı
    end_time: { type: Date, required: true },
    service_type: { type: String, required: true },
});
const Appointment = mongoose.model('Appointment', AppointmentSchema);

// Çalışma Saatleri Şeması (Schedules tablosunun karşılığı)
// MySQL'deki sorgularınızı basitleştirmek için bunu da dahil ediyoruz.
const ScheduleSchema = new mongoose.Schema({
    day_of_week: { type: Number, required: true, min: 1, max: 7 }, // 1-Pazartesi, 7-Pazar
    barber_id: { type: Number, default: 1 },
    start_shift: { type: String, required: true }, // Örn: "09:00"
    end_shift: { type: String, required: true },   // Örn: "18:00"
});
const Schedule = mongoose.model('Schedule', ScheduleSchema);


// *** 2. MongoDB Bağlantısı ***
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('HATA: MONGODB_URI ortam değişkeni tanımlanmamış. Bağlantı yapılamıyor.');
    // Bu, Render'da MONGODB_URI değerini ayarlamadıysanız ortaya çıkar.
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB bağlantısı başarılı!'))
  .catch(err => {
    console.error('❌ MongoDB bağlantı hatası:', err.message);
    // Bağlantı başarısız olursa sunucunun başlamasını durdurabiliriz
    // process.exit(1); 
  });

// --- Middleware'ler ---
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- API Yönlendirmeleri (Routes) ve Sorgu Değişiklikleri ---

app.use(express.static('public'));
app.get('/', (req, res) => {
    res.send('Berber Randevu API sunucusu çalışıyor!');
});

// GET /api/slots: Boş randevu saatlerini çekme (MySQL sorguları Mongoose ile değiştirildi)
app.get('/api/slots', async (req, res) => {
    const { date } = req.query; 
    
    if (!date) {
        return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });
    }

    try {
        const queryDate = new Date(date);
        // getDay() 0 (Pazar) - 6 (Cumartesi) döndürür. MySQL'deki 1-7'ye uydurmak için:
        // Pazartesi'yi 1, Pazar'ı 7 yapalım.
        const dayOfWeek = (queryDate.getDay() === 0) ? 7 : queryDate.getDay(); 

        // 1. O günün çalışma programını çekme (MySQL sorgusu yerine Mongoose find)
        const scheduleResult = await Schedule.findOne({ 
            day_of_week: dayOfWeek, 
            barber_id: 1 
        });

        if (!scheduleResult) {
            return res.send({ date: date, slots: [], message: 'Bu günde dükkan kapalıdır.' });
        }

        const { start_shift, end_shift } = scheduleResult;
        const availableSlots = [];
        
        let currentTime = new Date(`${date} ${start_shift}`);
        const endTime = new Date(`${date} ${end_shift}`);

        // 2. Olası tüm yarım saatlik dilimleri oluşturma (Mantık aynı kaldı)
        while (currentTime < endTime) {
            const slotStartTime = currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            if (new Date(currentTime.getTime() + 30 * 60000) > endTime) break;

            availableSlots.push(slotStartTime);
            currentTime = new Date(currentTime.getTime() + 30 * 60000); 
        }

        // 3. O gün için mevcut alınmış randevuları çekme (MySQL sorgusu yerine Mongoose find)
        // MongoDB'de tarih sorgulama biraz farklıdır (gte / lt kullanılır)
        const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

        const bookedAppointments = await Appointment.find({
            start_time: { $gte: startOfDay, $lte: endOfDay }
        });
        
        // Randevu saatlerini HH:MM formatına çevirme
        const bookedTimes = bookedAppointments.map(app => 
            app.start_time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
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

// POST /api/book: Randevu kaydetme (MySQL sorguları Mongoose ile değiştirildi)
app.post('/api/book', async (req, res) => {
    const { name, phone_number, date, time, service_type } = req.body;

    if (!name || !phone_number || !date || !time || !service_type) {
        return res.status(400).send({ message: 'Lütfen tüm alanları doldurun.' });
    }

    const [hour, minute] = time.split(':').map(Number);
    const startDateTime = new Date(date);
    startDateTime.setHours(hour, minute, 0, 0); 
    
    // 30 dakika ekle
    const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); 
    
    try {
        // 1. Kullanıcıyı bul veya oluştur (Mongoose upsert/find)
        let user = await User.findOneAndUpdate(
            { phone_number: phone_number }, // Bu telefonda kullanıcı var mı?
            { name: name },                 // Varsa adını güncelle
            { new: true, upsert: true, setDefaultsOnInsert: true } // Yoksa oluştur
        );
        let userId = user._id;

        // 2. Randevu Çakışma Kontrolü ve Kaydetme
        // Mongoose'un `unique: true` kısıtlaması, çakışmayı otomatik yakalar.
        const newAppointment = new Appointment({
            user_id: userId,
            start_time: startDateTime,
            end_time: endDateTime,
            service_type: service_type,
        });

        await newAppointment.save(); // Kaydetme işlemi, çakışma olursa hata fırlatır.

        res.status(201).send({
            message: 'Randevunuz başarıyla oluşturuldu.',
            appointment_id: newAppointment._id,
            booked_time: startDateTime.toISOString()
        });

    } catch (error) {
        console.error('Randevu kaydı sırasında hata:', error);
        
        // MongoDB hata kodu 11000 (Duplicate Key Error - Çakışma)
        if (error.code === 11000) {
            return res.status(409).send({ 
                message: 'Üzgünüz, seçtiğiniz randevu saati kısa süre önce dolmuştur. Lütfen başka bir saat seçin.' 
            });
        }
        
        res.status(500).send({ message: 'Sunucu hatası oluştu, randevu kaydedilemedi.' });
    }
});


// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});