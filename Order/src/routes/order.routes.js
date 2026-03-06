const express = require("express");

const router = express.Router();
const createauthmiddleware = require("../Middlewares/auth.middlewares");
const OrderController = require("../Controllers/Order.controller");
const validation = require("../Middlewares/validation.middleware");

router.post(
  "/",
  createauthmiddleware(["user"]),
  validation.createOrderValidation,
  OrderController.createOrder,
);

router.get("/me", createauthmiddleware(["user"]), OrderController.getMyOrder);

router.post(
  "/:id/cancel",
  createauthmiddleware(["user"]),
  OrderController.cancelOrderById,
);

router.patch(
  "/:id/address",
  createauthmiddleware(["user"]),
  validation.updateOrderAddressValidation,
  OrderController.updateOrderAddress,
);

router.patch(
  "/:id/complete",
  createauthmiddleware(["user"]),
  OrderController.completeOrderById,
);

router.get(
  "/:id",
  createauthmiddleware(["user", "owner"]),
  OrderController.getOrderById,
);

module.exports = router;
