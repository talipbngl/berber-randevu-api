const mongoose = require('mongoose');

// Çalışma Saatleri Şeması
const ScheduleSchema = new mongoose.Schema({
    day_of_week: { type: Number, required: true, min: 1, max: 7 }, // 1-Pazartesi, 7-Pazar
    barber_id: { type: Number, default: 1 },
    start_shift: { type: String, required: true }, // Örn: "09:00"
    end_shift: { type: String, required: true },   // Örn: "18:00"
});

module.exports = mongoose.model('Schedule', ScheduleSchema);