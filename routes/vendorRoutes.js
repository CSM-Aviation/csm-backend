const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorFormController');
const { authenticateToken } = require('../middleware/authMiddleware');


router.post('/submit', vendorController.submitVendorForm);
router.post('/upload-document', vendorController.uploadDocument);

router.get('/approve/:token', vendorController.handleApproval);
router.get('/reject-form/:token', vendorController.showRejectionForm); // Show rejection form
router.post('/reject/:token', [
    express.json(),                                  // Parse JSON bodies
    express.urlencoded({ extended: true }),          // Parse URL-encoded bodies
    vendorController.handleApproval                  // Handle the request
]);

// Admin-only routes (require authentication)
router.get('/all', authenticateToken, vendorController.getAllVendors);
router.get('/:id', authenticateToken, vendorController.getVendorById);
router.put('/:id/status', authenticateToken, vendorController.updateVendorStatus);

module.exports = router;