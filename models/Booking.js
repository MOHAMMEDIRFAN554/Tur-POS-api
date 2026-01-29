const mongoose = require('mongoose');

const bookingSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    space: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Space' },
    date: { type: String, required: true }, // YYYY-MM-DD
    slots: [{ type: String, required: true }], // Format: "06:00-07:00"
    customerName: { type: String, required: true },
    customerMobile: { type: String, required: true },
    customerEmail: { type: String },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentMode: { type: String, default: 'Cash' }, // Allows Cash, UPI, Card, Split (with details)
    status: { type: String, enum: ['Booked', 'Cancelled'], default: 'Booked' },
    discount: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    groupId: { type: String }, // For batch/multi-space bookings
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
