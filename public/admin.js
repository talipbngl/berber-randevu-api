// admin.js - Yönetim Paneli Logiği (Nihai ve Hata Düzeltmeli Sürüm)

document.addEventListener('DOMContentLoaded', () => {

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
    const listMessage = document.getElementById('list-message'); // Yeni eklenen hata mesajı

    let adminPass = null; 

    // KRİTİK KONTROL: Eğer temel elementler eksikse, uyarı verip dur
    if (!authForm || !adminContent || !authSection || !scheduleForm) {
        console.error("KRİTİK HATA: admin.html dosyası tam olarak yüklenmedi veya ID'ler eksik. admin.js çalıştırılamıyor.");
        return; // Kodun daha fazla çalışmasını durdur
    }

    // --- YARDIMCI FONKSİYONLAR ---

    function formatDateTime(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleTimeString('tr-TR', options);
    }
    function getStatusStyle(status) {
    switch (status) {
        case 'Completed':
            return 'bg-green-100 text-green-800';
        case 'Canceled':
            return 'bg-red-100 text-red-800';
        case 'Pending':
        default:
            return 'bg-yellow-100 text-yellow-800';
    }
}

// Durum etiketini (Pending -> Beklemede gibi) çevirir
function translateStatus(status) {
    switch (status) {
        case 'Completed':
            return 'Tamamlandı';
        case 'Canceled':
            return 'İptal Edildi';
        case 'Pending':
        default:
            return 'Beklemede';
    }
}

    // --- API FONKSİYONLARI ---
    async function handleStatusUpdate(id, newStatus, button) {
    if (!adminPass) {
        alert("Yetkiniz sona ermiş veya parola eksik. Lütfen sayfayı yenileyin.");
        return;
    }
    
    // Yükleme sırasında butonu pasif yap
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '...';

    const url = `${API_BASE_URL}/api/admin/appointment/${id}?pass=${adminPass}`;
    
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (response.ok) {
            // Başarılı güncelleme sonrası Frontend'i anında güncelle
            const statusLabel = document.getElementById(`status-label-${id}`);
            const translatedStatus = translateStatus(data.appointment.status);
            const statusStyle = getStatusStyle(data.appointment.status);
            
            statusLabel.className = `inline-flex px-3 text-xs font-semibold leading-5 rounded-full ${statusStyle}`;
            statusLabel.textContent = translatedStatus;

            // Eylem butonlarını kaldır
            document.getElementById(`actions-${id}`).innerHTML = `<span class="text-gray-500 text-xs">İşlem Yapıldı</span>`;
            
            alert(`Randevu durumu başarıyla ${translatedStatus} olarak güncellendi.`);
        } else {
            alert(data.message || 'Durum güncelleme başarısız oldu.');
        }

    } catch (error) {
        console.error('Durum Güncelleme API Çağrısı Hatası:', error);
        alert('Ağ hatası oluştu, durum güncellenemedi.');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

    async function fetchAppointments(password) {
        listMessage.textContent = 'Randevular yükleniyor...';
        const url = `${API_BASE_URL}/api/admin/appointments?pass=${password}`;
        
        try {
            const response = await fetch(url);
            const data = await response.json();

            if (response.status === 401) {
                // Parola yanlış girilmiş, oturum sonlanmış veya yetki kalkmış
                authSection.classList.remove('hidden');
                adminContent.classList.add('hidden');
                authMessage.textContent = "Hata: Oturumunuz sonlandı veya parola yanlış. Lütfen tekrar deneyin.";
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || 'Randevular yüklenirken bir hata oluştu.');
            }

            renderAppointments(data.appointments);
            randevuSayisi.textContent = `Toplam Randevu Sayısı: ${data.count}`;
            listMessage.textContent = ''; // Başarılı yükleme

        } catch (error) {
            console.error('Randevu Çekme Hatası:', error);
            listMessage.textContent = 'Sunucuya ulaşılamıyor veya randevu verileri çekilemiyor.';
        }
    }

    // admin.js -> renderAppointments fonksiyonu

function renderAppointments(appointments) {
    appointmentsBody.innerHTML = '';
    
    if (appointments.length === 0) {
        appointmentsBody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Henüz kayıtlı randevu bulunmamaktadır.</td></tr>';
        return;
    }

    appointments.forEach(app => {
        const row = appointmentsBody.insertRow();
        row.className = 'hover:bg-gray-50';
        row.id = `appointment-${app._id}`; // Güncelleme sonrası DOM elementini bulmak için ID ekliyoruz
        
        // Mevcut durum stilini ve çevirisini al
        const statusStyle = getStatusStyle(app.status);
        const translatedStatus = translateStatus(app.status);

        // Randevu 5 saatten daha eskiyse tamamlanma butonunu pasif yap
        const isPastAndPending = app.status === 'Pending' && (new Date(app.start_time) < new Date(Date.now() - 5 * 3600000));
        
        // Eylem butonlarını oluştur
        let actionButtons = '';
        if (app.status === 'Pending') {
            actionButtons = `
                <button type="button" data-id="${app._id}" data-status="Completed" class="update-status-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-xs rounded transition duration-100 shadow-sm" ${isPastAndPending ? 'disabled' : ''}>
                    Tamamla
                </button>
                <button type="button" data-id="${app._id}" data-status="Canceled" class="update-status-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs rounded transition duration-100 ml-2 shadow-sm">
                    İptal Et
                </button>
            `;
        } else {
             actionButtons = `<span class="text-gray-500 text-xs">İşlem Yapıldı</span>`;
        }

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${formatDateTime(app.start_time)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.user_id ? app.user_id.name : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.user_id ? app.user_id.phone_number : 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${app.service_type}</td>
            
            <td class="px-6 py-4 whitespace-nowrap">
                <span id="status-label-${app._id}" class="inline-flex px-3 text-xs font-semibold leading-5 rounded-full ${statusStyle}">
                    ${translatedStatus}
                </span>
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" id="actions-${app._id}">
                ${actionButtons}
            </td>
            
            <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-400">${app._id}</td>
        `;
    });
}

    // --- OLAY DİNLEYİCİLERİ ---

    // 1. PAROLA KONTROLÜ
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Sayfanın yenilenmesini engelleyen KRİTİK adım
        
        const passInput = document.getElementById('admin-pass');
        const password = passInput.value.trim();
        
        authMessage.textContent = 'Kontrol ediliyor...';
        
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
                authMessage.textContent = `Giriş başarısız oldu. Sunucu hatası (${response.status}).`;
            }

        } catch (error) {
            authMessage.textContent = "Ağ bağlantı hatası. Sunucuya ulaşılamıyor.";
        }
    });
    appointmentsBody.addEventListener('click', (e) => {
    const targetButton = e.target.closest('.update-status-btn');

    if (targetButton) {
        const id = targetButton.getAttribute('data-id');
        const newStatus = targetButton.getAttribute('data-status');
        
        let confirmationMessage = `Randevuyu "${translateStatus(newStatus)}" olarak işaretlemek istediğinizden emin misiniz?`;
        
        if (confirm(confirmationMessage)) {
            handleStatusUpdate(id, newStatus, targetButton);
        }
    }
});

    // 2. ÇALIŞMA SAATİ GÜNCELLEME
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!adminPass) {
             scheduleMessage.className = 'mt-3 font-semibold text-red-600';
             scheduleMessage.textContent = 'Oturum sona ermiş. Lütfen sayfayı yenileyip tekrar giriş yapın.';
             return;
        }

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
});