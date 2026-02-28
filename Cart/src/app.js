const express = require("express");
const cookieParser = require("cookie-parser");
const cartRoutes = require("../src/routes/cart.routes");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/",(req,res)=>{
    res.status(200).json({
        message:"Cart service is running"
    })
})
app.use("/api/cart", cartRoutes);

module.exports = app;
