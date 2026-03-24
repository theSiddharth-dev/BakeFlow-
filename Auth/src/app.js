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
        "https://cart-service-qxtm.onrender.com",
        "https://order-service-2ggi.onrender.com",
        "https://payment-service-q53e.onrender.com",
        "https://notification-service-oghw.onrender.com",
        "https://seller-dashboard-service.onrender.com"
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
