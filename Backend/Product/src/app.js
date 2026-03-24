const express = require("express");
const productRoutes = require("./routes/product.routes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
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
      "https://bake-flow-nu.vercel.app",
      "https://auth-service-j068.onrender.com",
      "https://product-service-58x4.onrender.com",
      "https://cart-service-qxtm.onrender.com",
      "https://order-service-2ggi.onrender.com",
      "https://payment-service-q53e.onrender.com",
      "https://notification-service-oghw.onrender.com",
      "https://seller-dashboard-service.onrender.com"
    ],
    accessControlAllowCredentials:true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Product service is running",
  });
});

app.use("/api/products", productRoutes);

module.exports = app;
