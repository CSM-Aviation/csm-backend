const { generateS3Url } = require('../utils/aws/s3Utils');
const { uploadToS3 } = require('../utils/aws/uploadToS3');
const { getDb } = require('../services/dbService');

exports.getConfig = async (req, res) => {
  try {
    const db = getDb();
    const config = await db.collection('configurations').findOne();
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    if (config.home_video) {
      try {
        const videoUrl = await generateS3Url(`${config.home_video}`);
        const f1VideoUrl1 = await generateS3Url(`${config.f1_video1}`);
        const f1VideoUrl2 = await generateS3Url(`${config.f1_video2}`);
        config.home_video = videoUrl;
        config.f1VideoUrl1 = f1VideoUrl1;
        config.f1VideoUrl2 = f1VideoUrl2;
      } catch (error) {
        console.error('Error generating video URL:', error);
      }
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateHeader = async (req, res) => {
  try {
    const { header_color } = req.body;
    const db = getDb();
    const config = await db.collection('configurations').findOneAndUpdate(
      {},
      { $set: { header_color } },
      { upsert: true }
    );
    res.json(config);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateHomeVideo = async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded.' });
    }
    const file = req.files.video;
    const result = await uploadToS3(file);
    const db = getDb();
    const config = await db.collection('configurations').findOneAndUpdate(
      {},
      { $set: { home_video: result.Key } },
      { upsert: true }
    );
    res.json({ message: 'Home video updated successfully', videoUrl: result.Location });
  } catch (error) {
    console.error('Error uploading home video:', error);
    res.status(500).json({ error: 'Server error' });
  }
};