const { body, validationResult } = require("express-validator");

const respondValidationErrors = (req, res, next) => {
  // Define middleware to handle validation errors
  const errors = validationResult(req); // Get validation errors from request

  if (!errors.isEmpty()) {
    // If there are errors
    return res.status(400).json({ errors: errors.array() }); // Return bad request with errors
  }
  next(); // Proceed if no errors
};

const respondValidationErrorsForAddress = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Check if the error is specifically about missing shippingAddress
    const hasShippingAddressError = errors
      .array()
      .some((error) => error.path === "shippingAddress");

    if (hasShippingAddressError) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const createOrderValidation = [
  // Array of validation rules for adding address
  body("shippingAddress.street") // Validate street
    .isString() // Must be string
    .withMessage("street must be String") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Street is required"), // Error message
  body("shippingAddress.city") // Validate city
    .isString() // Must be string
    .withMessage("city is required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("City is required"), // Error message
  body("shippingAddress.state") // Validate state
    .isString() // Must be string
    .withMessage("state is required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("State is required"), // Error message
  body("shippingAddress.pincode") // Validate pincode
    .isString() // Must be string
    .withMessage("Pincode must be a string") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Pincode is required") // Error message
    .isPostalCode("IN") // Must be valid Indian postal code
    .withMessage("Invalid pincode"), // Error message
  body("shippingAddress.country") // Validate country
    .isString() // Must be string
    .withMessage("Country must be required") // Error message
    .notEmpty() // Cannot be empty
    .withMessage("Country is required"), // Error message
  respondValidationErrors, // Include error response middleware
];

const updateOrderAddressValidation = [
  body("shippingAddress").exists().withMessage("Shipping address is required"),
  body("shippingAddress.street")
    .isString()
    .withMessage("Street must be a string")
    .notEmpty()
    .withMessage("Street is required"),
  body("shippingAddress.city")
    .isString()
    .withMessage("City must be a string")
    .notEmpty()
    .withMessage("City is required"),
  body("shippingAddress.state")
    .isString()
    .withMessage("State must be a string")
    .notEmpty()
    .withMessage("State is required"),
  body("shippingAddress.pincode")
    .isString()
    .withMessage("Pincode must be a string")
    .notEmpty()
    .withMessage("Pincode is required")
    .isPostalCode("IN")
    .withMessage("Invalid pincode"),
  body("shippingAddress.country")
    .isString()
    .withMessage("Country must be a string")
    .notEmpty()
    .withMessage("Country is required"),
  respondValidationErrorsForAddress,
];

module.exports = {
  createOrderValidation,
  updateOrderAddressValidation,
};
