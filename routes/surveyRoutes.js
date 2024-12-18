const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public route for submitting surveys
router.post('/', surveyController.submitSurvey);

// Handle approval/rejection via email links
router.get('/approve/:token', surveyController.handleApproval);
router.get('/reject/:token', surveyController.handleApproval);

router.put('/:id/approval', authenticateToken, surveyController.updateApprovalStatus);

router.get('/', surveyController.getApprovedSurveys);
router.get('/all', surveyController.getAllSurveys);

module.exports = router;