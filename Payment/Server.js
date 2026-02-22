require('dotenv').config();
const app = require('./src/app');
const ConnecttoDb = require('./src/db/db');
const {Connect} = require("./src/Broker/Broker")

ConnecttoDb();

Connect();

app.listen(3004,()=>{
    console.log("Payment service is running on port 3004");
})