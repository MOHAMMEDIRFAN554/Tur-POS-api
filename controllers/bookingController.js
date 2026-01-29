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
    try {
        const { items, customerName, customerMobile, customerEmail, totalAmount, paidAmount, paymentMode, discount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'No items provided for booking' });
        }

        // 1. Conflict Check for ALL items
        for (const item of items) {
            const existing = await Booking.find({
                space: item.space,
                date: item.date,
                status: 'Booked',
                slots: { $in: item.slots }
            });
            if (existing.length > 0) {
                return res.status(400).json({ message: `Conflict detected for space ${item.spaceName || 'Turf'} on ${item.date}` });
            }
        }

        const groupId = Date.now().toString() + Math.floor(Math.random() * 1000);
        const createdBookings = [];

        const preDiscountTotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        // 2. Create Bookings
        for (const item of items) {
            // Safe Proportion Logic
            const ratio = preDiscountTotal > 0 ? (item.amount / preDiscountTotal) : (1 / items.length);
            const itemDiscount = Math.round((Number(discount) || 0) * ratio);
            const itemPaid = Math.round((Number(paidAmount) || 0) * ratio);

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
            const fullSaved = await Booking.findById(saved._id).populate('space', 'name pricePerHour');
            createdBookings.push(fullSaved);
        }

        // Email in background
        if (customerEmail) {
            sendBookingEmail(req.user, customerEmail, customerName, items, totalAmount).catch(err => console.error("Email BG Error:", err));
        }

        res.status(201).json(createdBookings);
    } catch (error) {
        console.error("Batch Booking Error:", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// @desc    Create a new booking (Single - Legacy support or simple use)
const createBooking = async (req, res) => {
    try {
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

        if (customerEmail) {
            sendBookingEmail(req.user, customerEmail, customerName, [{
                spaceName: fullSaved.space.name,
                date: fullSaved.date,
                slots: fullSaved.slots
            }], totalAmount).catch(err => console.error("Email Single BG Error:", err));
        }

        res.status(201).json(fullSaved);
    } catch (error) {
        console.error("Create Booking Error:", error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// @desc    Get bookings
const getBookings = async (req, res) => {
    try {
        const { date } = req.query;
        let query = { user: req.user._id };
        if (date) {
            query.date = date;
        }

        const bookings = await Booking.find(query).populate('space', 'name pricePerHour');
        res.json(bookings);
    } catch (error) {
        console.error("Get Bookings Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// @desc    Get single booking
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('space');
        if (booking && booking.user.toString() === req.user._id.toString()) {
            res.json(booking);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        console.error("Get Booking ID Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// @desc    Cancel booking
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (booking && booking.user.toString() === req.user._id.toString()) {
            booking.status = 'Cancelled';
            booking.refundAmount = req.body.refundAmount || 0;
            const updatedBooking = await booking.save();
            res.json(updatedBooking);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        console.error("Cancel Booking Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

// @desc Update Booking Payment (Settle Balance)
const updateBookingPayment = async (req, res) => {
    try {
        const { amount, paymentMode } = req.body.paymentData || req.body;
        const booking = await Booking.findById(req.params.id);

        if (booking && booking.user.toString() === req.user._id.toString()) {
            booking.paidAmount = (booking.paidAmount || 0) + Number(amount);
            if (paymentMode) booking.paymentMode = paymentMode;

            const updatedBooking = await booking.save();
            const fullUpdated = await Booking.findById(updatedBooking._id).populate('space', 'name pricePerHour');
            res.json(fullUpdated);
        } else {
            res.status(404).json({ message: 'Booking not found' });
        }
    } catch (error) {
        console.error("Update Payment Error:", error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

module.exports = { createBooking, createBookingBatch, getBookings, getBookingById, cancelBooking, updateBookingPayment };
