const express = require('express');

const { updateProfile, changePassword } = require('../controllers/userController');
const auth = require('../middleware/auth');

const router = express.Router();

router.put('/me', auth, updateProfile);
router.patch('/me/password', auth, changePassword);

module.exports = router;
