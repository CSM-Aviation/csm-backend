// routes/microsoftAuthRoutes.js

const express = require('express');
const router = express.Router();
const microsoftAuthController = require('../controllers/microsoftAuthController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public authentication routes
router.get('/auth/microsoft', microsoftAuthController.startAuth);
router.get('/auth/microsoft/callback', microsoftAuthController.handleCallback);

// Protected test route
router.get('/microsoft/test', authenticateToken, microsoftAuthController.testConnection);

module.exports = router;