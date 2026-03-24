const axios = require("axios");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const orderModel = require("../models/order.model");
const { publishtoQueue } = require("./../Broker/Broker");
const { generateReceiptPdf } = require("../services/receipt.service");
const { uploadReceiptToImageKit } = require("../services/receipt.service");

const TAX_RATE = 0.18;
const PRODUCT_BASE_URL = (process.env.PRODUCT_SERVICE_URL || "").replace(
  /\/+$/,
  "",
);
const PRODUCT_API_URL = PRODUCT_BASE_URL.endsWith("/api/products")
  ? PRODUCT_BASE_URL
  : `${PRODUCT_BASE_URL}/api/products`;
const CART_BASE_URL = (process.env.CART_SERVICE_URL || "").replace(/\/+$/, "");
const CART_API_URL = CART_BASE_URL.endsWith("/api/cart")
  ? CART_BASE_URL
  : `${CART_BASE_URL}/api/cart`;
const AUTH_BASE_URL = (
  process.env.AUTH_SERVICE_URL || "http://localhost:3000"
).replace(/\/+$/, "");
const AUTH_API_URL = AUTH_BASE_URL.endsWith("/api/auth")
  ? AUTH_BASE_URL
  : `${AUTH_BASE_URL}/api/auth`;
const OWNER_VISIBLE_STATUSES = [
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "SHIPPED",
  "COMPLETED",
  "REJECTED",
];
const OWNER_STATUS_FLOW = [
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "SHIPPED",
  "COMPLETED",
];
const OWNER_ACTIONS = {
  ACCEPT: "ACCEPT",
  REJECT: "REJECT",
  COMPLETE: "COMPLETE",
};

const publishOrderUpdateForSellerDashboard = async (order) => {
  await publishtoQueue("ORDER_SELLER_DASHBOARD.ORDER_UPDATED", order);
};

const publishOrderReadyNotification = async ({ order, token }) => {
  if (!order?.user) return;

  try {
    const response = await axios.get(
      `${AUTH_API_URL}/internal/users/${order.user.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const user = response?.data?.user;
    if (!user?.email) return;

    await publishtoQueue("ORDER_NOTIFICATION.ORDER_READY", {
      orderId: order._id,
      userId: user.id,
      email: user.email,
      username:
        user.username ||
        [user?.fullName?.firstName, user?.fullName?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        "Customer",
      status: order.status,
      updatedAt: order.updatedAt,
    });
  } catch (err) {
    console.error("Unable to publish READY notification:", err.message);
  }
};

const mapOrderStatusForOwner = (status) => {
  if (status === "CONFIRMED") return "PENDING";
  if (status === "PROCESSING") return "PROCESSING";
  if (status === "READY") return "READY";
  if (status === "SHIPPED") return "SHIPPED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "REJECTED") return "REJECTED";
  return status;
};

const mapInventoryItems = (items = []) => {
  return items.map((item) => ({
    productId: item.productId || item.product?.toString(),
    quantity: Number(item.quantity),
  }));
};

const fetchProductMapByIds = async (productIds = [], token) => {
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];

  const productEntries = await Promise.all(
    uniqueProductIds.map(async (productId) => {
      const response = await axios.get(`${PRODUCT_API_URL}/${productId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return [productId.toString(), response.data?.product || null];
    }),
  );

  return new Map(productEntries);
};

const ownerHasAccessToOrder = (order, ownerId, productMap) => {
  return order.items.some((item) => {
    const product = productMap.get(item.product?.toString());
    return product?.owner?.toString() === ownerId.toString();
  });
};

const getOwnerOrderName = (order, productMap) => {
  const names = order.items
    .map((item) => productMap.get(item.product?.toString())?.title)
    .filter(Boolean);

  const uniqueNames = [...new Set(names)];

  if (uniqueNames.length === 0) {
    return `Order ${order._id}`;
  }

  if (uniqueNames.length === 1) {
    return uniqueNames[0];
  }

  return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
};

const getOwnerOrderPaymentStatus = (status) => {
  return [
    "CONFIRMED",
    "PROCESSING",
    "READY",
    "SHIPPED",
    "COMPLETED",
    "REJECTED",
  ].includes(status)
    ? "PAID"
    : "PENDING";
};

const getNextOwnerOrderStatus = (status) => {
  const currentIndex = OWNER_STATUS_FLOW.indexOf(status);
  if (currentIndex === -1 || currentIndex === OWNER_STATUS_FLOW.length - 1) {
    return null;
  }

  return OWNER_STATUS_FLOW[currentIndex + 1];
};

const getOwnerOrderActionOptions = (status) => {
  const nextStatus = getNextOwnerOrderStatus(status);
  return nextStatus ? [nextStatus] : [];
};

const resolveCustomerName = (user) => {
  if (!user) return "Customer";
  if (user.fullName && typeof user.fullName === "object") {
    const fullName = [user.fullName.firstName, user.fullName.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) return fullName;
  }
  if (typeof user.fullName === "string" && user.fullName.trim()) {
    return user.fullName.trim();
  }
  return user.username || "Customer";
};

const getReceiptItems = async (order, token) => {
  const productIds = order.items.map((item) => item.product?.toString());
  let productMap = new Map();

  try {
    productMap = await fetchProductMapByIds(productIds, token);
  } catch (error) {
    productMap = new Map();
  }

  return order.items.map((item) => {
    const product = productMap.get(item.product?.toString());
    const itemTotal = Number(item.price?.amount || 0);
    const qty = Number(item.quantity || 0);

    return {
      name: product?.title || `Product ${item.product?.toString() || ""}`,
      code: product?.sku || product?._id || item.product?.toString() || "-",
      quantity: qty,
      unitPrice: qty > 0 ? itemTotal / qty : itemTotal,
      totalPrice: itemTotal,
    };
  });
};

const ensureReceiptForOrder = async ({
  order,
  token,
  user,
  paymentInfo = {},
}) => {
  if (order.receipt?.filePath) {
    return order;
  }

  const receiptItems = await getReceiptItems(order, token);
  const subtotal = receiptItems.reduce(
    (sum, item) => sum + Number(item.totalPrice || 0),
    0,
  );
  const tax = Math.max(Number(order.totalPrice?.amount || 0) - subtotal, 0);

  const result = await generateReceiptPdf({
    bakeryName: process.env.BAKERY_NAME || "Bakeflow Bakery",
    systemName: process.env.SYSTEM_NAME || "Bakeflow",
    orderId: order._id.toString(),
    customerName: resolveCustomerName(user),
    paymentMethod: paymentInfo.paymentMethod || "Razorpay",
    paymentStatus: paymentInfo.paymentStatus || "PAID",
    paymentId: paymentInfo.paymentId || "-",
    orderDate: order.createdAt,
    currency: order.totalPrice?.currency || "INR",
    items: receiptItems,
    subtotal,
    tax,
    total: Number(order.totalPrice?.amount || 0),
  });

  order.receipt = {
    filePath: result.relativeFilePath,
    fileName: result.fileName,
    generatedAt: new Date(),
    paymentMethod: paymentInfo.paymentMethod || "Razorpay",
    paymentStatus: paymentInfo.paymentStatus || "PAID",
    paymentId: paymentInfo.paymentId || "-",
    customerName: resolveCustomerName(user),
  };

  await order.save();

  try {
    const { imageKitUrl, imageKitFileId } = await uploadReceiptToImageKit(
      result.absoluteFilePath,
      result.fileName,
    );
    order.receipt.imageKitUrl = imageKitUrl;
    order.receipt.imageKitFileId = imageKitFileId;
    await order.save();
  } catch (uploadErr) {
    console.error(
      "ImageKit upload failed, receipt saved locally:",
      uploadErr.message,
    );
  }

  return order;
};

const createOrder = async (req, res) => {
  const user = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  try {
    // 1️⃣ Fetch cart items
    const cartResponse = await axios.get(`${CART_API_URL}/api/cart/items`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const cartItems = cartResponse.data.items;

    if (!cartItems || cartItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Cart is empty. Cannot create order." });
    }

    // 2️⃣ Fetch all product details
    const productRequests = cartItems.map((item) =>
      axios.get(`${PRODUCT_API_URL}/api/products/${item.productId}`, {
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

      const itemPrice = product.price.amount;
const itemTotal = itemPrice * item.quantity;

priceAmount += itemTotal;

      return {
        product: item.productId,
  quantity: item.quantity,
  price: {
    amount: itemPrice, // ✅ per unit price
    currency: product.price.currency,
  },
        costPrice: {
          amount: Number(product.costPrice?.amount || 0), // ✅ per unit
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
      `${PRODUCT_API_URL}/api/products/inventory/reserve`,
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
        `${PRODUCT_API_URL}/api/products/inventory/release`,
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

const getOwnerOrders = async (req, res) => {
  const owner = req.user;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  if (!owner) {
    return res.status(401).json({
      message: "Unauthorized User",
    });
  }

  try {
    const orders = await orderModel
      .find({ status: { $in: OWNER_VISIBLE_STATUSES } })
      .sort({ createdAt: -1 });

    if (orders.length === 0) {
      return res.status(200).json({
        orders: [],
      });
    }

    const productIds = orders.flatMap((order) =>
      order.items.map((item) => item.product?.toString()),
    );
    const productMap = await fetchProductMapByIds(productIds, token);

    const ownerOrders = orders
      .filter((order) => ownerHasAccessToOrder(order, owner.id, productMap))
      .map((order) => {
        const itemsQuantity = order.items.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0,
        );

        return {
          _id: order._id,
          orderName: getOwnerOrderName(order, productMap),
          createdAt: order.createdAt,
          itemsQuantity,
          amount: {
            amount: order.totalPrice?.amount || 0,
            currency: order.totalPrice?.currency || "INR",
          },
          paymentStatus: getOwnerOrderPaymentStatus(order.status),
          ownerOrderStatus: mapOrderStatusForOwner(order.status),
          actionOptions: getOwnerOrderActionOptions(order.status),
          orderStatusRaw: order.status,
          receiptAvailable: Boolean(order.receipt?.filePath),
        };
      });

    return res.status(200).json({
      orders: ownerOrders,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

const ownerUpdateOrderStatus = async (req, res) => {
  const owner = req.user;
  const orderId = req.params.id;
  const action = String(req.body?.action || "").toUpperCase();
  const requestedStatus = String(req.body?.status || "").toUpperCase();
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      message: "Invalid order ID format",
    });
  }

  if (!action && !requestedStatus) {
    return res.status(400).json({
      message: "Provide action or status to update order",
    });
  }

  if (action && !Object.values(OWNER_ACTIONS).includes(action)) {
    return res.status(400).json({
      message: "Invalid action. Use ACCEPT, REJECT, or COMPLETE",
    });
  }

  if (
    requestedStatus &&
    ![...OWNER_STATUS_FLOW, "REJECTED"].includes(requestedStatus)
  ) {
    return res.status(400).json({
      message:
        "Invalid status. Use PROCESSING, READY, SHIPPED, COMPLETED, or REJECTED",
    });
  }

  try {
    const order = await orderModel.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const productIds = order.items.map((item) => item.product?.toString());
    const productMap = await fetchProductMapByIds(productIds, token);

    if (!ownerHasAccessToOrder(order, owner.id, productMap)) {
      return res.status(403).json({
        message: "Forbidden - You don't have access to this order",
      });
    }

    if (action === OWNER_ACTIONS.REJECT || requestedStatus === "REJECTED") {
      if (!["CONFIRMED", "PROCESSING", "READY"].includes(order.status)) {
        return res.status(400).json({
          message:
            "Only paid pending, processing, or ready orders can be rejected",
        });
      }

      const inventoryItems = mapInventoryItems(order.items);

      await axios.post(
        `${PRODUCT_API_URL}/inventory/release`,
        { items: inventoryItems },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      order.status = "REJECTED";
      await order.save();
      await publishOrderUpdateForSellerDashboard(order);

      return res.status(200).json({
        message: "Order rejected successfully",
        order,
      });
    }

    let targetStatus = null;

    if (requestedStatus) {
      if (!OWNER_STATUS_FLOW.includes(order.status)) {
        return res.status(400).json({
          message: "Order status cannot be advanced from current state",
        });
      }

      const nextStatus = getNextOwnerOrderStatus(order.status);
      if (!nextStatus) {
        return res.status(400).json({
          message: "Order is already in final state",
        });
      }

      if (requestedStatus !== nextStatus) {
        return res.status(400).json({
          message: `Invalid status transition. Next allowed status is ${nextStatus}`,
        });
      }

      targetStatus = requestedStatus;
    }

    if (action === OWNER_ACTIONS.ACCEPT) {
      if (order.status !== "CONFIRMED") {
        return res.status(400).json({
          message: "Only paid pending orders can be accepted",
        });
      }

      targetStatus = "PROCESSING";
    }

    if (action === OWNER_ACTIONS.COMPLETE) {
      if (order.status !== "PROCESSING") {
        return res.status(400).json({
          message: "Only processing orders can be completed",
        });
      }

      targetStatus = "COMPLETED";
    }

    if (!targetStatus) {
      return res.status(400).json({
        message: "Unable to resolve target status",
      });
    }

    order.status = targetStatus;

if (targetStatus === "COMPLETED") {
  order.completedAt = new Date(); // ✅ VERY IMPORTANT FIX
}

await order.save();
    await publishOrderUpdateForSellerDashboard(order);

    if (targetStatus === "READY") {
      await publishOrderReadyNotification({ order, token });
    }

    return res.status(200).json({
      message: `Order moved to ${targetStatus}`,
      order,
    });
  } catch (error) {
    return res.status(500).json({
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
      `${PRODUCT_API_URL}/inventory/release`,
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
          `${PRODUCT_API_URL}/inventory/reserve`,
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
    await publishOrderUpdateForSellerDashboard(order);

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
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];
  const paymentInfo = {
    paymentId: req.body?.paymentId,
    paymentMethod: req.body?.paymentMethod || "Razorpay",
    paymentStatus: req.body?.paymentStatus || "PAID",
  };

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
      if (!order.receipt?.filePath) {
        await ensureReceiptForOrder({ order, token, user, paymentInfo });
      }

      return res.status(200).json({
        message: `Order already ${order.status.toLowerCase()}`,
        order,
        receipt: order.receipt,
      });
    }

    if (order.status === "CANCELLED" || order.status === "REJECTED") {
      return res.status(400).json({
        message: "Cannot confirm a rejected or cancelled order",
      });
    }

    order.status = "CONFIRMED";
    await order.save();
    await publishOrderUpdateForSellerDashboard(order);

    await ensureReceiptForOrder({ order, token, user, paymentInfo });

    return res.status(200).json({
      message: "Order confirmed successfully",
      order,
      receipt: order.receipt,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
      error: err.message,
    });
  }
};

const downloadReceiptByOrderId = async (req, res) => {
  const user = req.user;
  const orderId = req.params.id;
  const token = req.cookies?.token || req.headers?.authorization?.split(" ")[1];

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

    if (user.role === "user" && order.user.toString() !== user.id) {
      return res.status(403).json({
        message: "Forbidden - You don't have access to this order",
      });
    }

    if (user.role === "owner") {
      const productIds = order.items.map((item) => item.product?.toString());
      const productMap = await fetchProductMapByIds(productIds, token);
      if (!ownerHasAccessToOrder(order, user.id, productMap)) {
        return res.status(403).json({
          message: "Forbidden - You don't have access to this order",
        });
      }
    }

    if (!order.receipt?.filePath) {
      return res.status(404).json({
        message: "Receipt not generated yet",
      });
    }

    if (order.receipt.imageKitUrl) {
      return res.redirect(order.receipt.imageKitUrl);
    }

    const absolutePath = path.join(
      __dirname,
      "..",
      "..",
      order.receipt.filePath,
    );

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        message: "Receipt file not found",
      });
    }

    return res.download(
      absolutePath,
      order.receipt.fileName || `receipt-${order._id}.pdf`,
    );
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
  getOwnerOrders,
  ownerUpdateOrderStatus,
  getOrderById,
  cancelOrderById,
  updateOrderAddress,
  completeOrderById,
  downloadReceiptByOrderId,
};