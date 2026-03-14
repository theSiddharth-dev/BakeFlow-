const express = require("express");
const cookieParser = require("cookie-parser");
const OrderRoutes = require("../src/routes/order.routes");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://auth-service-j068.onrender.com",
      "https://product-service-58x4.onrender.com",
      "https://cart-service-2gl6.onrender.com",
      "https://order-service-6rqj.onrender.com",
      "https://payment-service-vz31.onrender.com",
      "https://seller-dashboard-service.onrender.com"
    ],
    accessControlAllowCredentials: true,
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Order service is running",
  });
});

(app.use("/api/orders", OrderRoutes), (module.exports = app));
