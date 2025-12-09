// cancel.js - Randevu İptal Logiği

document.addEventListener('DOMContentLoaded', () => {

    const API_BASE_URL = window.location.origin;

    const form = document.getElementById('cancel-form');
    const phoneInput = document.getElementById('cancel-phone');
    const dateInput = document.getElementById('cancel-date');
    const timeInput = document.getElementById('cancel-time');
    const messageDiv = document.getElementById('cancel-message');
    const cancelButton = document.getElementById('cancel-button');

    function displayMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `p-3 rounded-lg text-center font-semibold ${type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`;
        messageDiv.classList.remove('hidden');
    }
    
    // Telefon numarası formatlama (app.js'teki aynı mantık)
    const formatPhoneNumber = (value) => {
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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawPhoneNumber = phoneInput.value.replace(/\s/g, '').replace('+', '').replace('90', '');
        
        if (rawPhoneNumber.length !== 10 || !rawPhoneNumber.startsWith('5')) {
             displayMessage('Lütfen 10 haneli geçerli bir telefon numarası girin.', 'error');
             return;
        }

        cancelButton.disabled = true;
        cancelButton.textContent = 'İptal Ediliyor...';
        messageDiv.classList.add('hidden');
        
        const cancellationData = {
            phone_number: '+90' + rawPhoneNumber,
            date: dateInput.value,
            time: timeInput.value
        };
        
        try {
            // DELETE isteği atılırken veriler genellikle Body içinde gönderilemez,
            // ancak Express'in bodyParser'ı bunu desteklediği için DELETE methodunu kullanıyoruz.
            const response = await fetch(`${API_BASE_URL}/api/cancel`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cancellationData)
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(data.message, 'success');
                form.reset(); 
            } else {
                displayMessage(data.message || 'Randevu iptal edilirken bir sorun oluştu.', 'error');
            }
        } catch (error) {
            console.error('İptal API Çağrı Hatası:', error);
            displayMessage('Ağ hatası: Sunucuya ulaşılamadı.', 'error');
        } finally {
            cancelButton.disabled = false;
            cancelButton.textContent = 'Randevuyu İptal Et';
        }
    });
});