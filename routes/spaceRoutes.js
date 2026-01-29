const express = require('express');
const router = express.Router();
const { getSpaces, createSpace, deleteSpace, updateSpace } = require('../controllers/spaceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getSpaces).post(protect, createSpace);
router.route('/:id').delete(protect, deleteSpace).put(protect, updateSpace);

module.exports = router;
