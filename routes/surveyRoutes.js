const express = require('express');
const router = express.Router();
const surveyController = require('../controllers/surveyController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Public route for submitting surveys
router.post('/', surveyController.submitSurvey);


router.get('/', surveyController.getSurveys);

module.exports = router;