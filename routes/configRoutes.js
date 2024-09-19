const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/config', configController.getConfig);
router.put('/update-header', authenticateToken, configController.updateHeader);
router.post('/update-home-video', authenticateToken, configController.updateHomeVideo);

module.exports = router;