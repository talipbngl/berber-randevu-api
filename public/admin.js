// admin.js - revize

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

  function formatDateTime(dateString) {
    return new Date(dateString).toLocaleString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStatusStyle(status) {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Canceled': return 'bg-red-100 text-red-800';
      case 'Pending':
      default: return 'bg-yellow-100 text-yellow-800';
    }
  }

  function translateStatus(status) {
    switch (status) {
      case 'Completed': return 'Tamamlandı';
      case 'Canceled': return 'İptal Edildi';
      case 'Pending':
      default: return 'Beklemede';
    }
  }

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
      listMessage.textContent = 'Sunucuya ulaşılamıyor veya veri çekilemiyor.';
    }
  }

  function renderAppointments(appointments) {
    appointmentsBody.innerHTML = '';

    if (!appointments || appointments.length === 0) {
      appointmentsBody.innerHTML =
        '<tr><td colspan="7" class="text-center py-4 text-gray-500">Henüz randevu yok.</td></tr>';
      return;
    }

    appointments.forEach((app) => {
      const row = appointmentsBody.insertRow();
      row.className = 'hover:bg-gray-50';
      row.id = `appointment-${app._id}`;

      const style = getStatusStyle(app.status);
      const translated = translateStatus(app.status);

      const isPastAndPending =
        app.status === 'Pending' && (new Date(app.start_time) < new Date(Date.now() - 5 * 3600000));

      let actionButtons = '';
      if (app.status === 'Pending') {
        actionButtons = `
          <button type="button" data-id="${app._id}" data-status="Completed"
            class="update-status-btn bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-xs rounded shadow-sm"
            ${isPastAndPending ? 'disabled' : ''}>
            Tamamla
          </button>
          <button type="button" data-id="${app._id}" data-status="Canceled"
            class="update-status-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 text-xs rounded ml-2 shadow-sm">
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
          <span id="status-label-${app._id}" class="inline-flex px-3 text-xs font-semibold leading-5 rounded-full ${style}">
            ${translated}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium" id="actions-${app._id}">
          ${actionButtons}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-400">${app._id}</td>
      `;
    });
  }

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const passInput = document.getElementById('admin-pass');
    const password = passInput.value.trim();

    authMessage.textContent = 'Kontrol ediliyor...';

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
      } else {
        authMessage.textContent = `Giriş başarısız (${response.status}).`;
      }
    } catch {
      authMessage.textContent = 'Ağ hatası. Sunucuya ulaşılamıyor.';
    }
  });

  appointmentsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.update-status-btn');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const newStatus = btn.getAttribute('data-status');

    const confirmMsg = `Randevuyu "${translateStatus(newStatus)}" olarak işaretlemek istiyor musunuz?`;
    if (confirm(confirmMsg)) handleStatusUpdate(id, newStatus, btn);
  });

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!adminPass) {
      scheduleMessage.className = 'mt-3 font-semibold text-red-600';
      scheduleMessage.textContent = 'Oturum sona ermiş. Yenileyip tekrar giriş yapın.';
      return;
    }

    const day = document.getElementById('day').value;
    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;

    scheduleMessage.textContent = 'Güncelleniyor...';

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/schedule?pass=${adminPass}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ day_of_week: day, start_shift: start, end_shift: end }),
      });

      const data = await response.json();

      if (response.ok) {
        scheduleMessage.className = 'mt-3 font-semibold text-green-600';
        scheduleMessage.textContent = `✅ ${data.message} (${data.schedule.day_of_week}. gün)`;
      } else {
        scheduleMessage.className = 'mt-3 font-semibold text-red-600';
        scheduleMessage.textContent = `Hata: ${data.message}`;
      }
    } catch {
      scheduleMessage.className = 'mt-3 font-semibold text-red-600';
      scheduleMessage.textContent = 'Ağ hatası. Güncellenemedi.';
    }
  });
});
