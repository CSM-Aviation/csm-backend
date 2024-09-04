const express = require('express');
const cors = require('cors');
const { connectToDatabase, client } = require('./mongoCon.js');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let db;

// Connect to the database before starting the server
connectToDatabase().then((database) => {
  db = database;

  app.get('/', (req, res) => {
    console.log("Request received")
    res.json('Hello from the CSM Aviation backend!');
  });

  app.get('/test', (req, res) => {
    console.log('Handling GET request to /test');
    res.json({ message: 'Test endpoint is working' });
  });

  // Endpoint to fetch configuration
  app.get('/api/config', async (req, res) => {
    try {
      const config = await db.collection('configurations').findOne();
      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }
      res.json(config);
    } catch (error) {
      console.error('Error fetching configuration:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Endpoint to handle contact form submissions
  app.post('/api/contact', async (req, res) => {
    try {
      const { firstName, lastName, email, message } = req.body;
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
  });

  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });

}).catch(console.error);

process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});