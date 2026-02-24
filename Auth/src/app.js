const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(
  cors({
    origin: [
          "https://product-service-58x4.onrender.com/"
        ],
        accessControlAllowCredentials: true,        credentials: true,
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
