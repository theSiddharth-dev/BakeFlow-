const { body, param, validationResult } = require("express-validator");

const mongoose = require("mongoose");

const validateResult = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const validateAddItemInCart = [
  body("productId")
    .isString()
    .withMessage("Product ID must be string")
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("Invalid Product ID format"),
  body("qty")
    .isInt({ gt: 0 })
    .withMessage("Quantity must be a positive integer"),
  validateResult,
];

const validateUpdateItemInCart = [
  param("productId")
    .isString()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("Invalid Product ID format"),
  body("qty")
    .isInt({ gt: 0 })
    .withMessage("Quantity must be a positive integer"),
  // productId comes from params for update; validate via custom middleware
  validateResult,
];

const validateDeleteItemInCart = [
  param("productId")
    .isString()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage("Invalid Product ID format"),
  validateResult,
];

module.exports = {
  validateAddItemInCart,
  validateUpdateItemInCart,
  validateDeleteItemInCart,
};
