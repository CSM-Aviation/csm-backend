const express = require('express');
const router = express.Router();
const { getSeoData, getAllSeoConfigurations, updateSeoConfiguration } = require('../controllers/seoController');
const { authenticateToken } = require('../middleware/authMiddleware');


router.get('/:page', getSeoData);
router.get('/configurations/all', authenticateToken, getAllSeoConfigurations);
router.put('/configurations/:id', authenticateToken, updateSeoConfiguration);

module.exports = router;