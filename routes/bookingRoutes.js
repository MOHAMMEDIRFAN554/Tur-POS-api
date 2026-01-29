const express = require('express');
const router = express.Router();
const { createBooking, createBookingBatch, getBookings, getBookingById, cancelBooking, updateBookingPayment } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, createBooking).get(protect, getBookings);
router.route('/batch').post(protect, createBookingBatch);
router.route('/:id').get(protect, getBookingById);
router.route('/:id/cancel').put(protect, cancelBooking);
router.route('/:id/pay').put(protect, updateBookingPayment);

module.exports = router;
