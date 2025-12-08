// app.js - Frontend Logiği (Geliştirilmiş Sürüm)

// Elementleri seçme
const form = document.getElementById('appointment-form');
const dateInput = document.getElementById('date');
const slotListDiv = document.getElementById('slot-list');
const selectedTimeInput = document.getElementById('selected-time');
const submitButton = document.getElementById('submit-button');
const messageDiv = document.getElementById('message');
const phoneInput = document.getElementById('phone'); // Yeni eklendi

const API_BASE_URL = window.location.origin;

let selectedSlot = null;

// --- Yardımcı Fonksiyonlar ---

/**
 * Mesaj kutusunu günceller ve görünür/gizli yapar.
 * @param {string} text Gösterilecek mesaj metni.
 * @param {string} type 'success' veya 'error'.
 */
function displayMessage(text, type) {
    messageDiv.textContent = text;
    // Tailwind sınıfları güncellendi
    messageDiv.className = `p-3 rounded-lg text-center font-bold transition duration-300 ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
    messageDiv.classList.remove('hidden');
}

/**
 * Slotları listeler ve tıklama olaylarını ayarlar.
 * @param {Array<string>} slots HH:MM formatındaki saat dilimleri.
 */
function renderSlots(slots) {
    slotListDiv.innerHTML = '';
    // Yükleme sırasında eklenen ortalama sınıfını kaldır
    slotListDiv.classList.remove('justify-center'); 
    
    if (slots.length === 0) {
        slotListDiv.textContent = 'Bu tarihte boş randevu saati bulunmamaktadır.';
        submitButton.disabled = true;
        return;
    }

    slots.forEach(time => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = time;
        // Tailwind sınıfları eklendi
        button.classList.add('slot-button', 'px-4', 'py-2', 'bg-gray-200', 'text-gray-800', 'rounded-full', 'hover:bg-blue-200', 'transition', 'duration-150', 'shadow-sm');
        
        button.addEventListener('click', () => {
            // Seçili slotu güncelle
            if (selectedSlot) {
                // Seçili durumdan çıkarırken Tailwind sınıflarını ayarla
                selectedSlot.classList.remove('selected', 'bg-blue-500', 'text-white');
                selectedSlot.classList.add('bg-gray-200', 'text-gray-800');
            }
            
            selectedSlot = button;
            // Seçili duruma geçerken Tailwind sınıflarını ayarla
            selectedSlot.classList.add('selected', 'bg-blue-500', 'text-white');
            selectedSlot.classList.remove('bg-gray-200', 'text-gray-800');

            selectedTimeInput.value = time;
            submitButton.disabled = false;
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
    selectedTimeInput.value = ''; 
    submitButton.disabled = true; 
    selectedSlot = null;
    messageDiv.classList.add('hidden'); 

    if (!selectedDate) {
        slotListDiv.textContent = 'Lütfen bir tarih seçin.';
        return;
    }

    // YÜKLEME SPINNER'I EKLENDİ (Efektiflik İçin)
    slotListDiv.classList.add('justify-center');
    slotListDiv.innerHTML = `
        <div class="flex items-center space-x-2 text-blue-500">
            <svg class="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg> 
            Saatler yükleniyor, lütfen bekleyin...
        </div>`;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/slots?date=${selectedDate}`);
        const data = await response.json();

        if (response.ok) {
            renderSlots(data.slots);
        } else {
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
            form.reset(); 
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
        if (selectedTimeInput.value) {
             submitButton.disabled = false; 
        }
    }
}


// --- Olay Dinleyicileri ---

// TELEFON NUMARASI FORMATLAMA EKLENDİ (Efektiflik İçin)
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, ''); 
    let formattedValue = '';

    if (value.length > 0) {
        formattedValue += value.substring(0, 3);
    }
    if (value.length > 3) {
        formattedValue += ' ' + value.substring(3, 6);
    }
    if (value.length > 6) {
        formattedValue += ' ' + value.substring(6, 8);
    }
    if (value.length > 8) {
        formattedValue += ' ' + value.substring(8, 10);
    }

    e.target.value = formattedValue.substring(0, 12); // Max 12 karakter (555 123 45 67)
});


// Tarih değiştiğinde boş saatleri otomatik yükle
dateInput.addEventListener('change', fetchAvailableSlots);

// Form gönderildiğinde randevu işlemini başlat
form.addEventListener('submit', submitAppointment);

// Sayfa yüklendiğinde bugünün tarihinden önceki tarihleri seçimi engelle
window.addEventListener('load', () => {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
});