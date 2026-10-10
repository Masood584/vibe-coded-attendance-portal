const mongoose = require('mongoose');

let connectionPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not configured');
  }

  connectionPromise = mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
      console.log('MongoDB connected');
      return mongoose.connection;
    });

  try {
    return await connectionPromise;
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    throw err;
  } finally {
    connectionPromise = null;
  }
}

module.exports = connectDB;
