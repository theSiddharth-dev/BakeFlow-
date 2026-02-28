const express = require("express");
const productRoutes = require("./routes/product.routes");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: [
<<<<<<< HEAD
      "http://localhost:5173",
      "https://auth-service-j068.onrender.com/",
    ],
    accessControlAllowCredentials:true,
=======
      "https://auth-service-j068.onrender.com/",
      "https://product-service-58x4.onrender.com/"
    ],
    accessControlAllowCredentials: true,
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
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
