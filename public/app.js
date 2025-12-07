// server.js - PostgreSQL ve Render Uyumlu Sürüm

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
// Render, otomatik olarak bir PORT atar. Lokal test için 3000 kullanılır.
const PORT = process.env.PORT || 3000;

// PostgreSQL Bağlantısı
// DATABASE_URL: Render'da otomatik olarak atanacak bağlantı dizesi
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/randevu_db';

const pool = new Pool({
    connectionString: connectionString,
    // Render'da SSL/TLS kullanılması gerekebilir (Canlıya alırken).
    // Local test için bu satırı yorum satırına alabilirsiniz.
    ssl: {
        rejectUnauthorized: false
    }
});

// Veritabanına Bağlanma Kontrolü (PostgreSQL)
pool.connect((err, client, done) => {
    if (err) {
        console.error('PostgreSQL bağlantı hatası:', err.stack);
        return;
    }
    console.log('PostgreSQL başarıyla bağlandı.');
    done(); 
});


// Middleware'ler (Uygulama Ortası Yazılımlar)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Statik dosyaları (HTML, CSS, JS) 'public' klasöründen sunar
app.use(express.static('public'));


// ----------------------------------------------------------------------
// API Yönlendirmeleri (Routes)
// ----------------------------------------------------------------------


/**
 * Boş randevu saatlerini döndürür.
 * Parametre: date (YYYY-MM-DD formatında)
 * Örnek: https://yoursite.onrender.com/api/slots?date=2025-12-10
 */
app.get('/api/slots', async (req, res) => {
    const { date } = req.query; // Query'den tarihi alıyoruz
    
    if (!date) {
        return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });
    }

    try {
        // Javascript'te 0=Pazar, 1=Pazartesi. PostgreSQL'de 1=Pazartesi, 7=Pazar için düzeltme yapıldı.
        const jsDay = new Date(date).getDay();
        const pgDayOfWeek = jsDay === 0 ? 7 : jsDay; 

        // 1. O günün çalışma programını çekme (PostgreSQL $1 formatı)
        const scheduleQueryResult = await pool.query(
            'SELECT start_shift, end_shift FROM Schedules WHERE day_of_week = $1 AND barber_id = 1',
            [pgDayOfWeek]
        );
        const scheduleResult = scheduleQueryResult.rows; // PostgreSQL sonuçları .rows altında gelir

        if (scheduleResult.length === 0) {
            return res.send({ date: date, slots: [], message: 'Bu günde dükkan kapalıdır.' });
        }

        const { start_shift, end_shift } = scheduleResult[0];
        const availableSlots = [];
        
        let currentTime = new Date(`${date} ${start_shift}`);
        const endTime = new Date(`${date} ${end_shift}`);

        // 2. Olası tüm yarım saatlik dilimleri oluşturma
        while (currentTime < endTime) {
            const slotStartTime = currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            if (new Date(currentTime.getTime() + 30 * 60000) > endTime) break;

            availableSlots.push(slotStartTime);
            currentTime = new Date(currentTime.getTime() + 30 * 60000); // 30 dakika ekle
        }

        // 3. O gün için mevcut alınmış randevuları çekme
        // PostgreSQL'de date formatlama biraz farklıdır.
        const bookedAppointmentsQuery = await pool.query(
            'SELECT TO_CHAR(start_time, \'HH24:MI\') AS start_time_str FROM Appointments WHERE DATE(start_time) = $1',
            [date]
        );
        
        const bookedTimes = bookedAppointmentsQuery.rows.map(app => app.start_time_str);

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


/**
 * Yeni randevu kaydeder (POST /api/book)
 */
app.post('/api/book', async (req, res) => {
    const { name, phone_number, date, time, service_type } = req.body;

    if (!name || !phone_number || !date || !time || !service_type) {
        return res.status(400).send({ message: 'Lütfen tüm alanları doldurun.' });
    }

    const startDateTime = `${date} ${time}:00`;
    
    // Randevu süresi 30 dakika olduğu için bitiş zamanını hesaplama
    const [hour, minute] = time.split(':').map(Number);
    const startMoment = new Date(date);
    startMoment.setHours(hour, minute, 0, 0); 
    const endMoment = new Date(startMoment.getTime() + 30 * 60000); 
    const endDateTime = `${date} ${endMoment.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    
    
    try {
        // 1. Kullanıcıyı bul veya oluştur
        let userId;
        
        const userQueryResult = await pool.query(
            'SELECT user_id FROM Users WHERE phone_number = $1',
            [phone_number]
        );
        const userResult = userQueryResult.rows;

        if (userResult.length > 0) {
            userId = userResult[0].user_id;
        } else {
            // Yeni kullanıcı oluşturma (PostgreSQL'de RETURNING kullanılır)
            const insertUserResult = await pool.query(
                'INSERT INTO Users (name, phone_number) VALUES ($1, $2) RETURNING user_id',
                [name, phone_number]
            );
            userId = insertUserResult.rows[0].user_id;
        }

        // 2. Randevu Çakışma Kontrolü (Aynı saatte başka randevu var mı?)
        // Bu sorgu, UNIQUE kısıtlamasına rağmen okunabilirlik için yapılır.
        const conflictCheck = await pool.query(
            'SELECT appointment_id FROM Appointments WHERE start_time = $1',
            [startDateTime]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).send({ 
                message: 'Üzgünüz, seçtiğiniz randevu saati kısa süre önce dolmuştur.' 
            });
        }
        
        // 3. Randevuyu Kaydetme
        const insertAppointmentResult = await pool.query(
            'INSERT INTO Appointments (user_id, start_time, end_time, service_type) VALUES ($1, $2, $3, $4) RETURNING appointment_id',
            [userId, startDateTime, endDateTime, service_type]
        );

        res.status(201).send({
            message: 'Randevunuz başarıyla oluşturuldu.',
            appointment_id: insertAppointmentResult.rows[0].appointment_id,
            booked_time: startDateTime
        });

    } catch (error) {
        console.error('Randevu kaydı sırasında hata:', error);
        
        // PostgreSQL hata kodu 23505 (unique_violation) özel olarak ele alınabilir.
        if (error.code === '23505') {
             return res.status(409).send({ 
                message: 'Bu saat dilimi zaten dolu, çakışma hatası.' 
            });
        }
        
        res.status(500).send({ message: 'Sunucu hatası oluştu, randevu kaydedilemedi.' });
    }
});


// Ana sayfayı (index.html) gösterme (express.static ile zaten sunuluyor)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});