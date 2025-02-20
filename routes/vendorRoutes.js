const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorFormController');

router.post('/submit', vendorController.submitVendorForm);
router.post('/upload-document', vendorController.uploadDocument);

module.exports = router;