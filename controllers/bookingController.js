const Booking = require('../models/Booking');
const nodemailer = require('nodemailer');
const { decrypt } = require('../utils/crypto');
const User = require('../models/User');
// Native crypto can be used if UUID is needed: const { randomUUID } = require('crypto');

// Helper: Send Email (Reused)
const sendBookingEmail = async (user, customerEmail, customerName, bookings, totalAmount) => {
    try {
        if (!user.emailConfig || !user.emailConfig.user || !user.emailConfig.pass || !customerEmail) return;

        const decryptedPass = decrypt(user.emailConfig.pass);
        if (!decryptedPass) return;

        const transporter = nodemailer.createTransport({
            service: user.emailConfig.service || 'gmail',
            auth: { user: user.emailConfig.user, pass: decryptedPass }
        });

        // Construct details
        let details = bookings.map(b =>
            `Space: ${b.spaceName || 'Turf'}\nDate: ${b.date}\nSlots: ${b.slots.join(', ')}\n`
        ).join('\n');

        const mailOptions = {
            from: user.emailConfig.user,
            to: customerEmail,
            subject: `Booking Confirmed: ${user.turfName}`,
            text: `
Hello ${customerName},

Your booking at ${user.turfName} is confirmed!

${details}

Total Amount: ${totalAmount}

Thank you!
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${customerEmail}`);
    } catch (error) {
        console.error('Email sending failed:', error.message);
    }
};

// @desc    Create Batch Booking
// @route   POST /api/bookings/batch
const createBookingBatch = async (req, res) => {
    const { items, customerName, customerMobile, customerEmail, totalAmount, paidAmount, paymentMode, discount } = req.body;

    // 1. Conflict Check for ALL items
    for (const item of items) {
        const existing = await Booking.find({
            space: item.space,
            date: item.date,
            status: 'Booked',
            slots: { $in: item.slots }
        });
        if (existing.length > 0) {
            return res.status(400).json({ message: `Conflict detected for space ${item.spaceName} on ${item.date}` });
        }
    }

    const groupId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const createdBookings = [];

    // 2. Create Bookings
    // Distribute discount/paidAmount proportionally or just store on the first one?
    // Better: Store main details on all, but financials are tricky.
    // For simplicity: Store accurate 'itemAmount' on each, but discount/payment info is global.
    // However, the schema expects total/paid on EACH booking.
    // Strategy: We will split the discount and payment proportionally to the item amount.

    const globalTotal = items.reduce((sum, item) => sum + item.amount, 0); // Should match totalAmount (pre-discount)

    // We'll proceed with saving each Booking separately
    for (const item of items) {
        // Simple proportion:
        const ratio = item.amount / globalTotal;
        const itemDiscount = Math.round(discount * ratio);
        const itemPaid = Math.round(paidAmount * ratio);

        // Split Mode Logic Check
        let finalPaymentMode = paymentMode;
        if (paymentMode === 'Split' && req.body.paymentDetails) {
            const details = Object.entries(req.body.paymentDetails)
                .filter(([_, val]) => val > 0)
                .map(([key, val]) => `${key}: ${val}`)
                .join(', ');
            finalPaymentMode = `Split (${details})`;
        }

        const booking = new Booking({
            user: req.user._id,
            space: item.space,
            date: item.date,
            slots: item.slots,
            customerName,
            customerMobile,
            customerEmail,
            totalAmount: item.amount,
            discount: itemDiscount,
            paidAmount: itemPaid,
            paymentMode: finalPaymentMode,
            groupId
        });
        const saved = await booking.save();
        // Populate the saved booking to get space name for frontend immediate update
        const fullSaved = await Booking.findById(saved._id).populate('space', 'name pricePerHour');
        createdBookings.push(fullSaved);
    }

    sendBookingEmail(req.user, customerEmail, customerName, items, totalAmount);

    res.status(201).json(createdBookings);
};

// @desc    Create a new booking (Single - Legacy support or simple use)
const createBooking = async (req, res) => {
    // ... (Keep existing if needed, or redirect to batch logic)
    // For now, let's just wrap it in batch logic or keep separate?
    // Let's keep separate for safety, but optimized.
    const { space, date, slots, customerName, customerMobile, customerEmail, totalAmount, paidAmount, paymentMode, discount } = req.body;

    const existingBookings = await Booking.find({
        space,
        date,
        status: 'Booked',
        slots: { $in: slots }
    });

    if (existingBookings.length > 0) {
        return res.status(400).json({ message: 'One or more slots are already booked.' });
    }

    const booking = new Booking({
        user: req.user._id,
        space,
        date,
        slots,
        customerName,
        customerMobile,
        customerEmail,
        totalAmount,
        paidAmount,
        paymentMode,
        discount,
        groupId: Date.now().toString()
    });

    const createdBooking = await booking.save();
    const fullSaved = await Booking.findById(createdBooking._id).populate('space', 'name pricePerHour');

    sendBookingEmail(req.user, customerEmail, customerName, [{
        spaceName: fullSaved.space.name,
        date: fullSaved.date,
        slots: fullSaved.slots
    }], totalAmount);

    res.status(201).json(fullSaved);
};

// @desc    Get bookings
const getBookings = async (req, res) => {
    const { date } = req.query;
    let query = { user: req.user._id };
    if (date) {
        query.date = date;
    }

    const bookings = await Booking.find(query).populate('space', 'name pricePerHour');
    res.json(bookings);
};

// @desc    Get single booking
const getBookingById = async (req, res) => {
    const booking = await Booking.findById(req.params.id).populate('space');
    if (booking && booking.user.toString() === req.user._id.toString()) {
        res.json(booking);
    } else {
        res.status(404).json({ message: 'Booking not found' });
    }
};

// @desc    Cancel booking
const cancelBooking = async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (booking && booking.user.toString() === req.user._id.toString()) {
        booking.status = 'Cancelled';
        booking.refundAmount = req.body.refundAmount || 0;
        const updatedBooking = await booking.save();
        res.json(updatedBooking);
    } else {
        res.status(404).json({ message: 'Booking not found' });
    }
};

// @desc Update Booking Payment (Settle Balance)
const updateBookingPayment = async (req, res) => {
    const { amount, paymentMode } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (booking && booking.user.toString() === req.user._id.toString()) {
        booking.paidAmount = (booking.paidAmount || 0) + Number(amount);
        // We might want to track payment history, but for now simple sum is enough for MVP.
        // If we want to store multiple payment modes, we might need a transactions array in the future.
        // For now, let's just update the last used mode or keep it simple.
        if (paymentMode) booking.paymentMode = paymentMode;

        const updatedBooking = await booking.save();
        res.json(updatedBooking);
    } else {
        res.status(404).json({ message: 'Booking not found' });
    }
};

module.exports = { createBooking, createBookingBatch, getBookings, getBookingById, cancelBooking, updateBookingPayment };
