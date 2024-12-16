const { getDb } = require('../services/dbService');

exports.submitSurvey = async (req, res) => {
    try {
        const {
            bookingEfficiency,
            fboLocating,
            fboStaffCourtesy,
            aircraftCleanliness,
            cabinComfort,
            crewProfessionalism,
            overallSatisfaction,
            willRecommend,
            email,
            comments
        } = req.body;

        const db = getDb();
        const survey = {
            bookingEfficiency: parseInt(bookingEfficiency),
            fboLocating: parseInt(fboLocating),
            fboStaffCourtesy: parseInt(fboStaffCourtesy),
            aircraftCleanliness: parseInt(aircraftCleanliness),
            cabinComfort: parseInt(cabinComfort),
            crewProfessionalism: parseInt(crewProfessionalism),
            overallSatisfaction: parseInt(overallSatisfaction),
            willRecommend: willRecommend === 'Yes',
            email,
            comments,
            submittedAt: new Date()
        };

        const result = await db.collection('customer_surveys').insertOne(survey);

        // Send email notification to admin (optional)
        // You can use the existing email functionality from contactController.js

        res.status(201).json({ 
            message: 'Survey submitted successfully', 
            id: result.insertedId 
        });
    } catch (error) {
        console.error('Error saving survey:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getSurveys = async (req, res) => {
    try {
        const db = getDb();
        const surveys = await db.collection('customer_surveys')
            .find()
            .sort({ submittedAt: -1 })
            .toArray();

        res.json(surveys);
    } catch (error) {
        console.error('Error fetching surveys:', error);
        res.status(500).json({ error: 'Server error' });
    }
};