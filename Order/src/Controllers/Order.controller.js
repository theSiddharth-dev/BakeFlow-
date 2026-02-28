const axios = require("axios");
const mongoose = require("mongoose");
const orderModel = require("../models/order.model");
<<<<<<< HEAD
const { publishtoQueue } = require("./../Broker/Broker");

const mapInventoryItems = (items = []) => {
  return items.map((item) => ({
    productId: item.productId || item.product?.toString(),
    quantity: Number(item.quantity),
  }));
};
=======
const {publishtoQueue} = require('./../Broker/Broker')
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

const createOrder = async (req, res) => {
  const user = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  // http://localhost:3002/api/cart/items

  try {
    // fetch user cart from cart service
    const cartResponse = await axios.get(
      `${process.env.CART_SERVICE_URL}/items`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (cartResponse.data.items.length === 0) {
      return res
        .status(400)
        .json({ message: "Cart is empty. Cannot create order." });
    }
<<<<<<< HEAD
    // http://localhost:3001/api/products/${item.productId}
=======
// http://localhost:3001/api/products/${item.productId}
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

    const products = await Promise.all(
      cartResponse.data.items.map(async (item) => {
        const resp = await axios.get(
          `${process.env.PRODUCT_SERVICE_URL}/${item.productId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        return resp.data.product;
      }),
    );

    console.log(products);

    let priceAmount = 0;

    // Check stock before creating order items
    const insufficient = cartResponse.data.items.find((item) => {
      const product = products.find(
        (p) => p._id?.toString() === item.productId?.toString(),
      );
      return product && product.stock < item.quantity;
    });

    if (insufficient) {
      const product = products.find(
        (p) => p._id?.toString() === insufficient.productId?.toString(),
      );
      return res.status(400).json({
        message: `Product ${product?.title || ""} has insufficient stock`,
      });
    }

    const orderItems = cartResponse.data.items.map((item) => {
      const product = products.find(
        (p) => p._id?.toString() === item.productId?.toString(),
      );

      const itemTotal = product.price.amount * item.quantity;
      priceAmount += itemTotal;

      return {
        product: item.productId,
        quantity: item.quantity,
        price: {
          amount: itemTotal,
          currency: product.price.currency,
        },
      };
    });

<<<<<<< HEAD
    const inventoryItems = mapInventoryItems(cartResponse.data.items);

    await axios.post(
      `${process.env.PRODUCT_SERVICE_URL}/inventory/reserve`,
      { items: inventoryItems },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    let order;

    try {
      order = await orderModel.create({
        user: user.id,
        items: orderItems,
        status: "PENDING",
        totalPrice: {
          amount: priceAmount,
          currency: "INR",
        },
        shippingAddress: req.body.shippingAddress,
      });
    } catch (orderCreateError) {
      try {
        await axios.post(
          `${process.env.PRODUCT_SERVICE_URL}/inventory/release`,
          { items: inventoryItems },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } catch (releaseError) {
        console.log(
          "Inventory release failed after order create error",
          releaseError.message,
        );
      }

      throw orderCreateError;
    }

    // publish order created event to broker for seller dashboard
    await publishtoQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", order);
=======
    const order = await orderModel.create({
      user: user.id,
      items: orderItems,
      status: "PENDING",
      totalPrice: {
        amount: priceAmount,
        currency: "INR",
      },
      shippingAddress: req.body.shippingAddress,
    });

    // publish order created event to broker for seller dashboard
    await publishtoQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED",order)
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

    res.status(201).json({
      message: "Order created Successfully",
      order: order,
    });
  } catch (err) {
<<<<<<< HEAD
    console.log(err);

    if (err.response?.status) {
      return res.status(err.response.status).json({
        message: err.response?.data?.message || "Inventory operation failed",
      });
    }

=======
    console.log(err)
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

const getMyOrder = async (req, res) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({
      message: "Unauthorized User",
    });
  }

  const page = req.query.page ? parseInt(req.query.page) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;

  // if pagination parameters are invalid return 400
  if (isNaN(page) || isNaN(limit) || page <= 0 || limit <= 0) {
    return res.status(400).json({
      message: "Invalid pagination parameters",
    });
  }

  const skip = (page - 1) * limit;
  try {
    const orders = await orderModel
      .find({ user: user.id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalOrders = await orderModel.countDocuments({ user: user.id });

    if (orders.length === 0) {
      return res.status(404).json({
        message: "No Orders found",
      });
    }

    res.status(200).json({
      orders,
      meta: {
        total: totalOrders,
        page,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const getOrderById = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;

  // Validate if orderId is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      message: "Invalid order ID format",
    });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Check if user is authorized to view this order
    // Admin can view any order, user can only view their own
    if (user.role !== "admin" && order.user.toString() !== user.id) {
      return res.status(403).json({
        message: "Forbidden - You don't have access to this order",
      });
    }

    // Build timeline based on order status
    const timeline = buildTimeline(order);

    // Build payment summary
    const paymentSummary = buildPaymentSummary(order);

    res.status(200).json({
      order,
      timeline,
      paymentSummary,
    });
  } catch (err) {
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

// Helper function to build timeline
const buildTimeline = (order) => {
  const timeline = [];

  // Add created event
  timeline.push({
    status: "PENDING",
    timestamp: order.createdAt,
    message: "Order placed successfully",
  });

  // Add status-specific events based on current status
  if (
    order.status === "SHIPPED" ||
    order.status === "DELIVERED" ||
    order.status === "COMPLETED"
  ) {
    timeline.push({
      status: "SHIPPED",
      timestamp: order.updatedAt,
      message: "Order has been shipped",
    });
  }

  if (order.status === "DELIVERED" || order.status === "COMPLETED") {
    timeline.push({
      status: "DELIVERED",
      timestamp: order.updatedAt,
      message: "Order has been delivered",
    });
  }

  if (order.status === "COMPLETED") {
    timeline.push({
      status: "COMPLETED",
      timestamp: order.updatedAt,
      message: "Order completed",
    });
  }

  if (order.status === "CANCELLED") {
    timeline.push({
      status: "CANCELLED",
      timestamp: order.updatedAt,
      message: "Order has been cancelled",
    });
  }

  return timeline;
};

// Helper function to build payment summary
const buildPaymentSummary = (order) => {
  const subtotal = order.totalPrice.amount;
  const currency = order.totalPrice.currency;

  // Calculate tax (if applicable) - example: 0% for now
  const tax = 0;

  // Calculate shipping (if applicable) - example: 0 for now
  const shipping = 0;

  const total = subtotal + tax + shipping;

  return {
    subtotal: {
      amount: subtotal,
      currency: currency,
    },
    tax:
      tax > 0
        ? {
            amount: tax,
            currency: currency,
          }
        : undefined,
    shipping:
      shipping > 0
        ? {
            amount: shipping,
            currency: currency,
          }
        : undefined,
    total: {
      amount: total,
      currency: currency,
    },
    currency: currency,
  };
};

const cancelOrderById = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;
<<<<<<< HEAD
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

  // Validate if orderId is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      message: "Invalid order ID format",
    });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.user.toString() !== user.id) {
      return res.status(403).json({
        message: "Forbidden: You do not have access to cancel this order",
      });
    }

    // Check if order is already cancelled
    if (order.status === "CANCELLED") {
      return res.status(400).json({
        message: "Order is already cancelled",
      });
    }

    // Check if order can be cancelled based on status
    if (order.status === "SHIPPED") {
      return res.status(400).json({
        message: "Order cannot be cancelled as it has already been shipped",
      });
    }

    if (order.status === "DELIVERED") {
      return res.status(400).json({
        message: "Order cannot be cancelled as it has already been delivered",
      });
    }

    if (order.status === "COMPLETED") {
      return res.status(400).json({
        message: "Order cannot be cancelled as it has already been completed",
      });
    }

    // Only pending orders can be cancelled
    if (order.status !== "PENDING") {
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage",
      });
    }

<<<<<<< HEAD
    const inventoryItems = order.items.map((item) => ({
      productId: item.product?.toString(),
      quantity: Number(item.quantity),
    }));

    await axios.post(
      `${process.env.PRODUCT_SERVICE_URL}/inventory/release`,
      { items: inventoryItems },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    // Update order status to CANCELLED
    try {
      order.status = "CANCELLED";
      await order.save();
    } catch (saveError) {
      try {
        await axios.post(
          `${process.env.PRODUCT_SERVICE_URL}/inventory/reserve`,
          { items: inventoryItems },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
      } catch (reserveError) {
        console.log(
          "Inventory reserve rollback failed after cancel error",
          reserveError.message,
        );
      }

      throw saveError;
    }
=======
    // Update order status to CANCELLED
    order.status = "CANCELLED";
    await order.save();
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

    res.status(200).json({
      message: "Order cancelled successfully",
      order: order,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

<<<<<<< HEAD
=======

>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
// Update order Address Controller
const updateOrderAddress = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;

  // Validate if orderId is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      message: "Invalid order ID format",
    });
  }

  // Check if shippingAddress is provided
  if (!req.body.shippingAddress) {
    return res.status(400).json({
      message: "Shipping address is required",
    });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.user.toString() !== user.id) {
      return res.status(403).json({
        message: "Forbidden - You don't have access to this order",
      });
    }

    // Check if order status allows address update
    if (order.status === "SHIPPED") {
      return res.status(400).json({
        message: "Cannot update address - Order has already been shipped",
      });
    }

    if (order.status === "DELIVERED") {
      return res.status(400).json({
        message: "Cannot update address - Order has already been delivered",
      });
    }

    if (order.status === "COMPLETED") {
      return res.status(400).json({
        message: "Cannot update address - Order has already been completed",
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        message: "Cannot update address - Order has been cancelled",
      });
    }

    if (order.status !== "PENDING") {
      return res.status(400).json({
        message: "Cannot update address at this stage",
      });
    }

    // Update the shipping address
    order.shippingAddress = {
      street: req.body.shippingAddress.street,
      city: req.body.shippingAddress.city,
      state: req.body.shippingAddress.state,
      pincode: req.body.shippingAddress.pincode,
      country: req.body.shippingAddress.country,
    };

    await order.save();

    res.status(200).json({
      message: "Shipping address updated successfully",
      order: order,
    });
  } catch (err) {
    res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

module.exports = {
  createOrder,
  getMyOrder,
  getOrderById,
  cancelOrderById,
  updateOrderAddress,
};
