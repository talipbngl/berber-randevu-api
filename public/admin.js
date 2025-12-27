// admin.js - WhatsApp Entegrasyonu ve Modernize Edilmiş Liste

document.addEventListener('DOMContentLoaded', () => {
  const API_BASE_URL = window.location.origin;

  const authForm = document.getElementById('auth-form');
  const adminContent = document.getElementById('admin-content');
  const authSection = document.getElementById('auth-section');
  const authMessage = document.getElementById('auth-message');
  const appointmentsBody = document.getElementById('appointments-body');
  const scheduleForm = document.getElementById('schedule-form');
  const scheduleMessage = document.getElementById('schedule-message');
  const randevuSayisi = document.getElementById('randevu-sayisi');
  const listMessage = document.getElementById('list-message');

  let adminPass = null;

  if (!authForm || !adminContent || !authSection || !scheduleForm) {
    console.error("KRİTİK HATA: admin.html tam yüklenmedi veya ID'ler eksik.");
    return;
  }

  const TR_TZ = "Europe/Istanbul";

  // Tarih ve Saat Formatlama
  function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString("tr-TR", {
      timeZone: TR_TZ,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // Durum Renkleri
  function getStatusStyle(status) {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Canceled': return 'bg-red-100 text-red-800';
      case 'Pending':
      default: return 'bg-yellow-100 text-yellow-800';
    }
  }

  // Durum Türkçeleştirme
  function translateStatus(status) {
    switch (status) {
      case 'Completed': return 'Tamamlandı';
      case 'Canceled': return 'İptal Edildi';
      case 'Pending':
      default: return 'Beklemede';
    }
  }

  // Randevu Durum Güncelleme
  async function handleStatusUpdate(id, newStatus, button) {
    if (!adminPass) {
      alert('Yetkiniz sona ermiş veya parola eksik. Lütfen sayfayı yenileyin.');
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = '...';

    const url = `${API_BASE_URL}/api/admin/appointment/${id}?pass=${adminPass}`;

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (response.ok) {
        const statusLabel = document.getElementById(`status-label-${id}`);
        const translated = translateStatus(data.appointment.status);
        const style = getStatusStyle(data.appointment.status);

        statusLabel.className = `inline-flex px-3 text-xs font-semibold leading-5 rounded-full ${style}`;
        statusLabel.textContent = translated;

        document.getElementById(`actions-${id}`).innerHTML =
          `<span class="text-gray-500 text-xs">İşlem Yapıldı</span>`;

        alert(`Randevu durumu: ${translated}`);
      } else {
        alert(data.message || 'Durum güncelleme başarısız.');
      }
    } catch (error) {
      console.error('Durum güncelleme hatası:', error);
      alert('Ağ hatası oluştu.');
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // Randevuları Çekme
  async function fetchAppointments(password) {
    listMessage.textContent = 'Randevular yükleniyor...';
    const url = `${API_BASE_URL}/api/admin/appointments?pass=${password}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (response.status === 401) {
        authSection.classList.remove('hidden');
        adminContent.classList.add('hidden');
        authMessage.textContent = 'Hata: Oturum sonlandı veya parola yanlış.';
        return;
      }

      if (!response.ok) throw new Error(data.message || 'Randevular yüklenemedi.');

      renderAppointments(data.appointments);
      randevuSayisi.textContent = `Toplam Randevu Sayısı: ${data.count}`;
      listMessage.textContent = '';
    } catch (error) {
      console.error('Randevu çekme hatası:', error);
      listMessage.textContent = 'Sunucuya ulaşılamıyor.';
    }
  }

  // Randevuları Tabloya Basma
  function renderAppointments(appointments) {
    appointmentsBody.innerHTML = '';

    if (!appointments || appointments.length === 0) {
      appointmentsBody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4 text-gray-500">Henüz randevu yok.</td></tr>';
      return;
    }

    appointments.forEach((app) => {
      const row = appointmentsBody.insertRow();
      row.className = 'hover:bg-gray-50 border-b transition duration-150';
      row.id = `appointment-${app._id}`;

      const style = getStatusStyle(app.status);
      const translated = translateStatus(app.status);
      const phone = app.user_id ? app.user_id.phone_number : 'N/A';

      // WhatsApp Link Hazırlığı
      const cleanPhone = phone.replace(/\D/g, ''); // Sadece rakamlar
      const whatsappUrl = `https://wa.me/${cleanPhone}`;

      // Geçmiş randevu kontrolü (Kilitli butonlar için)
      const isPastAndPending =
        app.status === "Pending" && (new Date(app.start_time).getTime() < (Date.now() - 5 * 3600000));

      let actionButtons = '';
      if (app.status === 'Pending') {
        actionButtons = `
          <button type="button" data-id="${app._id}" data-status="Completed"
            class="update-status-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-xs rounded shadow-sm mr-1"
            ${isPastAndPending ? 'disabled' : ''}>
            Tamamla
          </button>
          <button type="button" data-id="${app._id}" data-status="Canceled"
            class="update-status-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs rounded shadow-sm">
            İptal
          </button>
        `;
      } else {
        actionButtons = `<span class="text-gray-400 text-xs italic">Tamamlandı</span>`;
      }

      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${formatDateTime(app.start_time)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">${app.user_id ? app.user_id.name : 'N/A'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
          <div class="flex items-center space-x-2">
            <span>${phone}</span>
            <a href="${whatsappUrl}" target="_blank" class="text-green-500 hover:text-green-600 transition transform hover:scale-110" title="WhatsApp Mesaj Gönder">
              <i class="fab fa-whatsapp text-lg"></i>
            </a>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${app.service_type}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span id="status-label-${app._id}" class="inline-flex px-3 text-xs font-bold leading-5 rounded-full ${style}">
            ${translated}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" id="actions-${app._id}">
          ${actionButtons}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-[10px] text-gray-300 uppercase">${app._id.slice(-6)}</td>
      `;
    });
  }

  // Admin Giriş Formu
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passInput = document.getElementById('admin-pass');
    const password = passInput.value.trim();
    authMessage.textContent = 'Giriş yapılıyor...';

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/appointments?pass=${password}`);
      if (response.status === 401) {
        authMessage.textContent = 'Hatalı parola.';
        passInput.value = '';
        return;
      }
      if (response.ok) {
        adminPass = password;
        authSection.classList.add('hidden');
        adminContent.classList.remove('hidden');
        fetchAppointments(adminPass);
      }
    } catch {
      authMessage.textContent = 'Bağlantı hatası.';
    }
  });

  // Delegated Click Event (Tablodaki butonlar için)
  appointmentsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.update-status-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const newStatus = btn.getAttribute('data-status');
    if (confirm(`Randevuyu "${translateStatus(newStatus)}" olarak güncellemek istiyor musunuz?`)) {
      handleStatusUpdate(id, newStatus, btn);
    }
  });

  // ✅ Çalışma Saatleri Formu (ARTIK TARİHE ÖZEL)
  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!adminPass) return;

    // ✅ admin.html’de artık <input type="date" id="date"> olmalı
    const dateEl = document.getElementById('date');
    const date = dateEl ? dateEl.value : '';

    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;

    if (!date) {
      scheduleMessage.className = 'mt-3 font-semibold text-red-600';
      scheduleMessage.textContent = 'Lütfen tarih seçin.';
      return;
    }

    scheduleMessage.textContent = 'Kaydediliyor...';

    try {
      // ✅ yeni endpoint: sadece bu gün için
      const response = await fetch(`${API_BASE_URL}/api/admin/schedule-day?pass=${adminPass}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, start_shift: start, end_shift: end }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        scheduleMessage.className = 'mt-3 font-semibold text-green-600';
        scheduleMessage.textContent = '✅ Sadece bu tarih için güncellendi.';
      } else {
        scheduleMessage.className = 'mt-3 font-semibold text-red-600';
        scheduleMessage.textContent = data.message || 'Saat güncelleme başarısız.';
      }
    } catch {
      scheduleMessage.className = 'mt-3 font-semibold text-red-600';
      scheduleMessage.textContent = 'Hata oluştu.';
    }

    // (Senin kodunda burada vardı, dokunmadım ama idealde tek yerde register edilmeli)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('PWA Kayıt Başarılı:', reg.scope))
          .catch(err => console.log('PWA Kayıt Hatası:', err));
      });
    }
  });
});
