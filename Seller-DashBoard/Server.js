require("dotenv").config();
const app = require("./src/app");
const connectDb = require("./src/db/db");
const { Connect } = require("./src/Broker/Broker");
const listener = require("./src/Broker/Listener");

connectDb();
Connect().then(() => {
  listener();
});

app.listen(3007, () => {
  console.log("Seller DashBoard Service is running on port number 3007");
});
