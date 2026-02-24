const userModel = require("../models/user.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const redis = require("../db/Redis");
const { publishtoQueue } = require("../Broker/Broker");

const registerUser = async (req, res) => {
  // Define async function for user registration
  try {
    // Try block for error handling
    const {
      // Destructure data from request body
      username,
      email,
      password,
      fullName: { firstName, lastName },
      role,
    } = req.body;

    const isUserAlreadyexist = await userModel.findOne({
      // Check if user already exists
      $or: [{ username }, { email }], // By username or email
    });

    if (isUserAlreadyexist) {
      // If user exists
      return res // Return error response
        .status(400)
        .json({ message: "Username or email already exists" });
    }

    const hashPassword = await bcrypt.hash(password, 10); // Hash the password with salt rounds 10

    const user = await userModel.create({
      // Create new user in database
      username,
      email,
      password: hashPassword, // Store hashed password
      fullName: { firstName, lastName },
      role: role || "user", // Set role, default to 'user'
    });

    // put the data Notification Queue
    await Promise.all([
      publishtoQueue("AUTH_NOTIFICATION.USER_CREATED", {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      }),
      publishtoQueue("AUTH_SELLER_DASHBOARD.USER_CREATED", user),
    ]);

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET, // Secret key from environment
      { expiresIn: "1d" }, // Expires in 1 day
    );

    res.status(201).json({
      // Return success response
      message: "User registered Successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        addresss: user.address,
      },
    });
  } catch (err) {
    // Catch block for errors
    console.error("Error in registration:", err); // Log error (note: missing space after colon)
    res.status(500).json({ message: "internal server error" }); // Return server error
  }
};

const loginUser = async (req, res) => {
  // Define async function for user login
  try {
    // Try block
    const { username, email, password } = req.body; // Destructure login data

    const user = await userModel // Find user by username or email
      .findOne({ $or: [{ username }, { email }] })
      .select("+password"); // Include password field

    if (!user) {
      // If user not found
      return res.status(401).json({ message: "Invalid email or password" }); // Return unauthorized
    }

    const isPasswordValid = await bcrypt.compare(password, user.password); // Compare passwords

    if (!isPasswordValid) {
      // If password invalid
      return res.status(401).json({ message: "Invalid password" });
    }


    const token = jwt.sign(
      // Create JWT token
      {
        // Payload
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      process.env.JWT_SECRET, // Secret
      { expiresIn: "1d" }, // Expires in 1 day
    );

    res.status(200).json({
      // Return success
      message: "Login successful",
      token, // Return token for Bearer auth across services
      user: {
        // User data
        id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (err) {
    // Catch errors
    console.error("Error in login:", err); // Log error
    res.status(500).json({ message: "Internal server error" }); // Return error
  }
};

const getCurrentUser = async (req, res) => {
  // Define function to get current user
  return res.status(200).json({
    // Return user data from req.user
    message: "get User Successfully",
    user: req.user,
  });
};

const logoutUser = async (req, res) => {
  // Define async function for logout
  try {
    // Try block
    // Extract token from Bearer header or cookie
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

    // Blacklist the token in Redis
    if (token) {
      // If token exists
      await redis.set(`blacklist_${token}`, "true", "EX", 24 * 60 * 60); // Set in Redis with 24h expiry
    }

    res.status(200).json({
      // Return success
      message: "Logout successful",
    });
  } catch (err) {
    // Catch errors
    console.error("Error in logout:", err); // Log error
    res.status(500).json({ message: "Internal server error" }); // Return error
  }
};

const getAddresses = async (req, res) => {
  // Define async function to get user addresses
  try {
    // Try block
    const id = req.user.id; // Get user ID from request

    const user = await userModel.findById(id).select("address"); // Find user and select address field

    if (!user) {
      // If user not found
      return res.status(404).json({ message: "User not found" }); // Return not found
    }
    return res.status(200).json({
      // Return addresses
      message: "Addresses retrieved successfully",
      addresses: user.address,
    });
  } catch (error) {
    // Catch errors
    console.error("Error in getAddresses:", error); // Log error
    res.status(500).json({ message: "Internal server error" }); // Return error
  }
};

const addAddress = async (req, res) => {
  // Define async function to add address
  try {
    // Try block
    const { street, city, state, pincode, country, isDefault } = req.body; // Destructure address data
    const user = await userModel.findOneAndUpdate(
      // Find and update user
      { _id: req.user.id }, // By user ID
      {
        // Update operation
        $push: {
          // Push to address array
          address: {
            street,
            city,
            state,
            pincode,
            country,

            isDefault,
          },
        },
      },
      { new: true }, // Return updated document
    );

    if (!user) {
      // If user not found
      return res.status(404).json({ message: "User not found" }); // Return not found
    }

    return res.status(201).json({
      // Return success
      message: "Address added successfully",
      address: user.address[user.address.length - 1], // Return the added address
    });
  } catch (error) {
    // Catch errors
    return res // Return error
      .status(404)
      .json({ message: "Somethings went wrong!! Please try again later" });
  }
};

const removeAddress = async (req, res) => {
  // Define async function to remove address
  try {
    // Try block
    const { addressId } = req.params; // Get address ID from params
    const user = await userModel.findOneAndUpdate(
      // Find and update user
      { _id: req.user.id }, // By user ID
      {
        // Update operation
        $pull: {
          // Pull from addresses array (note: should be address, not addresses)
          addresses: { _id: addressId }, // Pull matching address
        },
      },
      { new: true }, // Return updated document
    );

    if (!user) {
      // If user not found
      return res.status(404).json({ message: "User not found" }); // Return not found
    }

    const addressIndex = user.address.findIndex(
      // Find index of address
      (addr) => addr._id.toString() === addressId, // Match by ID
    );
    if (addressIndex === -1) {
      // If not found
      return res.status(404).json({ message: "Address not found" }); // Return not found
    }

    user.address.splice(addressIndex, 1); // Remove address from array
    await user.save(); // Save the user

    res.status(200).json({
      // Return success
      message: "Address removed successfully",
      addresses: user.address, // Return updated addresses
    });
  } catch (err) {
    // Catch errors
    console.error("Error in removeAddress:", err); // Log error
    res.status(500).json({ message: "Internal server error" }); // Return error
  }
};

const changePassword = async (req, res) => {
  // Define async function for changing password
  try {
    // Try block for error handling
    const { currentPassword, newPassword } = req.body; // Destructure passwords from request body
    const userId = req.user.id; // Get user ID from authenticated request

    // Find user and include password field (which is not selected by default)
    const user = await userModel.findById(userId).select("+password");

    if (!user) {
      // If user not found
      return res.status(404).json({ message: "User not found" }); // Return not found
    }

    // Verify current password using bcrypt
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      // If current password is incorrect
      return res.status(401).json({ message: "Current password is incorrect" }); // Return unauthorized
    }

    // Check if new password is same as current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from current password",
      });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10); // Hash with salt rounds 10

    // Update password in database
    user.password = hashedNewPassword;
    await user.save(); // Save the user

    res.status(200).json({
      // Return success response
      message: "Password changed successfully",
    });
  } catch (err) {
    // Catch block for errors
    console.error("Error in changePassword:", err); // Log error
    res.status(500).json({ message: "Internal server error" }); // Return server error
  }
};

module.exports = {
  // Export the controller functions
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  getAddresses,
  addAddress,
  removeAddress,
  changePassword,
};
