const mongoose = require("mongoose"); 
const addressSchema = new mongoose.Schema({
  // Define schema for address subdocument
  street: String, 
  city: String, 
  state: String, 
  zip: String, 
  country: String, 
  phone: String,
  isDefault: {
    type: Boolean, 
    default: false, 
  },
});

const userSchema = new mongoose.Schema({
  
  username: {
    
    type: String, 
    required: true, 
    unique: true, 
  },
  email: {
    type: String, 
    required: true, 
    unique: true, 
  },
  password: {
    
    type: String, 
    select: false, 
  },
  fullName: {
    firstName: {
      
      type: String, 
      required: true,
    },
    lastName: {
      
      type: String, 
      required: true, 
    },
  },
  role: {
    type: String, 
    enum: ["user", "owner"],
    default: "user", 
  },
  address: [addressSchema], 
});

const userModel = mongoose.model("user", userSchema); // Create model from schema

module.exports = userModel; 