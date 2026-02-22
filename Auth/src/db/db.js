const mongoose = require("mongoose"); // Import Mongoose for MongoDB connection

const ConnecttoDB = async () => {
  // Define an async function to connect to the database
  try {
    // Try block for error handling
    await mongoose.connect(process.env.MONGODB_URI); // Connect to MongoDB using URI from environment
    console.log("Successfully connected to Database."); // Log success message
  } catch (error) {
    // Catch block for errors
    console.log("Failed to connect database due to ", error); // Log error message
  }
};

module.exports = ConnecttoDB; // Export the connection function
