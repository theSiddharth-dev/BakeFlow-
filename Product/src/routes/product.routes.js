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
<<<<<<< HEAD
  productController.createProduct,
=======
  productController.createProduct
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
);

// GET /api/products
router.get("/", productController.getProducts);

// GET /api/products/owner - MOVED BEFORE /:id
router.get(
  "/owner",
  createAuthMiddleware(["owner"]),
<<<<<<< HEAD
  productController.getProductsByOwner,
);

// POST /api/products/inventory/reserve
router.post(
  "/inventory/reserve",
  createAuthMiddleware(["user", "owner", "admin"]),
  productController.reserveInventory,
);

// POST /api/products/inventory/release
router.post(
  "/inventory/release",
  createAuthMiddleware(["user", "owner", "admin"]),
  productController.releaseInventory,
=======
  productController.getProductsByOwner
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
);

// GET /api/products/:id
router.get("/:id", productController.getProductById);

// PATCH /api/products/:id
router.patch(
  "/:id",
  createAuthMiddleware(["owner"]),
<<<<<<< HEAD
  productController.updateProduct,
=======
  productController.updateProduct
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
);

// DELETE /api/products/:id
router.delete(
  "/:id",
  createAuthMiddleware(["owner"]),
<<<<<<< HEAD
  productController.deleteProduct,
);

module.exports = router;
=======
  productController.deleteProduct
);

module.exports = router;
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
