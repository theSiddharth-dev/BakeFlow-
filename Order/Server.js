require("dotenv").config();
const app = require("./src/app");
const ConnecttoDb = require("./src/db/db");
const {Connect} = require("./src/Broker/Broker")

ConnecttoDb();
Connect();

app.listen(3003, ()=>{
    console.log("Order service is running on port number 3003")
})
