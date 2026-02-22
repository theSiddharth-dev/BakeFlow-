const { body, validationResult } = require("express-validator");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};


// Validation rules for product creation
const validateProduct = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .isString()
    .withMessage("Title must be a string"),
  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),
  body("priceAmount")
    .notEmpty()
    .withMessage("Price amount is required")
    .isNumeric()
    .withMessage("Price amount must be a number")
    .custom((value) => parseFloat(value) > 0)
    .withMessage("Price amount must be positive"),
  body("priceCurrency")
    .optional()
    .isString()
    .withMessage("Price currency must be a string")
    .isIn(["INR", "USD", "EUR"])
    .withMessage("Invalid currency"),
    handleValidationErrors
];



module.exports = {
  validateProduct
};
