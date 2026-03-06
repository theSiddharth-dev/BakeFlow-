const express = require('express')
const cookieParser = require('cookie-parser')
const paymentRoutes = require('./routes/payment.routes')
const cors = require('cors')

const app = express();


app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003"
    ],
    accessControlAllowCredentials: true,
    credentials: true,
  }),
);


app.get("/",(req,res)=>{
    res.status(200).json({
        message:"Payment service is running"
    })
})

app.use('/api/payments',paymentRoutes);

module.exports = app;