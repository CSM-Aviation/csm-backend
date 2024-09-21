const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./services/dbService');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const errorHandler = require('./middleware/errorHandler');
const helmet = require('helmet');
const apiKeyMiddleware = require('./middleware/apiKeyMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const configRoutes = require('./routes/configRoutes');
const fleetRoutes = require('./routes/fleetRoutes');
const tripRoutes = require('./routes/tripRoutes');
const contactRoutes = require('./routes/contactRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

dotenv.config();

const app = express();
app.use(helmet())
const port = process.env.PORT || 5000;
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not ' +
        'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
}));
app.use(apiKeyMiddleware);
app.use(express.json());
app.use(fileUpload({
  limits: { fileSize: 100 * 1024 * 1024 },
}));
app.use(errorHandler);

// Connect to the database
connectToDatabase().then(() => {
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api', configRoutes);
  app.use('/api/fleet', fleetRoutes);
  app.use('/api/trip-request', tripRoutes);
  app.use('/api/contact', contactRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.get('/', (req, res) => {
    res.json('Hello from the CSM Aviation backend!');
  });

  app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
  });
}).catch(console.error);

process.on('SIGINT', async () => {
  // Implement proper database disconnection here
  process.exit(0);
});