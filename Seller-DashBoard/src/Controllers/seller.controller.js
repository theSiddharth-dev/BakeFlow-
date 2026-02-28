const userModel = require("../models/user.model");
const productModel = require("../models/product.model");
const orderModel = require("../models/order.model");
const paymentModel = require("../models/payment.model");

const getMetrics = async (req, res) => {
  try {
    const seller = req.user;

    // Get all products owned by this seller
    const sellerProducts = await productModel.find({ owner: seller._id });
    const productIds = sellerProducts.map((p) => p._id);

    if (productIds.length === 0) {
      return res.status(200).json({
        sales: 0,
        revenue: { amount: 0, currency: "INR" },
        topProducts: [],
      });
    }

    // Get all orders containing seller's products
    const orders = await orderModel.find({
      "items.product": { $in: productIds },
      status: { $in: ["COMPLETED", "DELIVERED", "SHIPPED"] },
    });

    // Calculate sales and revenue
    let totalSales = 0;
    let totalRevenue = 0;
    const productSalesMap = new Map();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const productIdStr = item.product.toString();

        // Check if this item belongs to seller's products
        if (productIds.some((pid) => pid.toString() === productIdStr)) {
          totalSales += item.quantity;
          totalRevenue += item.price.amount * item.quantity;

          // Track product sales for top products
          if (productSalesMap.has(productIdStr)) {
            const existing = productSalesMap.get(productIdStr);
            existing.quantity += item.quantity;
            existing.revenue += item.price.amount * item.quantity;
          } else {
            productSalesMap.set(productIdStr, {
              productId: item.product,
              quantity: item.quantity,
              revenue: item.price.amount * item.quantity,
            });
          }
        }
      });
    });

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
      sales: totalSales,
      revenue: {
        amount: totalRevenue,
        currency: sellerProducts[0]?.price?.currency || "INR",
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

const getProducts = async(req,res)=>{
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
}

module.exports = {
  getMetrics,
  getOrders,
  getProducts
};
