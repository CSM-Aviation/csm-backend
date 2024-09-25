const express = require('express');
const router = express.Router();
const { getSeoData } = require('../controllers/seoController');

router.get('/:page', getSeoData);

module.exports = router;