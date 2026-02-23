require("dotenv").config();
const app = require("./src/app");
const ConnecttoDB = require("./src/db/db")
const {Connect}  = require("./src/Broker/Broker")


ConnecttoDB();
Connect();

const PORT = process.env.PORT || 3001

app.listen(PORT,()=>{
    console.log(`Product Service is running on the port number ${PORT}`);
})

