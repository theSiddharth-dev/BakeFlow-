const axios = require("axios");
const mongoose = require("mongoose");
const orderModel = require("../models/order.model");
const { publishtoQueue } = require("./../Broker/Broker");

const TAX_RATE = 0.18;

const mapInventoryItems = (items = []) => {
  return items.map((item) => ({
    productId: item.productId || item.product?.toString(),
    quantity: Number(item.quantity),
  }));
};

const createOrder = async (req, res) => {
  const user = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  try {
    // 1️⃣ Fetch cart items
    const cartResponse = await axios.get(
      `${process.env.CART_SERVICE_URL}/items`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const cartItems = cartResponse.data.items;

    if (!cartItems || cartItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Cart is empty. Cannot create order." });
    }

    // 2️⃣ Fetch all product details
    const productRequests = cartItems.map((item) =>
      axios.get(`${process.env.PRODUCT_SERVICE_URL}/${item.productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const productResponses = await Promise.all(productRequests);
    const products = productResponses.map((res) => res.data.product);

    let priceAmount = 0;

    // 3️⃣ Check stock
    for (const item of cartItems) {
      const product = products.find(
        (p) => p._id.toString() === item.productId.toString(),
      );

      if (!product) {
        return res.status(404).json({
          message: `Product not found: ${item.productId}`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Product ${product.title} has insufficient stock`,
        });
      }
    }

    // 4️⃣ Create order items
    const orderItems = cartItems.map((item) => {
      const product = products.find(
        (p) => p._id.toString() === item.productId.toString(),
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
        costPrice: {
          amount:
            Number(product.costPrice?.amount || 0) * Number(item.quantity),
          currency: product.costPrice?.currency || product.price.currency,
        },
      };
    });

    const taxAmount = Math.round(priceAmount * TAX_RATE);
    const totalAmount = priceAmount + taxAmount;

    const inventoryItems = cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    // 5️⃣ Reserve inventory
    await axios.post(
      `${process.env.PRODUCT_SERVICE_URL}/inventory/reserve`,
      { items: inventoryItems },
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    let order;

    try {
      // 6️⃣ Create order (ONLY ONCE)
      order = await orderModel.create({
        user: user.id,
        items: orderItems,
        status: "PENDING",
        totalPrice: {
          amount: totalAmount,
          currency: "INR",
        },
        shippingAddress: req.body.shippingAddress,
      });
    } catch (orderCreateError) {
      // 7️⃣ Release inventory if order fails
      await axios.post(
        `${process.env.PRODUCT_SERVICE_URL}/inventory/release`,
        { items: inventoryItems },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      throw orderCreateError;
    }

    // 8️⃣ Publish event
    await publishtoQueue("ORDER_SELLER_DASHBOARD.ORDER_CREATED", order);

    res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (err) {
    console.log(err);

    if (err.response?.status) {
      return res.status(err.response.status).json({
        message:
          err.response?.data?.message || "Inventory or product service failed",
      });
    }

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
  if (order.status === "SHIPPED") {
    timeline.push({
      status: "SHIPPED",
      timestamp: order.updatedAt,
      message: "Order has been shipped",
    });
  }

  if (
    order.status === "DELIVERED" ||
    order.status === "COMPLETED" ||
    order.status === "CONFIRMED"
  ) {
    timeline.push({
      status: "DELIVERED",
      timestamp: order.updatedAt,
      message: "Order has been delivered",
    });
  }

  if (order.status === "COMPLETED" || order.status === "CONFIRMED") {
    timeline.push({
      status: order.status,
      timestamp: order.updatedAt,
      message:
        order.status === "CONFIRMED" ? "Order confirmed" : "Order completed",
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
  const subtotal = order.items.reduce(
    (sum, item) => sum + (item.price?.amount || 0),
    0,
  );
  const currency = order.totalPrice.currency;

  const tax = Math.round(subtotal * TAX_RATE);

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
    shipping: {
      amount: shipping,
      currency: currency,
    },
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

  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

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

    if (order.status === "COMPLETED" || order.status === "CONFIRMED") {
      return res.status(400).json({
        message: `Order cannot be cancelled as it has already been ${order.status.toLowerCase()}`,
      });
    }

    // Only pending orders can be cancelled
    if (order.status !== "PENDING") {
      return res.status(400).json({
        message: "Order cannot be cancelled at this stage",
      });
    }

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

    // Update order status to CANCELLED
    order.status = "CANCELLED";
    await order.save();

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

    if (order.status === "COMPLETED" || order.status === "CONFIRMED") {
      return res.status(400).json({
        message: `Cannot update address - Order has already been ${order.status.toLowerCase()}`,
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

const completeOrderById = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;

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
        message: "Forbidden - You don't have access to this order",
      });
    }

    if (order.status === "COMPLETED" || order.status === "CONFIRMED") {
      return res.status(200).json({
        message: `Order already ${order.status.toLowerCase()}`,
        order,
      });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({
        message: "Cannot complete a cancelled order",
      });
    }

    order.status = "CONFIRMED";
    await order.save();

    return res.status(200).json({
      message: "Order confirmed successfully",
      order,
    });
  } catch (err) {
    return res.status(500).json({
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
  completeOrderById,
};
