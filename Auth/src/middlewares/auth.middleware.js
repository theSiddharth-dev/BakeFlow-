const jwt = require("jsonwebtoken"); // Import JWT library for token verification
const redis = require("../db/Redis"); // Import Redis instance for token blacklist check

const authMiddleware = async (req, res, next) => {
  // Define async middleware function for authentication
  const token = req.cookies.token; // Get token from cookies

  if (!token) {
    // If no token
    return res.status(401).json({ message: "Unauthorized" }); // Return unauthorized error
  }

  try {
    // Try block for error handling
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist_${token}`); // Check Redis for blacklisted token
    if (isBlacklisted) {
      // If blacklisted
      return res.status(401).json({ message: "Unauthorized" }); // Return unauthorized error
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify and decode the token

    const user = decoded; // Assign decoded data to user

    req.user = user; // Attach user to request object

    next(); // Proceed to next middleware
  } catch (error) {
    // Catch block for errors
    return res.status(401).json({ message: "Unauthorized" }); // Return unauthorized error
  }
};

module.exports = { authMiddleware }; // Export the middleware function
