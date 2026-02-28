require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/db/db");


connectDB();

app.listen(3002,()=>{
    console.log("Cart Service is running on the port number 3002");
})

