const { getDb } = require('../services/dbService');

exports.subscribe = async (req, res) => {
    try {
        const { email } = req.body;
        const db = getDb();

        // Check if email already exists
        const existingSubscriber = await db.collection('subscribers').findOne({ email });
        if (existingSubscriber) {
            return res.status(400).json({ error: 'Email already subscribed' });
        }

        // Insert new subscriber
        const result = await db.collection('subscribers').insertOne({
            email,
            subscribedAt: new Date()
        });

        res.status(201).json({ message: 'Subscription successful', id: result.insertedId });
    } catch (error) {
        console.error('Error saving subscription:', error);
        res.status(500).json({ error: 'Server error' });
    }
};