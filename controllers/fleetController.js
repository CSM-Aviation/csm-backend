const { getDb } = require('../services/dbService');

exports.getFleet = async (req, res) => {
    try {
        const db = getDb();
        const fleetCursor = db.collection('fleet').find();
        const fleetArray = await fleetCursor.toArray();

        if (fleetArray.length === 0) {
            return res.status(404).json({ error: 'No fleet data found' });
        }

        res.json(fleetArray);
    } catch (error) {
        console.error('Error fetching fleet data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};