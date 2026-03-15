require("dotenv").config();
const app = require("./src/app");
const ConnecttoDb = require("./src/db/db");
const {Connect} = require("./src/Broker/Broker")

ConnecttoDb();
Connect();

const PORT = process.env.PORT 
app.listen(PORT, ()=>{
    console.log(`Order service is running on port number${PORT} `)
})
