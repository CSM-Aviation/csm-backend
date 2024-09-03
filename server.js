const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Post = require('./models/Post');
const Configuration = require('./models/Configuration');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  writeConcern: "majority"
})
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.log('MongoDB connection error:', err));

app.use(cors({
  origin: 'http://localhost:3000', // Allow requests from your React app
  credentials: true,
  // methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());


// Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  console.log('Mongoose default connection opened');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose default connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose default connection disconnected');
});

app.get('/', (req, res) => {
  console.log("Request received")
  res.json('Hello from the CSM Aviation backend!');
});

app.get('/test', (req, res) => {
  console.log('Handling GET request to /test');
  res.json({ message: 'Test endpoint is working' });
});


// Updated POST endpoint
app.post('/api/post', async (req, res) => {
  console.log('Handling POST request to /api/post');
  const { title, content } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  try {
    const newPost = new Post({ title, content });
    await newPost.save();
    console.log('Created new post:', newPost);
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ error: 'Error saving post' });
  }
});


// New endpoint to fetch configuration
app.get('/api/config', async (req, res) => {
  try {
    const config = await Configuration.findOne();
    if (!config) {
      return res.status(404).json({ error: 'Configuration not found' });
    }
    res.json(config);
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
