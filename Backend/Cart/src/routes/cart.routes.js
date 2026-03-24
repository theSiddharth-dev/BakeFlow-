const createAuthMiddleware = require("../middlewares/auth.middleware");
const cartController = require("../controllers/cart.controller");
const validation = require("../middlewares/validation.middleware");

const express = require("express");

const router = express.Router();

router.get(
  "/items",
  createAuthMiddleware(["user"]),
  cartController.getCartItems,
);

router.post(
  "/items",
  validation.validateAddItemInCart,
  createAuthMiddleware(["user"]),
  cartController.addItemToCart,
);

router.patch(
  "/items/:productId",
  validation.validateUpdateItemInCart,
  createAuthMiddleware(["user"]),
  cartController.updateCartItemQuantity,
);

router.delete(
  "/items/:productId",
  validation.validateDeleteItemInCart,
  createAuthMiddleware(["user"]),
  cartController.deleteItemFromCart,
);

router.delete("/", createAuthMiddleware(["user"]), cartController.clearCart);

module.exports = router;
