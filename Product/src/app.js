const express = require("express");
const productRoutes = require("./routes/product.routes");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/',(req,res)=>{
    res.status(200).json({
        message:"Product service is running"
    })
})

app.use("/api/products", productRoutes);

module.exports = app;
