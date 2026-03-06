const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");

const VALID_SALES_STATUSES = ["CONFIRMED", "COMPLETED", "DELIVERED", "SHIPPED"];
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);

const isBetweenDates = (dateValue, startDate, endDate) => {
  const date = new Date(dateValue);
  return date >= startDate && date <= endDate;
};

const getMetrics = async (req, res) => {
  try {
    const seller = req.user;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Get all products owned by this seller
    const sellerProducts = await productModel.find({ owner: seller._id });
    const productIds = sellerProducts.map((p) => p._id);
    const currency = sellerProducts[0]?.price?.currency || "INR";

    const lowStockProducts = sellerProducts
      .filter((product) => Number(product.stock || 0) <= LOW_STOCK_THRESHOLD)
      .map((product) => ({
        productId: product._id,
        title: product.title,
        stock: Number(product.stock || 0),
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
        monthlySales: 0,
        averageOrderValue: { amount: 0, currency: "INR" },
        totalCustomer: 0,
        totalCustomers: 0,
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

    const productIdSet = new Set(productIds.map((id) => id.toString()));

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
      let hasSellerItems = false;

      order.items.forEach((item) => {
        const productIdStr = item.product.toString();

        // Check if this item belongs to seller's products
        if (productIdSet.has(productIdStr)) {
          hasSellerItems = true;
          const itemQuantity = Number(item.quantity || 0);
          const lineRevenue = Number(item.price?.amount || 0) * itemQuantity;

          totalSales += item.quantity;
          totalRevenue += lineRevenue;

          if (isTodayOrder) {
            todaysSales += itemQuantity;
            todaysRevenue += lineRevenue;

            const lineCost = Number(item.costPrice?.amount);
            if (Number.isFinite(lineCost) && lineCost >= 0) {
              todaysCost += lineCost;
            } else {
              hasTodaysCostData = false;
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
              productId: item.product,
              quantity: itemQuantity,
              revenue: lineRevenue,
            });
          }
        }
      });

      if (hasSellerItems) {
        sellerOrderCount += 1;
        if (order.user) {
          customerIds.add(order.user.toString());
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

    // Get top 5 products by quantity sold
    const topProductsData = Array.from(productSalesMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Get product details for top products
    const topProducts = await Promise.all(
      topProductsData.map(async (data) => {
        const product = sellerProducts.find(
          (p) => p._id.toString() === data.productId.toString(),
        );
        return {
          productId: data.productId,
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
      monthlySales,
      averageOrderValue: {
        amount: averageOrderValue,
        currency,
      },
      totalCustomer: customerIds.size,
      totalCustomers: customerIds.size,
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
    console.error("Error fetching metrics:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getOrders = async (req, res) => {
  try {
    const seller = req.user;

    // Get all products owned by this seller
    const sellerProducts = await productModel.find({ owner: seller._id });
    const productIds = sellerProducts.map((p) => p._id);

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
      .populate("user", "name email")
      .populate("items.product")
      .sort({ createdAt: -1 });

    // Filter and format orders to show only seller's items
    const formattedOrders = orders.map((order) => {
      // Filter items to include only seller's products
      const sellerItems = order.items.filter((item) =>
        productIds.some(
          (pid) => pid.toString() === item.product._id.toString(),
        ),
      );

      // Calculate total for seller's items in this order
      const sellerTotal = sellerItems.reduce(
        (sum, item) => sum + item.price.amount * item.quantity,
        0,
      );

      return {
        orderId: order._id,
        customer: {
          id: order.user._id,
          name: order.user.name,
          email: order.user.email,
        },
        items: sellerItems.map((item) => ({
          productId: item.product._id,
          title: item.product.title,
          quantity: item.quantity,
          price: item.price,
          image: item.product.image?.[0]?.url || null,
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
    const seller = req.user;
    const products = await productModel.find({ owner: seller._id });
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
