const express = require("express");
const createAuthMiddleware = require("../Middlewares/auth.middleware");
const controller = require("../Controllers/seller.controller");

const router = express.Router();

router.get("/metrics", createAuthMiddleware(["owner"]), controller.getMetrics);

router.get("/orders", createAuthMiddleware(["owner"]), controller.getOrders);

router.get(
  "/products",
  createAuthMiddleware(["owner"]),
  controller.getProducts,
);

module.exports = router;
