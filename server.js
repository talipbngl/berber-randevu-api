// server.js

const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// Middleware'ler (Uygulama Ortası Yazılımlar)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// --- MariaDB Bağlantı Ayarları (XAMPP Varsayılanları) ---
const db = mysql.createConnection({
    host: 'localhost',         // XAMPP varsayılanı
    user: 'root',              // XAMPP varsayılan kullanıcı
    password: '',              // XAMPP varsayılan parolası (boş)
    database: 'randevu_db'     // Oluşturduğumuz veritabanı adı
});

// Veritabanına Bağlanma Kontrolü
db.connect(err => {
    if (err) {
        console.error('MariaDB bağlantı hatası: ' + err.stack);
        return;
    }
    console.log('MariaDB başarıyla bağlandı, ID: ' + db.threadId);
});

// --- API Yönlendirmeleri (Routes) ---
app.use(express.static('public'));
app.get('/', (req, res) => {
    res.send('Berber Randevu API sunucusu çalışıyor!');
});
app.get('/api/slots', async (req, res) => {
    const { date } = req.query; // Query'den tarihi alıyoruz
    
    if (!date) {
        return res.status(400).send({ message: 'Tarih (date) parametresi gereklidir.' });
    }

    try {
        const dayOfWeek = new Date(date).getDay() + 1; // 1 (Pazartesi) - 7 (Pazar)

        // 1. O günün çalışma programını çekme
        const [scheduleResult] = await db.promise().query(
            'SELECT start_shift, end_shift FROM Schedules WHERE day_of_week = ? AND barber_id = 1',
            [dayOfWeek]
        );

        if (scheduleResult.length === 0) {
            return res.send({ date: date, slots: [], message: 'Bu günde dükkan kapalıdır.' });
        }

        const { start_shift, end_shift } = scheduleResult[0];
        const availableSlots = [];
        
        // Başlangıç ve bitiş saatlerini milisaniye cinsinden al
        let currentTime = new Date(`${date} ${start_shift}`);
        const endTime = new Date(`${date} ${end_shift}`);

        // 2. Olası tüm yarım saatlik dilimleri oluşturma
        while (currentTime < endTime) {
            const slotStartTime = currentTime.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            
            // Eğer dilimin bitişi çalışma saatinden sonraya taşıyorsa dur
            if (new Date(currentTime.getTime() + 30 * 60000) > endTime) break;

            availableSlots.push(slotStartTime);
            currentTime = new Date(currentTime.getTime() + 30 * 60000); // 30 dakika ekle
        }

        // 3. O gün için mevcut alınmış randevuları çekme
        const [bookedAppointments] = await db.promise().query(
            'SELECT DATE_FORMAT(start_time, "%H:%i") AS start_time_str FROM Appointments WHERE DATE(start_time) = ?',
            [date]
        );
        
        const bookedTimes = bookedAppointments.map(app => app.start_time_str);

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
app.post('/api/book', async (req, res) => {
    const { name, phone_number, date, time, service_type } = req.body;

    if (!name || !phone_number || !date || !time || !service_type) {
        return res.status(400).send({ message: 'Lütfen tüm alanları (isim, telefon, tarih, saat, hizmet türü) doldurun.' });
    }

    // Randevu başlangıç zamanını ve bitiş zamanını hesaplama
    const startDateTime = `${date} ${time}:00`;
    
    // Randevu süresi 30 dakika olduğu için bitiş zamanını hesaplayalım
    const [hour, minute] = time.split(':').map(Number);
    const startMoment = new Date(date);
    startMoment.setHours(hour, minute, 0, 0); // Başlangıcı ayarla
    
    // 30 dakika ekle
    const endMoment = new Date(startMoment.getTime() + 30 * 60000); 
    const endDateTime = `${date} ${endMoment.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`;
    
    // Veritabanı işlemleri (Transactions) ile çakışmayı kontrol etme ve kaydetme
    try {
        // 1. Kullanıcıyı bul veya oluştur
        let userId;
        
        // Telefon numarasına göre kullanıcıyı arıyoruz
        const [userResult] = await db.promise().query(
            'SELECT user_id FROM Users WHERE phone_number = ?',
            [phone_number]
        );

        if (userResult.length > 0) {
            userId = userResult[0].user_id;
        } else {
            // Yeni kullanıcı oluşturma
            const [insertUserResult] = await db.promise().query(
                'INSERT INTO Users (name, phone_number) VALUES (?, ?)',
                [name, phone_number]
            );
            userId = insertUserResult.insertId;
        }

        // 2. Randevu Çakışma Kontrolü (Aynı saatte başka randevu var mı?)
        // Bu sorgu, randevular tablosundaki 'start_time' sütununun UNIQUE olması nedeniyle zaten koruma sağlar.
        // Ancak biz ek olarak okunabilirlik ve özel bir hata mesajı için manuel kontrol yapalım.
        const [conflictCheck] = await db.promise().query(
            'SELECT appointment_id FROM Appointments WHERE start_time = ?',
            [startDateTime]
        );

        if (conflictCheck.length > 0) {
            return res.status(409).send({ 
                message: 'Üzgünüz, seçtiğiniz randevu saati kısa süre önce dolmuştur. Lütfen başka bir saat seçin.' 
            });
        }
        
        // 3. Randevuyu Kaydetme
        const [insertAppointmentResult] = await db.promise().query(
            'INSERT INTO Appointments (user_id, start_time, end_time, service_type) VALUES (?, ?, ?, ?)',
            [userId, startDateTime, endDateTime, service_type]
        );

        res.status(201).send({
            message: 'Randevunuz başarıyla oluşturuldu.',
            appointment_id: insertAppointmentResult.insertId,
            booked_time: startDateTime
        });

    } catch (error) {
        console.error('Randevu kaydı sırasında hata:', error);
        
        // Veritabanı hata kodu 1062 (Duplicate entry - Tekrarlanan giriş) özel olarak ele alınabilir.
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).send({ 
                message: 'Bu saat dilimi zaten dolu, çakışma hatası.' 
            });
        }
        
        res.status(500).send({ message: 'Sunucu hatası oluştu, randevu kaydedilemedi.' });
    }
});

// Sunucuyu Başlatma
app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor...`);
});