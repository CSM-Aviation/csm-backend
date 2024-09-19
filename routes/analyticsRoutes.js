const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/pageview', analyticsController.trackPageView);
router.get('/dashboard', authenticateToken, analyticsController.getDashboardData);

module.exports = router;