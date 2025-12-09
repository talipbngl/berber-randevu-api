// admin.js - Yönetim Paneli Logiği

const API_BASE_URL = window.location.origin;

// Elementler
const authForm = document.getElementById('auth-form');
const adminContent = document.getElementById('admin-content');
const authSection = document.getElementById('auth-section');
const authMessage = document.getElementById('auth-message');
const appointmentsBody = document.getElementById('appointments-body');
const scheduleForm = document.getElementById('schedule-form');
const scheduleMessage = document.getElementById('schedule-message');
const randevuSayisi = document.getElementById('randevu-sayisi');

let adminPass = null; // Başarılı girişte parolayı tutacağız

// --- YARDIMCI FONKSİYONLAR ---

function formatDateTime(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleTimeString('tr-TR', options);
}

// --- API FONKSİYONLARI ---

async function fetchAppointments(password) {
    const url = `${API_BASE_URL}/api/admin/appointments?pass=${password}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.status === 401) {
            authMessage.textContent = "Hatalı parola. Lütfen tekrar deneyin.";
            return;
        }

        if (!response.ok) {
            throw new Error(data.message || 'Randevular yüklenirken bir hata oluştu.');
        }

        renderAppointments(data.appointments);
        randevuSayisi.textContent = `Toplam Randevu Sayısı: ${data.count}`;
        
    } catch (error) {
        console.error('Randevu Çekme Hatası:', error);
        document.getElementById('list-message').textContent = 'Randevu verileri çekilemiyor.';
    }
}

function renderAppointments(appointments) {
    appointmentsBody.innerHTML = '';
    
    if (appointments.length === 0) {
        appointmentsBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Henüz kayıtlı randevu bulunmamaktadır.</td></tr>';
        return;
    }

    appointments.forEach(app => {
        const row = appointmentsBody.insertRow();
        row.className = 'hover:bg-gray-50';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formatDateTime(app.start_time)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.user_id.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.user_id.phone_number}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.service_type}</td>
            <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-400">${app._id}</td>
        `;
    });
}

// --- OLAY DİNLEYİCİLERİ ---

// 1. PAROLA KONTROLÜ
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passInput = document.getElementById('admin-pass');
    const password = passInput.value.trim();
    
    authMessage.textContent = 'Kontrol ediliyor...';
    
    // Geçici olarak parolayı kontrol etmek için bir rotayı kullanıyoruz
    const testUrl = `${API_BASE_URL}/api/admin/appointments?pass=${password}`;

    try {
        const response = await fetch(testUrl);
        
        if (response.status === 401) {
            authMessage.textContent = "Hatalı parola. Lütfen tekrar deneyin.";
            passInput.value = '';
            return;
        }

        if (response.ok) {
            adminPass = password; // Parolayı sakla
            authSection.classList.add('hidden');
            adminContent.classList.remove('hidden');
            fetchAppointments(adminPass); // Randevuları yükle
        } else {
             authMessage.textContent = "Giriş başarısız oldu. Sunucu hatası.";
        }

    } catch (error) {
        authMessage.textContent = "Ağ bağlantı hatası. Sunucuya ulaşılamıyor.";
    }
});

// 2. ÇALIŞMA SAATİ GÜNCELLEME
scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!adminPass) return;

    const day = document.getElementById('day').value;
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;

    scheduleMessage.textContent = 'Güncelleniyor...';
    
    const url = `${API_BASE_URL}/api/admin/schedule?pass=${adminPass}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ day_of_week: day, start_shift: start, end_shift: end })
        });

        const data = await response.json();

        if (response.ok) {
            scheduleMessage.className = 'mt-3 font-semibold text-green-600';
            scheduleMessage.textContent = `✅ ${data.message} (${data.schedule.day_of_week}. gün)`;
        } else {
            scheduleMessage.className = 'mt-3 font-semibold text-red-600';
            scheduleMessage.textContent = `Hata: ${data.message}`;
        }

    } catch (error) {
        scheduleMessage.className = 'mt-3 font-semibold text-red-600';
        scheduleMessage.textContent = 'Ağ hatası. Çalışma saatleri güncellenemedi.';
    }
});