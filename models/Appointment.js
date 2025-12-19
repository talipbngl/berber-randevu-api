const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    start_time: { type: Date, required: true, unique: true },
    end_time: { type: Date, required: true },

    service_type: { type: String, required: true, trim: true },

    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Canceled'],
      default: 'Pending',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', AppointmentSchema);
