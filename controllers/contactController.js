const { getDb } = require('../services/dbService');

exports.submitContact = async (req, res) => {
    try {
      const { firstName, lastName, email, message } = req.body;
      const db = getDb();
      const result = await db.collection('contacts').insertOne({
        firstName,
        lastName,
        email,
        message,
        createdAt: new Date()
      });
      res.status(201).json({ message: 'Contact form submitted successfully', id: result.insertedId });
    } catch (error) {
      console.error('Error saving contact form:', error);
      res.status(500).json({ error: 'Server error' });
    }
  };