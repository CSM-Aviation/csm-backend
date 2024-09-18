const express = require('express');
const cors = require('cors');
const { connectToDatabase, client } = require('./mongoCon.js');
const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const { uploadToS3 } = require('./utils/aws/uploadToS3.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fileUpload = require('express-fileupload');
// const authRoutes = require('./auth/auth.js');
// const auth = require('./auth/auth.js');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 }, // for example, limit files to 50MB
}));

let db;

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Function to generate S3 URL
async function generateS3Url(key) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: 60 * 5 // URL expires in 5 minutes
  };

  try {
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('Error generating S3 URL:', error);
    throw error;
  }
}

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

  app.get('/test-cors', (req, res) => {
    res.json({ message: 'CORS is working' });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await db.collection('users').findOne({ username });
      // console.log(user)

      if (!user) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign(
        { userId: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'An error occurred during login' });
    }
  });

  // New logout route (optional, as JWT is stateless)
  app.post('/api/auth/logout', (req, res) => {
    // In a real-world scenario, you might want to invalidate the token here
    // For now, we'll just send a success message
    res.json({ message: 'Logged out successfully' });
  });

  // Middleware to verify JWT token
  const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Example of a protected route
  app.get('/api/protected', authenticateToken, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
  });

  // Endpoint to fetch configuration
  app.get('/api/config', async (req, res) => {
    try {
      const config = await db.collection('configurations').findOne();
      if (!config) {
        return res.status(404).json({ error: 'Configuration not found' });
      }

      // Generate S3 URL for home_video
      if (config.home_video) {
        try {
          const videoUrl = await generateS3Url(`${config.home_video}`);
          config.home_video = videoUrl;
        } catch (error) {
          console.error('Error generating video URL:', error);
          // If there's an error, we'll keep the original home_video value
        }
      }

      res.json(config);
    } catch (error) {
      console.error('Error fetching configuration:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/update-header', async (req, res) => {
    try {
      const { header_color } = req.body;
      const config = await db.collection('configurations').findOneAndUpdate(
        {}, // empty filter to update the first document
        { $set: { header_color } },
        { upsert: true } // create a new document if one doesn't exist
      );
      res.json(config);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  // Upload new home video
  app.post('/api/update-home-video', async (req, res) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'No files were uploaded.' });
      }
      const file = req.files.video;
      const result = await uploadToS3(file);
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

  app.post('/api/trip-request', async (req, res) => {
    try {
      const result = await db.collection('trip_requests').insertOne({
        ...req.body,
        createdAt: new Date()
      });
      res.status(201).json({ message: 'Trip request submitted successfully', id: result.insertedId });
    } catch (error) {
      console.error('Error saving trip request:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // Endpoint to fetch all fleet
  app.get('/api/fleet', async (req, res) => {
    try {
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
  });

  // // Add this function to your existing server.js or create a new route file
  // app.get('/api/video-url', async (req, res) => {
  //   try {
  //     const params = {
  //       Bucket: process.env.S3_BUCKET_NAME,
  //       Key: `videos/Home.mp4`, // The key of the video in S3
  //       Expires: 60 * 5 // URL expires in 5 minutes
  //     };

  //     const url = await s3.getSignedUrlPromise('getObject', params);
  //     res.json({ url });
  //   } catch (error) {
  //     console.error('Error generating S3 URL:', error);
  //     res.status(500).json({ error: 'Failed to generate video URL' });
  //   }
  // });


  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });

}).catch(console.error);

process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

// // const bcrypt = require('bcryptjs');
// // const { connectToDatabase } = require('./mongoCon.js');

// async function createUser(username, password) {
//   const db = await connectToDatabase();
//   const hashedPassword = await bcrypt.hash(password, 10);
//   await db.collection('users').insertOne({
//     username,
//     password: hashedPassword
//   });
//   console.log('User created successfully');
// }

// createUser('admin', 'csmAdmin');