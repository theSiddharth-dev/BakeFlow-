const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(
  cors({
    origin: [
        "http://localhost:5173",
        "https://auth-service-j068.onrender.com",
        "https://product-service-58x4.onrender.com/",
        "https://cart-service-2gl6.onrender.com",
        "https://order-service-6rqj.onrender.com",
        "https://payment-service-vz31.onrender.com",
        ],
        accessControlAllowCredentials: true,  
        credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Auth service is running ",
  });
});

app.use("/api/auth", authRoutes);

module.exports = app;
