const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getStats);

module.exports = router;
