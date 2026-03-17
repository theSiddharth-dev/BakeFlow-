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
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3006",
      "http://localhost:3007"
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
