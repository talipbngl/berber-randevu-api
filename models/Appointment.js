const mongoose = require('mongoose');

// Randevu Şeması
const AppointmentSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // unique: true, çakışma kontrolünü sağlar
    start_time: { type: Date, required: true, unique: true }, 
    end_time: { type: Date, required: true },
    service_type: { type: String, required: true },
});

module.exports = mongoose.model('Appointment', AppointmentSchema);