const { body, validationResult } = require("express-validator"); // Import validation functions from express-validator

const respondValidationErrors = (req, res, next) => {
  // Define middleware to handle validation errors
  const errors = validationResult(req); // Get validation errors from request

  if (!errors.isEmpty()) {
    // If there are errors
    return res.status(400).json({ errors: errors.array() }); // Return bad request with errors
  }
  next(); // Proceed if no errors
};

const registerUserValidation = [
  // Array of validation rules for user registration
  body("username") // Validate username field
    .isString() // Must be a string
    .withMessage("Username must be a string") // Error message
    .isLength({ min: 3 }) // Minimum length 3
    .withMessage("Username must be at least 3 characters length"), // Error message
  body("email").isString().withMessage("Invalid email address"), // Validate email as string
  body("password") // Validate password
    .isLength({ min: 6 }) // Minimum length 6
    .withMessage("Password must be atleast 6 characters long"), // Error message
  body("fullName.firstName") // Validate first name
    .isString() // Must be string
    .withMessage("First name must be string") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("First Name is required"), // Error message
  body("fullName.lastName") // Validate last name
    .isString() // Must be string
    .withMessage("Last name must be string") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Last name is required"), // Error message
  respondValidationErrors, // Include error response middleware
];

const loginUserValidation = [
  // Array of validation rules for user login
  body("email").optional().isEmail().withMessage("Invalid email address"), // Email optional, must be valid email
  body("username").optional().isString().withMessage("Invalid username"), // Username optional, must be string
  body("password") // Validate password
    .isLength({ min: 6 }) // Minimum length 6
    .notEmpty() // Cannot be empty
    .withMessage("Password must be atleast 6 digit"), // Error message
  (req, res, next) => {
    // Custom validation function
    if (!req.body.email && !req.body.username) {
      // If neither email nor username provided
      return res // Return error
        .status(400)
        .json({ errors: [{ msg: "Either email or username is required" }] });
    }
    respondValidationErrors(req, res, next); // Check for other errors
  },
];

const addUserAddressValidation = [
  // Array of validation rules for adding address
  body("street") // Validate street
    .isString() // Must be string
    .withMessage("street must be String") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Street is required"), // Error message
  body("city") // Validate city
    .isString() // Must be string
    .withMessage("city is required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("City is required"), // Error message
  body("state") // Validate state
    .isString() // Must be string
    .withMessage("state is required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("State is required"), // Error message
  body("pincode") // Validate pincode
    .isString() // Must be string
    .withMessage("Pincode must be a string") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Pincode is required") // Error message
    .isPostalCode("IN") // Must be valid Indian postal code
    .withMessage("Invalid pincode"), // Error message
  body("country") // Validate country
    .isString() // Must be string
    .withMessage("Country must be required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Country is required"), // Error message
  body("isDefault") // Validate isDefault
    .optional() // Optional field
    .isBoolean() // Must be boolean
    .withMessage("isDefault must be a boolean"), // Error message
  body("role") // Validate role
    .optional() // Optional field
    .isIn(["user", "owner"]) // Must be one of the values
    .withMessage("Role must be either 'user' or 'owner' "), // Error message
  respondValidationErrors, // Include error response middleware
];

module.exports = {
  // Export validation arrays
  registerUserValidation,
  loginUserValidation,
  addUserAddressValidation,
};
