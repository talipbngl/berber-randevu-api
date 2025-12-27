const mongoose = require('mongoose');

const DailyScheduleSchema = new mongoose.Schema({
  date: { type: String, required: true }, // "2025-07-10"
  start_shift: { type: String, required: true },
  end_shift: { type: String, required: true },
}, { timestamps: true });

DailyScheduleSchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('DailySchedule', DailyScheduleSchema);
