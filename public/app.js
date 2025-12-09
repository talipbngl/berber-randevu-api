// app.js - Frontend Logiği (Adım Adım Yapıya Uyumlu Nihai Sürüm)

// --- Elementler ---
const form = document.getElementById('appointment-form');
const dateInput = document.getElementById('date');
const slotListDiv = document.getElementById('slot-list');
const selectedTimeInput = document.getElementById('selected-time');
const phoneInput = document.getElementById('phone');
const messageDiv = document.getElementById('message');
const submitButton = document.getElementById('submit-button');

// Adım Geçiş Butonları
const nextStep1Button = document.getElementById('next-step-1');
const nextStep2Button = document.getElementById('next-step-2');
const prevStep2Button = document.getElementById('prev-step-2');
const prevStep3Button = document.getElementById('prev-step-3');

const API_BASE_URL = window.location.origin;
let selectedSlot = null;
let currentStep = 1;

// --- Step Logic ---
function updateStep(step) {
    currentStep = step;
    
    // İçerik görünürlüğünü yönetme
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}-content`).classList.remove('hidden');

    // Göstergeleri (Circles) yönetme
    document.querySelectorAll('[id^="step-"]').forEach(el => {
        el.classList.remove('bg-primary', 'text-white', 'bg-gray-300', 'text-gray-600');
        el.classList.add('bg-gray-300', 'text-gray-600');
    });

    for (let i = 1; i <= step; i++) {
        const circle = document.getElementById(`step-${i}-circle`);
        circle.classList.remove('bg-gray-300', 'text-gray-600');
        circle.classList.add('bg-primary', 'text-white');
    }

    messageDiv.classList.add('hidden'); // Yeni adıma geçerken mesajı gizle
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Sayfanın başına kaydır
}

function validateStep2() {
    const name = document.getElementById('name').value;
    const phone = phoneInput.value;
    const service = document.getElementById('service').value;

    const rawPhoneNumber = phone.replace(/\s/g, '').replace('+', '').replace('90', '');

    if (!name || rawPhoneNumber.length !== 10 || !rawPhoneNumber.startsWith('5') || !service) {
        displayMessage('Lütfen tüm alanları doldurun ve geçerli bir telefon numarası girin.', 'error');
        return false;
    }
    return true;
}

function populateSummary() {
    const name = document.getElementById('name').value;
    const phone = phoneInput.value;
    const service = document.getElementById('service').value;
    const date = dateInput.value;
    const time = selectedTimeInput.value;

    document.getElementById('summary-date').textContent = date;
    document.getElementById('summary-time').textContent = time;
    document.getElementById('summary-service').textContent = service;
    document.getElementById('summary-name').textContent = name;
    document.getElementById('summary-phone').textContent = phone;
}

// --- API ve İşlem Fonksiyonları ---

function displayMessage(text, type) {
    // Tailwind sınıfları güncellendi
    messageDiv.textContent = text;
    messageDiv.className = `p-4 rounded-xl text-center font-extrabold transition duration-300 ${type === 'success' ? 'bg-green-100 text-green-700 shadow-lg' : 'bg-red-100 text-red-700 shadow-lg'}`;
    messageDiv.classList.remove('hidden');
}

function renderSlots(allSlots, bookedSlots) {
    slotListDiv.innerHTML = '';
    slotListDiv.classList.remove('justify-center'); 
    
    if (allSlots.length === 0) {
        slotListDiv.textContent = 'Bu tarihte boş/tanımlı randevu saati bulunmamaktadır.';
        nextStep1Button.disabled = true;
        return;
    }

    allSlots.forEach(time => {
        const isBooked = bookedSlots.includes(time);
        const button = document.createElement('button');
        
        button.type = 'button';
        button.textContent = time;
        // Tailwind sınıfları (Yeni HTML ile uyumlu)
        button.classList.add('slot-button', 'px-4', 'py-2', 'rounded-full', 'transition', 'duration-150', 'shadow-sm', 'text-base');

        if (isBooked) {
            // Dolu slot stili
            button.classList.add('disabled');
            button.disabled = true;
        } else {
            // Boş slot stili
            button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-blue-200');

            button.addEventListener('click', () => {
                // Seçili slotu güncelle (Mevcut mantık)
                if (selectedSlot) {
                    selectedSlot.classList.remove('selected', 'bg-primary', 'text-white');
                    selectedSlot.classList.add('bg-gray-200', 'text-gray-800');
                }
                
                selectedSlot = button;
                selectedSlot.classList.add('selected');
                selectedSlot.classList.remove('bg-gray-200', 'text-gray-800');

                selectedTimeInput.value = time;
                nextStep1Button.disabled = false;
            });
        }

        slotListDiv.appendChild(button);
    });

    nextStep1Button.disabled = !selectedSlot;
}

async function fetchAvailableSlots() {
    // ... (Fetch logic aynı kaldı) ...
    const selectedDate = dateInput.value;
    selectedTimeInput.value = ''; 
    nextStep1Button.disabled = true; // Buton adı submit değil, nextStep1 oldu
    selectedSlot = null;
    messageDiv.classList.add('hidden'); 

    if (!selectedDate) {
        slotListDiv.textContent = 'Lütfen bir tarih seçin.';
        return;
    }

    // YÜKLEME SPINNER'I
    slotListDiv.classList.add('justify-center');
    slotListDiv.innerHTML = `
        <div class="flex items-center space-x-2 text-primary">
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
            renderSlots(data.all_slots, data.booked_slots);
        } else {
            slotListDiv.textContent = data.message || 'Saatler yüklenirken bir sorun oluştu.';
        }
    } catch (error) {
        console.error('API Çağrı Hatası:', error);
        slotListDiv.textContent = 'Sunucuya erişilemiyor veya ağ hatası var.';
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();

    // Bu fonksiyon sadece Adım 3'teki final onayı için çalışır
    if (currentStep !== 3) return;

    // ... (Final Gönderme Logic'i aynı kaldı) ...
    if (!selectedTimeInput.value) {
        displayMessage('Lütfen boş bir saat seçiniz.', 'error');
        return;
    }
    
    const rawPhoneNumber = document.getElementById('phone').value.replace(/\s/g, '').replace('+', '').replace('90', '');
    
    // Final doğrulama (Gerekirse tekrar kontrol)
    if (rawPhoneNumber.length !== 10 || !rawPhoneNumber.startsWith('5')) {
        displayMessage('Telefon numarası geçersiz. Lütfen Adım 2\'yi kontrol edin.', 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Onaylanıyor...';

    const appointmentData = {
        name: document.getElementById('name').value,
        phone_number: '+90' + rawPhoneNumber, 
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
            // Başarılı kayıtta form sıfırlanabilir veya teşekkür ekranına geçilebilir
            document.getElementById('step-3-content').innerHTML = `
                <div class="text-center p-8 bg-green-50 rounded-lg shadow-xl">
                    <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
                    <h3 class="text-3xl font-extrabold text-gray-800 mb-2">Randevu Başarılı!</h3>
                    <p class="text-lg text-gray-600">Randevu Saatinden 5-10dk önce geliniz!</p>
                    <p class="mt-4 text-primary font-bold">Saat: ${appointmentData.time} | Tarih: ${appointmentData.date}</p>
                </div>`;
            updateStep(3); // Adım 3'ü yeşil yapmak için
        } else {
            displayMessage(data.message || 'Randevu alınırken beklenmedik bir hata oluştu.', 'error');
        }
    } catch (error) {
        console.error('API Randevu Gönderme Hatası:', error);
        displayMessage('Ağ hatası: Sunucuya ulaşılamadı.', 'error');
    } finally {
        submitButton.textContent = 'Randevuyu Hemen Onayla';
        submitButton.disabled = false;
    }
}

// --- Olay Dinleyicileri ---

// TELEFON NUMARASI FORMATLAMA
const formatPhoneNumber = (value) => {
    // ... (Formatlama mantığı aynı kaldı) ...
    let cleaned = ('' + value).replace(/\D/g, '');

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

// Adım Geçişleri

// Adım 1 -> Adım 2
nextStep1Button.addEventListener('click', () => {
    updateStep(2);
});

// Adım 2 -> Adım 3
nextStep2Button.addEventListener('click', () => {
    if (validateStep2()) {
        populateSummary();
        updateStep(3);
        submitButton.disabled = false; // Final onaya gelince butonu aktif et
    }
});

// Adım 2 -> Adım 1 (Geri)
prevStep2Button.addEventListener('click', () => {
    updateStep(1);
});

// Adım 3 -> Adım 2 (Geri)
prevStep3Button.addEventListener('click', () => {
    updateStep(2);
});


// Tarih değiştiğinde boş saatleri otomatik yükle
dateInput.addEventListener('change', fetchAvailableSlots);

// Form gönderildiğinde (Submit)
form.addEventListener('submit', handleFormSubmit);

// Sayfa yüklendiğinde
window.addEventListener('load', () => {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    updateStep(1); // Sayfa yüklendiğinde Adım 1'i göster
});