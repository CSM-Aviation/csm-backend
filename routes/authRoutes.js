const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateLogin } = require('../middleware/validationMiddleware');
const { loginLimiter } = require('../middleware/rateLimitMiddleware');

router.post('/login', loginLimiter, validateLogin, authController.login);
router.post('/logout', authController.logout);

module.exports = router;