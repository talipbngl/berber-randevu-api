const mongoose = require('mongoose');

// Randevu Şeması
const AppointmentSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // unique: true, çakışma kontrolünü sağlar
    start_time: { type: Date, required: true, unique: true }, 
    end_time: { type: Date, required: true },
    service_type: { type: String, required: true },

    status: {
        type: String,
        // Bu alan sadece bu üç değeri alabilir:
        enum: ['Pending', 'Completed', 'Canceled'],
        default: 'Pending', // Randevu alındığında varsayılan olarak 'Beklemede'
        required: true
    },
    
});

module.exports = mongoose.model('Appointment', AppointmentSchema);