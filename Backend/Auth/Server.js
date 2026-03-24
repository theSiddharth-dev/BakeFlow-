require("dotenv").config();
const app = require("./src/app");
const { Connect } = require("./src/Broker/Broker");
const ConnecttoDB = require("./src/db/db");

// connect to authentication service database
ConnecttoDB();

// Make the connection with RabbitMQ for notification
Connect(); 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  
  console.log(`Auth service is running on port number ${PORT}`); 
});
