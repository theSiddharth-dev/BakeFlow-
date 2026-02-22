const axios = require("axios");

require("dotenv").config();
const Razorpay = require("razorpay");
const paymentModel = require("../models/payment.model");
const { publishtoQueue } = require("../Broker/Broker.js");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createPayment = async (req, res) => {
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  // http://localhost:3003/api/orders/
  try {
    const orderId = req.params.orderId;
    const orderResponse = await axios.get(
      `${process.env.ORDER_SERVICE_URL}/api/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const price = orderResponse.data.order.totalPrice;

    const order = await razorpay.orders.create(price);

    const payment = await paymentModel.create({
      order: orderId,
      razorpayOrderId: order.id,
      paymentMethod:order.paymentMethod,
      user: req.user.id,
      price: {
        amount: order.amount,
        currency: order.currency,
      },
    });

    await publishtoQueue("PAYMENT_SELLER_DASHBOARD.PAYMENT_CREATED", payment);

    await publishtoQueue("PAYMENT_NOTIFICATION.PAYMENT_INITIATED",{
      email: req.user.email,
      orderId: orderId,
      amount: price.amount / 100,
      currency: price.currency,
      username: req.user.username,
    })

    return res.status(201).json({
      message: "Payment initiated ",
      payment,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

const verifyPayment = async(req, res) => {
  const { razorpayOrderId, paymentId, signature } = req.body;
  const secret = process.env.RAZORPAY_KEY_SECRET;

  try {
    const {validatePaymentVerification} = require("../../node_modules/razorpay/dist/utils/razorpay-utils.js");

    // Validate the payment signature
    const isValid = validatePaymentVerification(
      {
        order_id: razorpayOrderId,
        payment_id: paymentId,
      },
      signature,
      secret,
    );

    if(!isValid){
      return res.status(400).json({
        message: "Invalid payment signature",
      });
    }

    const payment = await paymentModel.findOne({razorpayOrderId,status:"PENDING"});

    if(!payment){
      return res.status(404).json({
        message:"Payment not found"
      })
    }

    payment.paymentId = paymentId;
    payment.signature = signature;
    payment.status = "COMPLETED";

    await payment.save();

    // Publish payment verification event to RabbitMQ
    await publishtoQueue("PAYMENT_NOTIFICATION.PAYMENT_COMPLETED",
    {
      email: req.user.email,
      orderId: payment.order,
      paymentId: payment.paymentId,
      paymentMethod: payment.paymentMethod,
      amount: payment.price.amount / 100,
      currency: payment.price.currency,
      fullName:req.user.fullName
    })

    await publishtoQueue("PAYMENT_SELLER_DASHBOARD.PAYMENT_UPDATE", payment);

    return res.status(200).json({
      message: "Payment verified successfully",
      payment,
    });
  
  }catch(err) {

    // Publish payment failure event to RabbitMQ
    await publishtoQueue("PAYMENT_NOTIFICATION.PAYMENT_FAILED",
      {
        email:req.user.email,
        orderId: razorpayOrderId,
        paymentId: paymentId,
        fullName: req.user.fullName

      })

    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

module.exports = { createPayment, verifyPayment };
