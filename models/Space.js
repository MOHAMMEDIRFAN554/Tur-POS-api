const mongoose = require('mongoose');

const spaceSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    pricePerHour: { type: Number, required: true },
    customRates: { type: Map, of: Number, default: {} } // Format: { "06:00-07:00": 1500 }
}, { timestamps: true });

module.exports = mongoose.model('Space', spaceSchema);
