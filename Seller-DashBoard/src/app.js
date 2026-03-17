const express = require("express");
const cors = require("cors");

const cookieParser = require("cookie-parser");
const sellerRoutes = require("./routes/seller.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({ message: "Seller Dashboard service is running" });
});

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
      "http://localhost:3007",
    ],
    accessControlAllowCredentials: true,
    credentials: true,
  }),
);

app.use("/api/seller/dashboard", sellerRoutes);

module.exports = app;
