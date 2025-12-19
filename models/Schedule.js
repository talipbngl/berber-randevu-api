const mongoose = require('mongoose');

const ScheduleSchema = new mongoose.Schema(
  {
    day_of_week: { type: Number, required: true, min: 1, max: 7 },
    barber_id: { type: Number, default: 1 },
    start_shift: { type: String, required: true }, // "09:00"
    end_shift: { type: String, required: true },   // "18:00"
  },
  { timestamps: true }
);

// Aynı gün için tek kayıt (barber_id=1 varsayılan)
ScheduleSchema.index({ day_of_week: 1, barber_id: 1 }, { unique: true });

module.exports = mongoose.model('Schedule', ScheduleSchema);
