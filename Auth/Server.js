require("dotenv").config();
const app = require("./src/app");
const { Connect } = require("./src/Broker/Broker");
const ConnecttoDB = require("./src/db/db");

// connect to auth database
ConnecttoDB();

// Make the connection with RabbitMQ for notification
Connect(); 

app.listen(3000, () => {
  
  console.log("Auth service is running on port number 3000"); 
});
