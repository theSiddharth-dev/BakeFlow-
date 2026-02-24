const express = require("express");
const multer = require("multer");
const productController = require("../Controllers/Product.controller");
const createAuthMiddleware = require("../middlewares/Auth.middleware");
const { validateProduct } = require("../validations/product.validation");

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// POST /api/products/
router.post(
  "/",
  createAuthMiddleware(["owner"]),
  upload.array("images", 5),
  validateProduct,
  productController.createProduct
);

// GET /api/products
router.get("/", productController.getProducts);

// GET /api/products/owner - MOVED BEFORE /:id
router.get(
  "/owner",
  createAuthMiddleware(["owner"]),
  productController.getProductsByOwner
);

// GET /api/products/:id
router.get("/:id", productController.getProductById);

// PATCH /api/products/:id
router.patch(
  "/:id",
  createAuthMiddleware(["owner"]),
  productController.updateProduct
);

// DELETE /api/products/:id
router.delete(
  "/:id",
  createAuthMiddleware(["owner"]),
  productController.deleteProduct
);

module.exports = router;