const express = require("express"); // Import Express for routing
const validators = require("../middlewares/validator.middleware"); // Import validation middlewares
const Authcontroller = require("../Controllers/auth.controller"); // Import auth controller functions
const authMiddleware = require("../middlewares/auth.middleware"); // Import auth middleware
const router = express.Router(); // Create Express router

// Register endpoint
router.post(
  // Define POST route for registration
  "/register", // Route path
  validators.registerUserValidation, // Apply validation middleware
  Authcontroller.registerUser // Call register controller
);

// Login endpoint
router.post("/login", validators.loginUserValidation, Authcontroller.loginUser); // Define POST route for login with validation and controller

router.get("/me", authMiddleware.authMiddleware, Authcontroller.getCurrentUser); // Define GET route for current user, requires auth

router.get("/logout", authMiddleware.authMiddleware, Authcontroller.logoutUser); // Define GET route for logout, requires auth

// Address routes
router.get(
  // Define GET route for user's addresses
  "/users/me/address", // Route path
  authMiddleware.authMiddleware, // Requires auth
  Authcontroller.getAddresses // Call get addresses controller
);
router.post(
  // Define POST route for adding address
  "/users/me/address", // Route path
  authMiddleware.authMiddleware, // Requires auth
  validators.addUserAddressValidation, // Apply validation
  Authcontroller.addAddress // Call add address controller
);
router.delete(
  // Define DELETE route for removing address
  "/users/me/address/:addressId", // Route path with param
  authMiddleware.authMiddleware, // Requires auth
  Authcontroller.removeAddress // Call remove address controller
);

// Change password route
router.post(
  // Define POST route for changing password
  "/change-password", // Route path
  authMiddleware.authMiddleware, // Requires auth
  validators.changePasswordValidation, // Apply validation
  Authcontroller.changePassword // Call change password controller
);

module.exports = router; // Export the router
