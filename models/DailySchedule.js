const mongoose = require('mongoose');

const DailyScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },        // "YYYY-MM-DD"
    start_shift: { type: String, required: true }, // "09:30"
    end_shift: { type: String, required: true },   // "19:30"
    barber_id: { type: Number, default: 1 },       // ✅ EKLE
  },
  { timestamps: true }
);

// İstersen aynı gün + aynı barber için tek kayıt olsun:
DailyScheduleSchema.index({ date: 1, barber_id: 1 }, { unique: true });

module.exports = mongoose.model('DailySchedule', DailyScheduleSchema);
