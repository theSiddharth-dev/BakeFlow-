const productModel = require("../models/product.model");
const { uploadImages } = require("../services/imagekit.service");
const mongoose = require("mongoose");
const axios = require("axios");
const { publishtoQueue } = require("./../Broker/Broker");

const publishProductUpdated = async (product) => {
  await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_UPDATED", product);
};

const publishProductDeleted = async (productId) => {
  await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_DELETED", {
    _id: productId,
  });
};

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3000/api/auth";
const LOW_STOCK_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD || 5);

const fetchNotificationRecipients = async (token) => {
  if (!token) return [];

  const response = await axios.get(`${AUTH_SERVICE_URL}/internal/user-emails`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response?.data?.users || [];
};

const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      priceAmount,
      priceCurrency = "INR",
      costPriceAmount,
      costPriceCurrency = "INR",
      category,
      stock,
    } = req.body;

    const files = req.files || [];
    const token = req.headers?.authorization?.split(" ")[1] || null;

    if (!title || !priceAmount || costPriceAmount === undefined) {
      return res.status(400).json({
        message: "title, priceAmount and costPriceAmount are required",
      });
    }

    const owner = req.user.id;

    const price = {
      amount: Number(priceAmount),
      currency: priceCurrency,
    };

    const costPrice = {
      amount: Number(costPriceAmount),
      currency: costPriceCurrency,
    };

    // Upload images to ImageKit
    const imageUploads = (await uploadImages(files)) || [];

    // Create product
    const product = await productModel.create({
      title,
      description,
      price,
      costPrice,
      owner,
      category,
      stock,
      image: imageUploads,
    });

    await product.save();

    await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED", product);

    let recipients = [];
    try {
      recipients = await fetchNotificationRecipients(token);
    } catch (error) {
      console.error("Unable to fetch user recipients:", error.message);
    }

    if (recipients.length > 0) {
      await Promise.all(
        recipients.map((recipient) =>
          publishtoQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED", {
            email: recipient.email,
            username: recipient.username,
            productId: product._id,
            productName: product.title,
            ownerId: owner,
          }),
        ),
      );
    } else {
      // Fallback keeps notification path active even if recipient lookup fails.
      await publishtoQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED", {
        email: req.user.email,
        username: req.user.username,
        productId: product._id,
        productName: product.title,
        ownerId: owner,
      });
    }

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const { q, minprice, maxprice, category, skip = 0, limit = 20 } = req.query;

    const filter = {};

    const escapeRegex = (value = "") =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    if (q) {
      filter.$text = { $search: q };
    }

    if (minprice) {
      filter["price.amount"] = {
        ...filter["price.amount"],
        $gte: Number(minprice),
      };
    }

    if (maxprice) {
      filter["price.amount"] = {
        ...filter["price.amount"],
        $lte: Number(maxprice),
      };
    }

    if (category && category !== "All Products") {
      filter.category = new RegExp(`^${escapeRegex(category.trim())}$`, "i");
    }

    const products = await productModel
      .find(filter)
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 20));

    return res.status(200).json({ data: products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }
    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(200).json({ product: product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await productModel.findOne({ _id: id, owner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const allowedUpdates = [
      "title",
      "description",
      "price",
      "costPrice",
      "stock",
      "expiryDate",
      "stockNote",
    ];

    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        if (key === "price" && typeof req.body.price === "object") {
          if (req.body.price.amount !== undefined) {
            product.price.amount = Number(req.body.price.amount);
          }
          if (req.body.price.currency !== undefined) {
            product.price.currency = req.body.price.currency;
          }
        } else if (
          key === "costPrice" &&
          typeof req.body.costPrice === "object"
        ) {
          if (req.body.costPrice.amount !== undefined) {
            product.costPrice.amount = Number(req.body.costPrice.amount);
          }
          if (req.body.costPrice.currency !== undefined) {
            product.costPrice.currency = req.body.costPrice.currency;
          }
        } else {
          if (key === "stock") {
            product.stock = Number(req.body.stock);
          } else if (key === "expiryDate") {
            product.expiryDate = req.body.expiryDate
              ? new Date(req.body.expiryDate)
              : undefined;
          } else {
            product[key] = req.body[key];
          }
        }
      }
    }

    const updatedProduct = await product.save();
    await publishProductUpdated(updatedProduct);

    return res.status(200).json({ product: updatedProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateInventoryItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "Inventory items are required";
  }

  for (const item of items) {
    if (!mongoose.Types.ObjectId.isValid(item?.productId)) {
      return "Invalid product id in inventory items";
    }

    const quantity = Number(item?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return "Quantity must be a positive integer";
    }
  }

  return null;
};

const reserveInventory = async (req, res) => {
  const items = req.body?.items;
  const validationMessage = validateInventoryItems(items);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  const reserved = [];

  try {
    for (const item of items) {
      const quantity = Number(item.quantity);

      const updatedProduct = await productModel.findOneAndUpdate(
        { _id: item.productId, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } },
        { new: true },
      );

      if (!updatedProduct) {
        if (reserved.length > 0) {
          await productModel.bulkWrite(
            reserved.map((reservedItem) => ({
              updateOne: {
                filter: { _id: reservedItem.productId },
                update: { $inc: { stock: reservedItem.quantity } },
              },
            })),
          );
        }

        return res.status(409).json({
          message: "Insufficient stock for one or more products",
        });
      }

      reserved.push({
        productId: item.productId,
        quantity,
      });

      await publishProductUpdated(updatedProduct);
    }

    return res.status(200).json({ message: "Inventory reserved successfully" });
  } catch (error) {
    if (reserved.length > 0) {
      await productModel.bulkWrite(
        reserved.map((reservedItem) => ({
          updateOne: {
            filter: { _id: reservedItem.productId },
            update: { $inc: { stock: reservedItem.quantity } },
          },
        })),
      );
    }

    return res.status(500).json({ error: error.message });
  }
};

const releaseInventory = async (req, res) => {
  const items = req.body?.items;
  const validationMessage = validateInventoryItems(items);

  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }

  try {
    await productModel.bulkWrite(
      items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { stock: Number(item.quantity) } },
        },
      })),
    );

    const updatedProducts = await productModel.find({
      _id: { $in: items.map((item) => item.productId) },
    });

    await Promise.all(
      updatedProducts.map((product) => publishProductUpdated(product)),
    );

    return res.status(200).json({ message: "Inventory released successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const isProductOwner = product.owner.toString() === req.user.id;
    const isOwnerRole = req.user.role === "owner";

    if (!isProductOwner && !isOwnerRole) {
      return res
        .status(403)
        .json({ message: "Forbidden: You can only delete your own products." });
    }

    await productModel.findByIdAndDelete(id);
    await publishProductDeleted(id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting product" });
  }
};

const getProductsByOwner = async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query;

    const products = await productModel
      .find({ owner: req.user.id })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 73));

    return res.status(200).json({ data: products });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getLowStockNotifications = async (req, res) => {
  try {
    const thresholdQuery = Number(req.query?.threshold);
    const threshold = Number.isFinite(thresholdQuery)
      ? Math.max(0, thresholdQuery)
      : LOW_STOCK_THRESHOLD;

    const products = await productModel
      .find({ owner: req.user.id, stock: { $lte: threshold } })
      .sort({ stock: 1, updatedAt: -1, createdAt: -1 })
      .lean();

    const message =
      "This product is having less stock reorder it and keep the stock healthy.";

    const notifications = products.map((product) => ({
      productId: product._id,
      title: product.title || "Unnamed Product",
      image: product?.image?.[0]?.thumbnail || product?.image?.[0]?.url || null,
      stock: Number(product?.stock || 0),
      message,
      threshold,
    }));

    return res.status(200).json({
      threshold,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  reserveInventory,
  releaseInventory,
  deleteProduct,
  getProductsByOwner,
  getLowStockNotifications,
};
