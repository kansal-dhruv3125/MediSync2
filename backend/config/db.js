const mongoose = require("mongoose");

/**
 * Connects to MongoDB Atlas using MONGODB_URI from the environment.
 * Throws a descriptive error on failure; the caller decides how to handle it.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy backend/.env.example to backend/.env " +
      "and paste your MongoDB Atlas connection string."
    );
  }

  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

module.exports = connectDB;
