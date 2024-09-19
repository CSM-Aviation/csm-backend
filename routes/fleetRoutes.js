const express = require('express');
const router = express.Router();
const fleetController = require('../controllers/fleetController');

router.get('/', fleetController.getFleet);

module.exports = router;