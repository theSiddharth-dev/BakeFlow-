require('dotenv').config();
const app = require('./src/app');
const ConnecttoDb = require('./src/db/db');
const {Connect} = require("./src/Broker/Broker")

ConnecttoDb();

Connect();

const PORT = process.env.PORT || 3004
app.listen(PORT,()=>{
    console.log(`Payment service is running on port ${PORT}`);
})