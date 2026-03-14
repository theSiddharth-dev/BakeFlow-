const { subscribeToQueue } = require("../Broker/Broker");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");

module.exports = async function () {
  subscribeToQueue("AUTH_SELLER_DASHBOARD.USER_CREATED", async (user) => {
    await userModel.create(user);
  });

  subscribeToQueue(
    "PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED",
    async (product) => {
      await productModel.create(product);
    },
  );

  subscribeToQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", async (order) => {
    await orderModel.create(order);
  });

  subscribeToQueue("ORDER_SELLER_DASHBOARD.ORDER_UPDATED", async (order) => {
    const { _id, ...orderData } = order;
    await orderModel.findByIdAndUpdate(
      _id,
      { $set: orderData },
      { new: true, upsert: true },
    );
  });

  subscribeToQueue(
    "PAYMENT_SELLER_DASHBOARD.PAYMENT_CREATED",
    async (payment) => {
      await paymentModel.create(payment);
    },
  );

  subscribeToQueue(
    "PAYMENT_SELLER_DASHBOARD.PAYMENT_UPDATE",
    async (payment) => {
      await paymentModel.findOneAndUpdate(
        { order: payment.order },
        { ...payment },
        { new: true },
      );
    },
  );
};
