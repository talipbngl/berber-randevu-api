// app.js - Frontend Logiği (Düzeltilmiş - Mobil tıklama + sağlam telefon parse + TR saat)

const form = document.getElementById('appointment-form');
const dateInput = document.getElementById('date');
const slotListDiv = document.getElementById('slot-list');
const selectedTimeInput = document.getElementById('selected-time');
const submitButton = document.getElementById('submit-button');
const messageDiv = document.getElementById('message');
const phoneInput = document.getElementById('phone');

// Adım Geçiş Butonları
const nextStep1Button = document.getElementById('next-step-1');
const nextStep2Button = document.getElementById('next-step-2');
const prevStep2Button = document.getElementById('prev-step-2');
const prevStep3Button = document.getElementById('prev-step-3');

// İptal Elementleri
const cancellationModal = document.getElementById('cancellation-modal');
const openCancellationBtn = document.getElementById('open-cancellation-btn');
const closeCancellationBtn = document.getElementById('close-cancellation-btn');
const cancellationForm = document.getElementById('cancellation-form');
const cancelPhoneInput = document.getElementById('cancel-phone-input');
const cancellationResults = document.getElementById('cancellation-results');
const listAppointmentsBtn = document.getElementById('list-appointments-btn');

const API_BASE_URL = window.location.origin;

let selectedSlot = null;
let currentStep = 1;

// ===============================
// Yardımcılar
// ===============================
function displayMessage(text, type) {
  if (!messageDiv) return;
  messageDiv.textContent = text;
  messageDiv.className = `p-4 rounded-xl text-center font-extrabold transition duration-300 ${
    type === 'success'
      ? 'bg-green-100 text-green-700 shadow-lg'
      : 'bg-red-100 text-red-700 shadow-lg'
  }`;
  messageDiv.classList.remove('hidden');
}

function hideMessage() {
  if (!messageDiv) return;
  messageDiv.classList.add('hidden');
  messageDiv.textContent = '';
}

// Telefon numarası formatlama (gösterim için)
const formatPhoneNumber = (value) => {
  let cleaned = String(value || '').replace(/\D/g, '');

  // Baştan +90 / 90 / 0 kırp
  if (cleaned.startsWith('90')) cleaned = cleaned.substring(2);
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);

  cleaned = cleaned.substring(0, 10);

  let formattedValue = '';
  if (cleaned.length > 0) formattedValue += cleaned.substring(0, 3);
  if (cleaned.length > 3) formattedValue += ' ' + cleaned.substring(3, 6);
  if (cleaned.length > 6) formattedValue += ' ' + cleaned.substring(6, 8);
  if (cleaned.length > 8) formattedValue += ' ' + cleaned.substring(8, 10);

  return formattedValue;
};

// Telefonu API’ye gidecek şekilde normalize et: 5XXXXXXXXX (10 hane)
function normalizeTRMobile10(input) {
  let digits = String(input || '').replace(/\D/g, '');

  // En güvenlisi: son 10 haneyi al
  // (+905xx..., 905xx..., 05xx..., 5xx...) hepsini toparlar
  digits = digits.slice(-10);

  return digits;
}

function isValidTRMobile10(d10) {
  return d10.length === 10 && d10.startsWith('5');
}

// ===============================
// Step Logic
// ===============================
function updateStep(step) {
  currentStep = step;

  document.querySelectorAll('.step-content').forEach((el) => el.classList.add('hidden'));
  const active = document.getElementById(`step-${step}-content`);
  if (active) active.classList.remove('hidden');

  // SADECE circle'ları resetle (önceki kod bazen yanlış id'leri etkiliyordu)
  document.querySelectorAll('[id$="-circle"]').forEach((circle) => {
    circle.classList.remove('bg-primary', 'text-white');
    circle.classList.add('bg-gray-300', 'text-gray-600');
  });

  for (let i = 1; i <= step; i++) {
    const circle = document.getElementById(`step-${i}-circle`);
    if (circle) {
      circle.classList.remove('bg-gray-300', 'text-gray-600');
      circle.classList.add('bg-primary', 'text-white');
    }
  }

  hideMessage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep2() {
  const name = document.getElementById('name')?.value?.trim() || '';
  const service = document.getElementById('service')?.value || '';
  const raw10 = normalizeTRMobile10(phoneInput?.value || '');

  if (!name || !service || !isValidTRMobile10(raw10)) {
    displayMessage('Lütfen tüm alanları doldurun ve geçerli bir telefon numarası girin.', 'error');
    return false;
  }
  return true;
}

function populateSummary() {
  const name = document.getElementById('name')?.value || '';
  const phone = phoneInput?.value || '';
  const service = document.getElementById('service')?.value || '';
  const date = dateInput?.value || '';
  const time = selectedTimeInput?.value || '';

  const sd = document.getElementById('summary-date');
  const st = document.getElementById('summary-time');
  const ss = document.getElementById('summary-service');
  const sn = document.getElementById('summary-name');
  const sp = document.getElementById('summary-phone');

  if (sd) sd.textContent = date;
  if (st) st.textContent = time;
  if (ss) ss.textContent = service;
  if (sn) sn.textContent = name;
  if (sp) sp.textContent = phone;
}

// ===============================
// Slots
// ===============================
function renderSlots(allSlots, bookedSlots) {
  slotListDiv.innerHTML = '';
  slotListDiv.classList.remove('justify-center');

  if (!Array.isArray(allSlots) || allSlots.length === 0) {
    slotListDiv.textContent = 'Bu tarihte boş/tanımlı randevu saati bulunmamaktadır.';
    nextStep1Button.disabled = true;
    return;
  }

  const bookedSet = new Set(Array.isArray(bookedSlots) ? bookedSlots : []);

  selectedSlot = null;
  selectedTimeInput.value = '';
  nextStep1Button.disabled = true;

  allSlots.forEach((time) => {
    const isBooked = bookedSet.has(time);
    const button = document.createElement('button');

    button.type = 'button'; // ✅ mobilde submit zıplatmasını engeller
    button.textContent = time;
    button.classList.add(
      'slot-button',
      'px-4',
      'py-2',
      'rounded-full',
      'transition',
      'duration-150',
      'shadow-sm',
      'text-base'
    );

    if (isBooked) {
      button.classList.add('disabled');
      button.disabled = true;
    } else {
      button.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-blue-200');

      button.addEventListener('click', () => {
        if (selectedSlot) {
          selectedSlot.classList.remove('selected');
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
}

async function fetchAvailableSlots() {
  const selectedDate = dateInput.value;

  selectedTimeInput.value = '';
  nextStep1Button.disabled = true;
  selectedSlot = null;
  hideMessage();

  if (!selectedDate) {
    slotListDiv.textContent = 'Lütfen bir tarih seçin.';
    return;
  }

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
    const response = await fetch(`${API_BASE_URL}/api/slots?date=${encodeURIComponent(selectedDate)}`);
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

// ===============================
// Booking submit
// ===============================
async function handleFormSubmit(event) {
  event.preventDefault();
  if (currentStep !== 3) return;

  if (!selectedTimeInput.value) {
    displayMessage('Lütfen boş bir saat seçiniz.', 'error');
    return;
  }

  const raw10 = normalizeTRMobile10(phoneInput.value);
  if (!isValidTRMobile10(raw10)) {
    displayMessage("Telefon numarası geçersiz. Lütfen Adım 2'yi kontrol edin.", 'error');
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Randevu Alınıyor...';

  const appointmentData = {
    name: document.getElementById('name').value,
    phone_number: '+90' + raw10,
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

      // Başarılı kayıtta Teşekkür Ekranı
      const step3 = document.getElementById('step-3-content');
      if (step3) {
        step3.innerHTML = `
          <div class="text-center p-8 bg-green-50 rounded-lg shadow-xl">
            <i class="fas fa-check-circle text-6xl text-green-500 mb-4"></i>
            <h3 class="text-3xl font-extrabold text-gray-800 mb-2">Randevu Başarılı!</h3>
            <p class="text-lg text-gray-600">Randevunuz kaydedildi.</p>
            <p class="mt-4 text-primary font-bold">Saat: ${appointmentData.time} | Tarih: ${appointmentData.date}</p>
            <button type="button" onclick="window.location.reload()" class="mt-6 py-2 px-4 bg-primary text-white rounded-lg hover:bg-blue-800">Yeni Randevu Al</button>
          </div>`;
      }

      updateStep(3);
    } else {
      displayMessage(data.message || 'Randevu alınırken beklenmedik bir hata oluştu.', 'error');
    }
  } catch (error) {
    console.error('API Randevu Gönderme Hatası:', error);
    displayMessage('Ağ hatası: Sunucuya ulaşılamadı.', 'error');
  } finally {
    // Eğer buton hâlâ sayfada varsa geri getir
    const btn = document.getElementById('submit-button');
    if (btn) {
      btn.textContent = 'Randevuyu Hemen Onayla';
      btn.disabled = false;
    }
  }
}

// ===============================
// Cancellation (İptal)
// ===============================
function renderCancellableAppointments(appointments) {
  cancellationResults.innerHTML = '';

  if (!Array.isArray(appointments) || appointments.length === 0) {
    cancellationResults.innerHTML =
      '<p class="text-red-500 font-semibold">Bu numaraya kayıtlı aktif randevu bulunmamaktadır.</p>';
    return;
  }

  appointments.forEach((app) => {
    const appointmentDate = new Date(app.time);

    // ✅ Saat kaymasını azalt: TR saatini bas
    const dateStr = appointmentDate.toLocaleDateString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeStr = appointmentDate.toLocaleTimeString('tr-TR', {
      timeZone: 'Europe/Istanbul',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemDiv = document.createElement('div');
    itemDiv.id = `app-${app.id}`;
    itemDiv.className = 'flex justify-between items-center p-3 bg-blue-50 border border-blue-200 rounded-lg';

    itemDiv.innerHTML = `
      <div>
        <span class="font-bold">${dateStr} ${timeStr}</span>
        <span class="text-sm text-gray-600">(${app.service || ''})</span>
      </div>
      <button type="button" data-id="${app.id}" class="cancel-action-btn py-1 px-3 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition duration-150">
        İptal Et
      </button>
    `;

    cancellationResults.appendChild(itemDiv);
  });
}

async function cancelAppointmentById(id, button) {
  button.disabled = true;
  button.textContent = 'İptal Ediliyor...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/cancel-id/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (response.ok) {
      const row = document.getElementById(`app-${id}`);
      if (row) {
        row.innerHTML = `<div class="text-green-600 font-bold">✅ İptal Edildi!</div>`;
        setTimeout(() => {
          row.remove();
          // slotları yenile
          dateInput.dispatchEvent(new Event('change'));
        }, 2000);
      }
    } else {
      button.textContent = 'Hata!';
      alert(data.message || 'İptal başarısız oldu.');
      button.disabled = false;
      button.textContent = 'İptal Et';
    }
  } catch (error) {
    console.error('İptal Hatası:', error);
    button.textContent = 'Ağ Hatası!';
    button.disabled = false;
  }
}

// ===============================
// Event listeners
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Telefon formatlama
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      e.target.value = formatPhoneNumber(e.target.value);
    });
  }
  if (cancelPhoneInput) {
    cancelPhoneInput.addEventListener('input', (e) => {
      e.target.value = formatPhoneNumber(e.target.value);
    });
  }

  // Step geçişleri
  nextStep1Button.addEventListener('click', () => {
    if (!selectedTimeInput.value) {
      displayMessage('Lütfen boş bir randevu saati seçiniz.', 'error');
      return;
    }
    updateStep(2);
  });

  nextStep2Button.addEventListener('click', () => {
    if (validateStep2()) {
      populateSummary();
      updateStep(3);

      // submit butonunu burada aç
      if (submitButton) submitButton.disabled = false;
    }
  });

  prevStep2Button.addEventListener('click', () => updateStep(1));
  prevStep3Button.addEventListener('click', () => updateStep(2));

  // Modal aç / kapat
  openCancellationBtn.addEventListener('click', () => {
    cancellationModal.classList.remove('hidden');
    cancellationResults.innerHTML = '';
    cancellationForm.reset();
  });

  closeCancellationBtn.addEventListener('click', () => {
    cancellationModal.classList.add('hidden');
    cancellationForm.reset();
  });

  // Modal dışına tıklayınca kapat (isteğe bağlı ama iyi)
  cancellationModal.addEventListener('click', (e) => {
    if (e.target === cancellationModal) {
      cancellationModal.classList.add('hidden');
      cancellationForm.reset();
    }
  });

  // Randevuları listele
  cancellationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    cancellationResults.innerHTML = '<p class="text-center text-gray-500">Randevular aranıyor...</p>';
    listAppointmentsBtn.disabled = true;

    const raw10 = normalizeTRMobile10(cancelPhoneInput.value);
    if (!isValidTRMobile10(raw10)) {
      cancellationResults.innerHTML = '<p class="text-red-500 font-semibold">Lütfen geçerli bir numara girin (5XXXXXXXXX).</p>';
      listAppointmentsBtn.disabled = false;
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/user-appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: '+90' + raw10 }),
      });

      const data = await response.json();

      if (response.ok) {
        renderCancellableAppointments(data.appointments);
      } else {
        cancellationResults.innerHTML = `<p class="text-red-500 font-semibold">${data.message || 'Randevu listelenirken bir hata oluştu.'}</p>`;
      }
    } catch (error) {
      cancellationResults.innerHTML = '<p class="text-red-500 font-semibold">Sunucuya ulaşılamadı. Ağ hatası.</p>';
    } finally {
      listAppointmentsBtn.disabled = false;
    }
  });

  // İptal butonları (delegate)
  cancellationResults.addEventListener('click', (e) => {
    const targetButton = e.target.closest('.cancel-action-btn');
    if (!targetButton) return;

    const appointmentId = targetButton.getAttribute('data-id');
    if (confirm('Bu randevuyu iptal etmek istediğinizden emin misiniz?')) {
      cancelAppointmentById(appointmentId, targetButton);
    }
  });

  // Tarih değişince slot çek
  dateInput.addEventListener('change', fetchAvailableSlots);

  // Submit
  form.addEventListener('submit', handleFormSubmit);

  // min date = today
  const today = new Date().toISOString().split('T')[0];
  dateInput.setAttribute('min', today);

  updateStep(1);
});
