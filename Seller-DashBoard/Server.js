require("dotenv").config();
const app = require("./src/app");
const connectDb = require("./src/db/db");
const { Connect } = require("./src/Broker/Broker");
const listener = require("./src/Broker/Listener");

connectDb();
Connect().then(() => {
  listener();
})

const PORT = process.env.PORT

app.listen(PORT, () => {
  console.log(`Seller DashBoard Service is running on port number ${PORT} `);
});
