const express = require("express");
const cookieParser = require("cookie-parser");
const cartRoutes = require("../src/routes/cart.routes");
const cors = require('cors');
const app = express();


app.use(express.json());
app.use(cookieParser());


app.use(
  cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:3002",
        "https://product-service-58x4.onrender.com/"
        ],
        accessControlAllowCredentials: true,  
        credentials: true,
  }),
);
app.use("/api/cart", cartRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Cart service is running",
  });
});

module.exports = app;
