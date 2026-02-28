const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(
  cors({
    origin: [
<<<<<<< HEAD
          "http://localhost:5173",
          "https://product-service-58x4.onrender.com/"
        ],
        accessControlAllowCredentials: true,  
        credentials: true,
=======
          "https://product-service-58x4.onrender.com/"
        ],
        accessControlAllowCredentials: true,        credentials: true,
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
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
