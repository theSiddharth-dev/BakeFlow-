const mongoose = require("mongoose"); // Import Mongoose for schema definition

const addressSchema = new mongoose.Schema({
  // Define schema for address subdocument
  street: String, // Street field as string
  city: String, // City field as string
  state: String, // State field as string
  zip: String, // Zip field as string (note: in code it's zip, but validation uses pincode)
  country: String, // Country field as string
  phone: String, // Phone field as string
  isDefault: {
    // isDefault field
    type: Boolean, // Boolean type
    default: false, // Default value false
  },
});

const userSchema = new mongoose.Schema({
  // Define schema for user document
  username: {
    // Username field
    type: String, // String type
    required: true, // Required field
    unique: true, // Must be unique
  },
  email: {
    // Email field
    type: String, // String type
    required: true, // Required field
    unique: true, // Must be unique
  },
  password: {
    // Password field
    type: String, // String type
    select: false, // Not selected by default in queries
  },
  fullName: {
    // fullName object
    firstName: {
      // First name
      type: String, // String type
      required: true, // Required
    },
    lastName: {
      // Last name
      type: String, // String type
      required: true, // Required
    },
  },
  role: {
    // Role field
    type: String, // String type
    enum: ["user", "owner"], // Allowed values
    default: "user", // Default value
  },
  address: [addressSchema], // Array of address subdocuments
});

const userModel = mongoose.model("user", userSchema); // Create model from schema

module.exports = userModel; // Export the model

