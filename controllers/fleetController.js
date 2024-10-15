const { getDb } = require('../services/dbService');
const { listS3ObjectsWithPrefix, generateMultipleS3Urls } = require('../utils/aws/s3Utils');

exports.getFleet = async (req, res) => {
    try {
        const db = getDb();
        const fleetCursor = db.collection('fleet').find();
        const fleetArray = await fleetCursor.toArray();

        const fleetWithImages = await Promise.all(fleetArray.map(async (aircraft) => {
            const imageUrls = await getAircraftImages(aircraft.registration);
            return { ...aircraft, imageUrls };
        }));

        res.json(fleetWithImages);
    } catch (error) {
        console.error('Error fetching fleet data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

async function getAircraftImages(registration) {
    try {
        const prefix = `images/${registration}/`;
        const listResult = await listS3ObjectsWithPrefix(prefix);

        if (listResult.Contents && listResult.Contents.length > 0) {
            const imageKeys = listResult.Contents
                .map(obj => obj.Key)
                .filter(key => {
                    // Filter out keys that end with '/' (directories) or don't have a file name
                    const parts = key.split('/');
                    return parts.length > 2 && parts[parts.length - 1] !== '';
                });

            const imageUrls = await generateMultipleS3Urls(imageKeys);
            return imageUrls.filter(url => {
                // Additional filter to ensure the URL contains a file name
                const urlParts = url.split('/');
                const fileNamePart = urlParts[urlParts.length - 1].split('?')[0];
                return fileNamePart !== '';
            });
        }

        return [];
    } catch (error) {
        console.error(`Error fetching images for ${registration}:`, error);
        return [];
    }
}