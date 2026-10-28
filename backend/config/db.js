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

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch (error) {
    throw new Error(
      "MONGODB_URI is malformed. Use a valid mongodb:// or mongodb+srv:// URI."
    );
  }

  if (
    !["mongodb:", "mongodb+srv:"].includes(parsedUri.protocol) ||
    !parsedUri.hostname
  ) {
    throw new Error(
      "MONGODB_URI is malformed. Use a valid mongodb:// or mongodb+srv:// URI."
    );
  }

  mongoose.set("strictQuery", true);

  const options = {
    serverSelectionTimeoutMS: 10000,
  };
  if (!parsedUri.pathname || parsedUri.pathname === "/") {
    options.dbName = "medisync";
  }

  try {
    await mongoose.connect(uri, options);
  } catch (error) {
    throw new Error(
      `MongoDB connection failed (${error.name}). Verify the Atlas URI, credentials, and network access.`
    );
  }

  return mongoose.connection;
}

module.exports = connectDB;
