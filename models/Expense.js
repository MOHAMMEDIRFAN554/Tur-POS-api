const mongoose = require('mongoose');

const expenseSchema = mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    paymentMode: { type: String, enum: ['Cash', 'UPI'], default: 'Cash' },
    note: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
