const { subscribeToQueue } = require("../Broker/Broker");
const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");

module.exports = async function () {
  subscribeToQueue("AUTH_SELLER_DASHBOARD.USER_CREATED", async (user) => {
    await userModel.create(user);
  });

  subscribeToQueue("AUTH_SELLER_DASHBOARD.USER_DELETED", async (data) => {
    const userId = data?.id || data?._id;
    if (!userId) return;

    await userModel.findByIdAndDelete(userId);
  });

  subscribeToQueue(
    "PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED",
    async (product) => {
      await productModel.create(product);
    },
  );

  subscribeToQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", async (order) => {
    const completedAt =
      order?.status === "COMPLETED"
        ? order?.completedAt ||
          order?.createdAt ||
          order?.updatedAt ||
          new Date()
        : undefined;

    await orderModel.create({
      ...order,
      ...(completedAt ? { completedAt } : {}),
    });
  });

  subscribeToQueue("ORDER_SELLER_DASHBOARD.ORDER_UPDATED", async (order) => {
    const { _id, ...orderData } = order;

    const existingOrder = await orderModel
      .findById(_id)
      .select("status completedAt createdAt");

    let completedAt = existingOrder?.completedAt;

    const becameCompleted =
      existingOrder &&
      existingOrder.status !== "COMPLETED" &&
      orderData?.status === "COMPLETED";

    const isCompletedWithoutTimestamp =
      existingOrder &&
      existingOrder.status === "COMPLETED" &&
      orderData?.status === "COMPLETED" &&
      !existingOrder?.completedAt;

    if (!completedAt && becameCompleted) {
      completedAt =
        orderData?.completedAt || orderData?.updatedAt || new Date();
    } else if (!completedAt && isCompletedWithoutTimestamp) {
      completedAt = existingOrder.createdAt;
    } else if (
      !completedAt &&
      !existingOrder &&
      orderData?.status === "COMPLETED"
    ) {
      completedAt =
        orderData?.completedAt ||
        orderData?.createdAt ||
        orderData?.updatedAt ||
        new Date();
    }

    const safeOrderData = { ...orderData };
    delete safeOrderData._id; // 🚨 CRITICAL FIX

    await orderModel.findByIdAndUpdate(
      _id,
      {
        $set: {
          ...safeOrderData,
          ...(completedAt ? { completedAt } : {}),
        },
      },
      {
        upsert: true,
        returnDocument: "after", // ✅ fix warning also
      },
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
      const paymentData = { ...payment };
      delete paymentData._id; // 🚨 IMPORTANT

      await paymentModel.findOneAndUpdate(
        { order: payment.order },
        { $set: paymentData },
        { returnDocument: "after" },
      );
    },
  );
};
