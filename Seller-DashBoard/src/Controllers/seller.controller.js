const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");
const axios = require("axios");
const mongoose = require("mongoose");

const VALID_SALES_STATUSES = [
  "CONFIRMED",
  "COMPLETED",
  "READY",
  "DELIVERED",
  "SHIPPED",
];
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);
const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:3001/api/products";
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3000/api/auth";

console.log(PRODUCT_SERVICE_URL, AUTH_SERVICE_URL);
const getAuthenticatedUserId = (user) => user?.id || user?._id || null;
const toSafeStringId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value?._id) return toSafeStringId(value._id);
  try {
    return value.toString();
  } catch {
    return null;
  }
};
const asArray = (value) => (Array.isArray(value) ? value : []);
const toObjectIds = (values) => {
  return asArray(values)
    .map((value) => toSafeStringId(value))
    .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

const getCustomerDisplayName = (user, fallbackCustomerName) => {
  if (fallbackCustomerName) return fallbackCustomerName;
  if (!user) return "Unknown Customer";
  if (typeof user.fullName === "object") {
    const fullName = [user.fullName.firstName, user.fullName.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) return fullName;
  }
  if (typeof user.fullName === "string" && user.fullName.trim()) {
    return user.fullName.trim();
  }
  if (user.username) return user.username;
  if (user.email) return user.email;
  return "Unknown Customer";
};

const getSellerProducts = async (req, sellerId) => {
  const localProducts = await productModel.find({ owner: sellerId });
  console.log(
    `[SellerDashboard] localProducts count: ${localProducts.length} for seller: ${sellerId}`,
  );

  const authHeader = req.headers?.authorization;

  if (!authHeader) {
    console.log(
      "[SellerDashboard] No auth header — returning local products only",
    );
    return localProducts;
  }

  try {
    const response = await axios.get(`${PRODUCT_SERVICE_URL}/owner`, {
      headers: {
        Authorization: authHeader,
      },
      params: {
        skip: 0,
        limit: 1000,
        ts: Date.now(),
      },
    });

    const sourceProducts = Array.isArray(response?.data?.data)
      ? response.data.data
      : [];

    console.log(
      `[SellerDashboard] Product service returned ${sourceProducts.length} products`,
    );

    if (sourceProducts.length === 0) {
      return localProducts;
    }

    await Promise.all(
      sourceProducts.map((product) => {
        const { _id, ...productData } = product;
        return productModel.findByIdAndUpdate(
          _id,
          { $set: productData },
          { new: true, upsert: true },
        );
      }),
    );

    return sourceProducts;
  } catch (error) {
    console.error(
      `[SellerDashboard] Product service API call failed: ${error.message}`,
      error.response?.status || "",
    );
    return localProducts;
  }
};

const syncUsersFromAuthService = async (req) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader) return;

  try {
    const response = await axios.get(
      `${AUTH_SERVICE_URL}/internal/user-emails`,
      {
        headers: {
          Authorization: authHeader,
        },
        params: {
          ts: Date.now(),
        },
      },
    );

    const users = Array.isArray(response?.data?.users)
      ? response.data.users
      : [];

    if (users.length === 0) return;

    await Promise.all(
      users.map((user) => {
        if (!user?.id || !user?.email) return Promise.resolve();

        const fallbackFirstName =
          (user.username || "Customer").trim() || "Customer";

        return userModel.findByIdAndUpdate(
          user.id,
          {
            $set: {
              username: user.username || fallbackFirstName,
              email: user.email,
              fullName: user.fullName || {
                firstName: fallbackFirstName,
                lastName: "",
              },
              role: user.role || "user",
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
      }),
    );
  } catch (error) {
    console.error(
      `[SellerDashboard] User backfill from auth failed: ${error.message}`,
    );
  }
};

const isBetweenDates = (dateValue, startDate, endDate) => {
  const date = new Date(dateValue);
  return date >= startDate && date <= endDate;
};

const getWeekRange = (dateValue) => {
  const date = new Date(dateValue);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() + mondayOffset);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
};

const getMetrics = async (req, res) => {
  try {
    const sellerId = getAuthenticatedUserId(req.user);
    if (!sellerId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token payload" });
    }
    const registeredCustomersCount = await userModel.countDocuments({
      role: "user",
    });
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const { startOfWeek, endOfWeek } = getWeekRange(now);

    // Get all products owned by this seller
    const sellerProducts = await getSellerProducts(req, sellerId);
    const rawProductIds = asArray(sellerProducts)
      .map((p) => p?._id)
      .filter((id) => Boolean(toSafeStringId(id)));
    const productIds = toObjectIds(rawProductIds);
    const currency = sellerProducts[0]?.price?.currency || "INR";

    const lowStockProducts = sellerProducts
      .filter((product) => Number(product?.stock ?? 0) <= LOW_STOCK_THRESHOLD)
      .map((product) => ({
        productId: product._id,
        title: product.title,
        stock: Number(product?.stock ?? 0),
      }));

    if (productIds.length === 0) {
      return res.status(200).json({
        totalRevenue: { amount: 0, currency: "INR" },
        monthlyRevenue: { amount: 0, currency: "INR" },
        todaysSales: 0,
        todayRevenue: { amount: 0, currency: "INR" },
        todaysProfit: {
          amount: null,
          currency: "INR",
          available: false,
          message: "Cost price data not available",
        },
        weeklySales: 0,
        weeklyRevenue: { amount: 0, currency: "INR" },
        weeklyProfit: {
          amount: null,
          currency: "INR",
          available: false,
          message: "Cost price data not available",
        },
        monthlySales: 0,
        averageOrderValue: { amount: 0, currency: "INR" },
        totalCustomer: registeredCustomersCount,
        totalCustomers: registeredCustomersCount,
        lowStockItems: {
          threshold: LOW_STOCK_THRESHOLD,
          count: 0,
          items: [],
        },
        sales: 0,
        revenue: { amount: 0, currency: "INR" },
        topProducts: [],
      });
    }

    const productIdSet = new Set(productIds.map((id) => toSafeStringId(id)));

    // Get all orders containing seller's products
    const orders = await orderModel.find({
      "items.product": { $in: productIds },
      status: { $in: VALID_SALES_STATUSES },
    });

    // Calculate sales and revenue
    let totalSales = 0;
    let totalRevenue = 0;
    let monthlySales = 0;
    let monthlyRevenue = 0;
    let weeklySales = 0;
    let weeklyRevenue = 0;
    let weeklyCost = 0;
    let hasWeeklyCostData = true;
    let todaysSales = 0;
    let todaysRevenue = 0;
    let todaysCost = 0;
    let hasTodaysCostData = true;
    let sellerOrderCount = 0;
    const customerIds = new Set();
    const productSalesMap = new Map();

    orders.forEach((order) => {
      const orderDate = order.createdAt || order.updatedAt;
      const isTodayOrder = isBetweenDates(orderDate, startOfToday, endOfToday);
      const isMonthlyOrder = isBetweenDates(
        orderDate,
        startOfMonth,
        endOfMonth,
      );
      const isWeeklyOrder = isBetweenDates(orderDate, startOfWeek, endOfWeek);
      let hasSellerItems = false;

      asArray(order?.items).forEach((item) => {
        if (!item) return;

        const productIdStr = toSafeStringId(item?.product);
        if (!productIdStr) return;

        // Check if this item belongs to seller's products
        if (productIdSet.has(productIdStr)) {
          hasSellerItems = true;
          const itemQuantity = Number(item?.quantity || 0);
          const lineRevenue = Number(item.price?.amount || 0) * itemQuantity;

          totalSales += itemQuantity;
          totalRevenue += lineRevenue;

          if (isTodayOrder) {
            todaysSales += itemQuantity;
            todaysRevenue += lineRevenue;

            const lineCost = Number(item?.costPrice?.amount);
            if (Number.isFinite(lineCost) && lineCost >= 0) {
              todaysCost += lineCost;
            } else {
              hasTodaysCostData = false;
            }
          }

          if (isWeeklyOrder) {
            weeklySales += itemQuantity;
            weeklyRevenue += lineRevenue;

            const weeklyLineCost = Number(item?.costPrice?.amount);
            if (Number.isFinite(weeklyLineCost) && weeklyLineCost >= 0) {
              weeklyCost += weeklyLineCost;
            } else {
              hasWeeklyCostData = false;
            }
          }

          if (isMonthlyOrder) {
            monthlySales += itemQuantity;
            monthlyRevenue += lineRevenue;
          }

          // Track product sales for top products
          if (productSalesMap.has(productIdStr)) {
            const existing = productSalesMap.get(productIdStr);
            existing.quantity += itemQuantity;
            existing.revenue += lineRevenue;
          } else {
            productSalesMap.set(productIdStr, {
              productId: productIdStr,
              quantity: itemQuantity,
              revenue: lineRevenue,
            });
          }
        }
      });

      if (hasSellerItems) {
        sellerOrderCount += 1;
        const customerId = toSafeStringId(order.user);
        if (customerId) {
          customerIds.add(customerId);
        }
      }
    });

    const averageOrderValue =
      sellerOrderCount > 0
        ? Number((totalRevenue / sellerOrderCount).toFixed(2))
        : 0;

    const todaysProfitAmount =
      hasTodaysCostData && todaysSales > 0
        ? Number((todaysRevenue - todaysCost).toFixed(2))
        : hasTodaysCostData
          ? 0
          : null;

    const weeklyProfitAmount =
      hasWeeklyCostData && weeklySales > 0
        ? Number((weeklyRevenue - weeklyCost).toFixed(2))
        : hasWeeklyCostData
          ? 0
          : null;

    // Get top 5 products by quantity sold
    const topProductsData = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Get product details for top products
    const topProducts = await Promise.all(
      topProductsData.map(async (data) => {
        const topProductId = toSafeStringId(data.productId);
        const product = sellerProducts.find(
          (p) => toSafeStringId(p?._id) === topProductId,
        );
        return {
          productId: topProductId,
          title: product?.title || "Unknown",
          quantitySold: data.quantity,
          revenue: {
            amount: data.revenue,
            currency: product?.price?.currency || "INR",
          },
          image: product?.image?.[0]?.url || null,
        };
      }),
    );

    return res.status(200).json({
      totalRevenue: {
        amount: totalRevenue,
        currency,
      },
      monthlyRevenue: {
        amount: monthlyRevenue,
        currency,
      },
      todaysSales,
      todayRevenue: {
        amount: todaysRevenue,
        currency,
      },
      todaysProfit: {
        amount: todaysProfitAmount,
        currency,
        available: hasTodaysCostData,
        message: hasTodaysCostData
          ? undefined
          : "Cost price data not available",
      },
      weeklySales,
      weeklyRevenue: {
        amount: weeklyRevenue,
        currency,
      },
      weeklyProfit: {
        amount: weeklyProfitAmount,
        currency,
        available: hasWeeklyCostData,
        message: hasWeeklyCostData
          ? undefined
          : "Cost price data not available",
      },
      monthlySales,
      averageOrderValue: {
        amount: averageOrderValue,
        currency,
      },
      totalCustomer: registeredCustomersCount,
      totalCustomers: registeredCustomersCount,
      lowStockItems: {
        threshold: LOW_STOCK_THRESHOLD,
        count: lowStockProducts.length,
        items: lowStockProducts,
      },
      sales: totalSales,
      revenue: {
        amount: totalRevenue,
        currency,
      },
      topProducts,
    });
  } catch (error) {
    console.error("Error fetching metrics:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getOrders = async (req, res) => {
  try {
    const sellerId = getAuthenticatedUserId(req.user);
    if (!sellerId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token payload" });
    }

    // Best-effort sync keeps historical orders mappable to user docs.
    await syncUsersFromAuthService(req);

    // Get all products owned by this seller
    const sellerProducts = await productModel.find({ owner: sellerId });
    const rawProductIds = asArray(sellerProducts)
      .map((p) => p?._id)
      .filter((id) => Boolean(toSafeStringId(id)));
    const productIds = toObjectIds(rawProductIds);

    if (productIds.length === 0) {
      return res.status(200).json({
        message: "No products found for this seller",
        orders: [],
      });
    }

    // Find all orders containing seller's products
    const orders = await orderModel
      .find({
        "items.product": { $in: productIds },
      })
      .populate("user", "fullName username email")
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Filter and format orders to show only seller's items
    const formattedOrders = orders.map((order) => {
      // Filter items to include only seller's products
      const sellerItems = asArray(order?.items).filter((item) => {
        const itemProductId = toSafeStringId(item?.product);
        if (!itemProductId) return false;
        return productIds.some((pid) => toSafeStringId(pid) === itemProductId);
      });

      // Calculate total for seller's items in this order
      const sellerTotal = sellerItems.reduce(
        (sum, item) =>
          sum + Number(item?.price?.amount || 0) * Number(item?.quantity || 0),
        0,
      );

      return {
        orderId: order._id,
        customer: {
          id: order.user?._id || null,
          name:
            order.customerName ||
            getCustomerDisplayName(order.user, order.receipt?.customerName),
          email: order.user?.email || order.customerEmail || "N/A",
        },
        items: sellerItems.map((item) => ({
          productId: toSafeStringId(item?.product),
          title: item?.product?.title || "Unknown Product",
          quantity: Number(item?.quantity || 0),
          price: item?.price || { amount: 0, currency: "INR" },
          image: item?.product?.image?.[0]?.url || null,
        })),
        status: order.status,
        shippingAddress: order.shippingAddress,
        sellerTotal: {
          amount: sellerTotal,
          currency: sellerItems[0]?.price?.currency || "INR",
        },
        orderDate: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    return res.status(200).json({
      totalOrders: formattedOrders.length,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getProducts = async (req, res) => {
  try {
    const sellerId = getAuthenticatedUserId(req.user);
    if (!sellerId) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Invalid token payload" });
    }
    const products = await productModel.find({ owner: sellerId });
    return res.status(200).json({
      products: products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  getMetrics,
  getOrders,
  getProducts,
};
