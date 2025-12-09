const mongoose = require('mongoose');

// Kullanıcı Şeması
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone_number: { type: String, required: true, unique: true },
});

module.exports = mongoose.model('User', UserSchema);