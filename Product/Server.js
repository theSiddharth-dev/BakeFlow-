require("dotenv").config();
const app = require("./src/app");
const ConnecttoDB = require("./src/db/db")
const {Connect}  = require("./src/Broker/Broker")


ConnecttoDB();
Connect();

app.listen(3001,()=>{
    console.log("Product Service is running on the port number 3001");
})

