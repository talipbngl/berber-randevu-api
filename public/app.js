// app.js - Frontend Logiği (Nihai Sürüm)

// Elementleri seçme
const form = document.getElementById('appointment-form');
const dateInput = document.getElementById('date');
const slotListDiv = document.getElementById('slot-list');
const selectedTimeInput = document.getElementById('selected-time');
const submitButton = document.getElementById('submit-button');
const messageDiv = document.getElementById('message');
const phoneInput = document.getElementById('phone');

const API_BASE_URL = window.location.origin;

let selectedSlot = null;

// --- Yardımcı Fonksiyonlar ---

function displayMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `p-4 rounded-xl text-center font-extrabold transition duration-300 ${type === 'success' ? 'bg-green-100 text-green-700 shadow-lg' : 'bg-red-100 text-red-700 shadow-lg'}`;
    messageDiv.classList.remove('hidden');
}

/**
 * Slotları listeler ve tıklama olaylarını ayarlar.
 */
function renderSlots(slots) {
    slotListDiv.innerHTML = '';
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
        // Tailwind sınıfları (Yeni HTML ile uyumlu)
        button.classList.add('slot-button', 'px-4', 'py-2', 'bg-gray-200', 'text-gray-800', 'rounded-full', 'hover:bg-blue-200', 'transition', 'duration-150', 'shadow-sm');
        
        button.addEventListener('click', () => {
            // Seçili slotu güncelle
            if (selectedSlot) {
                selectedSlot.classList.remove('selected', 'bg-blue-500', 'text-white');
                selectedSlot.classList.add('bg-gray-200', 'text-gray-800');
            }
            
            selectedSlot = button;
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

    // YÜKLEME SPINNER'I (Efektiflik)
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

async function submitAppointment(event) {
    event.preventDefault();

    if (!selectedTimeInput.value) {
        displayMessage('Lütfen boş bir saat seçiniz.', 'error');
        return;
    }
    
    // Telefon numarasını sadece sayılardan oluşan 10 haneli formatta alır
    const rawPhoneNumber = document.getElementById('phone').value.replace(/\s/g, '').replace('+', '').replace('90', '');
    
    // YENİ +90 ZORUNLULUĞU KONTROLÜ
    // Numara 10 hane değilse veya 5 ile başlamıyorsa reddet
    if (rawPhoneNumber.length !== 10 || !rawPhoneNumber.startsWith('5')) {
        displayMessage('Lütfen geçerli, 10 haneli bir Türk mobil numarası (5XX XXX XX XX) girin.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = 'Randevuyu Hemen Onayla';
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Randevu Alınıyor...';

    const appointmentData = {
        name: document.getElementById('name').value,
        phone_number: '+90' + rawPhoneNumber, // Backend'e her zaman +90 ile gönderilir
        date: dateInput.value,
        time: selectedTimeInput.value,
        service_type: document.getElementById('service').value,
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(appointmentData),
        });

        const data = await response.json();

        if (response.ok) {
            displayMessage(`Randevunuz başarıyla oluşturuldu! Saat: ${appointmentData.time}`, 'success');
            form.reset(); 
            selectedSlot = null;
            slotListDiv.textContent = 'Randevu alındı. Yeni randevu için tarih seçin.';
        } else {
            displayMessage(data.message || 'Randevu alınırken beklenmedik bir hata oluştu.', 'error');
        }
    } catch (error) {
        console.error('API Randevu Gönderme Hatası:', error);
        displayMessage('Ağ hatası: Sunucuya ulaşılamadı.', 'error');
    } finally {
        submitButton.textContent = 'Randevuyu Hemen Onayla';
        if (selectedTimeInput.value) {
             submitButton.disabled = false; 
        }
    }
}


// --- Olay Dinleyicileri ---

// TELEFON NUMARASI FORMATLAMA (UX Geliştirmesi)
const formatPhoneNumber = (value) => {
    let cleaned = ('' + value).replace(/\D/g, '');

    // Başında 90 veya 0 varsa sil
    if (cleaned.startsWith('90')) { cleaned = cleaned.substring(2); } 
    else if (cleaned.startsWith('0')) { cleaned = cleaned.substring(1); }
    
    cleaned = cleaned.substring(0, 10);

    let formattedValue = '';
    if (cleaned.length > 0) { formattedValue += cleaned.substring(0, 3); }
    if (cleaned.length > 3) { formattedValue += ' ' + cleaned.substring(3, 6); }
    if (cleaned.length > 6) { formattedValue += ' ' + cleaned.substring(6, 8); }
    if (cleaned.length > 8) { formattedValue += ' ' + cleaned.substring(8, 10); }
    
    return formattedValue;
};

// Kullanıcı girişi sırasında formatlama
phoneInput.addEventListener('input', (e) => {
    e.target.value = formatPhoneNumber(e.target.value);
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