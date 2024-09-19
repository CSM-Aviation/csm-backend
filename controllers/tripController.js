const { getDb } = require('../services/dbService');

exports.submitTripRequest = async (req, res) => {
    try {
        const db = getDb();
        const result = await db.collection('trip_requests').insertOne({
            ...req.body,
            createdAt: new Date()
        });
        res.status(201).json({ message: 'Trip request submitted successfully', id: result.insertedId });
    } catch (error) {
        console.error('Error saving trip request:', error);
        res.status(500).json({ error: 'Server error' });
    }
};