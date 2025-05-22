const express = require('express');
const router = express.Router();
const { register, login, verifyOTP, forgotPassword, verifyResetToken, resetPassword, googleLogin } = require('../controllers/authController');
const { validateLoginInput } = require('../middleware/inputValidation');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/register', register);
//router.post('/login', login);
router.post('/verify-otp', verifyOTP);
router.post('/forgot-password', forgotPassword);
router.get('/verify-reset-token/:token', verifyResetToken);
router.post('/reset-password', resetPassword);
router.post('/google-login', googleLogin);
router.post('/login', loginLimiter, validateLoginInput, login);


module.exports = router;
