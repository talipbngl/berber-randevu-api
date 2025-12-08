// app.js - Frontend Logiği

// Elementleri seçme
const form = document.getElementById('appointment-form');
const dateInput = document.getElementById('date');
const slotListDiv = document.getElementById('slot-list');
const selectedTimeInput = document.getElementById('selected-time');
const submitButton = document.getElementById('submit-button');
const messageDiv = document.getElementById('message');

const API_BASE_URL = window.location.origin; // Render'daki canlı URL'yi kullanır

let selectedSlot = null;

// --- Yardımcı Fonksiyonlar ---

/**
 * Mesaj kutusunu günceller ve görünür/gizli yapar.
 * @param {string} text Gösterilecek mesaj metni.
 * @param {string} type 'success' veya 'error'.
 */
function displayMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `p-3 rounded-lg text-center font-bold transition duration-300 ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    messageDiv.classList.remove('hidden');
}

/**
 * Slotları listeler ve tıklama olaylarını ayarlar.
 * @param {Array<string>} slots HH:MM formatındaki saat dilimleri.
 */
function renderSlots(slots) {
    slotListDiv.innerHTML = '';
    
    if (slots.length === 0) {
        slotListDiv.textContent = 'Bu tarihte boş randevu saati bulunmamaktadır.';
        submitButton.disabled = true;
        return;
    }

    slots.forEach(time => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = time;
        button.classList.add('slot-button', 'px-4', 'py-2', 'bg-gray-200', 'text-gray-800', 'rounded-full', 'hover:bg-blue-200', 'transition', 'duration-150');
        
        button.addEventListener('click', () => {
            // Seçili slotu güncelle
            if (selectedSlot) {
                selectedSlot.classList.remove('selected', 'bg-blue-500', 'text-white');
                selectedSlot.classList.add('bg-gray-200');
            }
            
            selectedSlot = button;
            selectedSlot.classList.add('selected', 'bg-blue-500', 'text-white');
            selectedSlot.classList.remove('bg-gray-200');

            selectedTimeInput.value = time;
            submitButton.disabled = false; // Saat seçildi, butonu aktif et
        });

        slotListDiv.appendChild(button);
    });

    submitButton.disabled = !selectedSlot;
}


// --- API Fonksiyonları ---

/**
 * Seçilen tarihe ait boş saat dilimlerini backend'den çeker.
 */
async function fetchAvailableSlots() {
    const selectedDate = dateInput.value;
    selectedTimeInput.value = ''; // Yeni tarih seçildi, saati sıfırla
    submitButton.disabled = true; // Yeni tarih seçildi, butonu devre dışı bırak
    selectedSlot = null;
    messageDiv.classList.add('hidden'); // Mesajı gizle

    if (!selectedDate) {
        slotListDiv.textContent = 'Lütfen bir tarih seçin.';
        return;
    }

    slotListDiv.textContent = 'Saatler yükleniyor...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/slots?date=${selectedDate}`);
        const data = await response.json();

        if (response.ok) {
            renderSlots(data.slots);
        } else {
            // Sunucu tarafında hata (400, 500 vb.)
            slotListDiv.textContent = data.message || 'Saatler yüklenirken bir sorun oluştu.';
        }
    } catch (error) {
        console.error('API Çağrı Hatası:', error);
        slotListDiv.textContent = 'Sunucuya erişilemiyor veya ağ hatası var.';
    }
}

/**
 * Randevu alma işlemini backend'e gönderir.
 */
async function submitAppointment(event) {
    event.preventDefault();

    if (!selectedTimeInput.value) {
        displayMessage('Lütfen boş bir saat seçiniz.', 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Randevu Alınıyor...';

    const appointmentData = {
        name: document.getElementById('name').value,
        phone_number: document.getElementById('phone').value.replace(/\s/g, ''), // Boşlukları kaldır
        date: dateInput.value,
        time: selectedTimeInput.value,
        service_type: document.getElementById('service').value,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(appointmentData),
        });

        const data = await response.json();

        if (response.ok) {
            // Başarılı Randevu
            displayMessage(`Randevunuz başarıyla oluşturuldu! Saat: ${appointmentData.time}`, 'success');
            form.reset(); // Formu sıfırla
            selectedSlot = null;
            slotListDiv.textContent = 'Randevu alındı. Yeni randevu için tarih seçin.';
        } else {
            // Hata Durumları (400, 409, 500)
            displayMessage(data.message || 'Randevu alınırken beklenmedik bir hata oluştu.', 'error');
        }
    } catch (error) {
        console.error('API Randevu Gönderme Hatası:', error);
        displayMessage('Ağ hatası: Sunucuya ulaşılamadı.', 'error');
    } finally {
        submitButton.textContent = 'Randevuyu Tamamla';
        // Hata durumunda yeniden denemeye izin vermek için butonu aktif et
        if (selectedTimeInput.value) {
             submitButton.disabled = false; 
        }
    }
}


// --- Olay Dinleyicileri ---

// Tarih değiştiğinde boş saatleri otomatik yükle
dateInput.addEventListener('change', fetchAvailableSlots);

// Form gönderildiğinde randevu işlemini başlat
form.addEventListener('submit', submitAppointment);

// Sayfa yüklendiğinde bugünün tarihinden önceki tarihleri seçimi engelle
window.addEventListener('load', () => {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
});