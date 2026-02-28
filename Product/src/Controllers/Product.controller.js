const productModel = require("../models/product.model");
const { uploadImages } = require("../services/imagekit.service");
const mongoose = require("mongoose");
<<<<<<< HEAD
const { publishtoQueue } = require("./../Broker/Broker");

const createProduct = async (req, res) => {
  try {
    const {
      title,
      description,
      priceAmount,
      priceCurrency = "INR",
      category,
      stock,
    } = req.body;

=======
const {publishtoQueue} = require('./../Broker/Broker')

const createProduct = async (req, res) => {
  try {
    const { title, description, priceAmount, priceCurrency = "INR" } = req.body;
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
    const files = req.files;

    if (!title || !priceAmount) {
      return res.status(400).json({
        message: "title, priceAmount and owner are required",
      });
    }

    const owner = req.user.id;

    const price = {
      amount: Number(priceAmount),
      currency: priceCurrency,
    };

    // Upload images to ImageKit
    const imageUploads = await uploadImages(files);

    // Create product
    const product = await productModel.create({
      title,
      description,
      price,
      owner,
<<<<<<< HEAD
      category,
      stock,
=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
      image: imageUploads,
    });

    await product.save();

<<<<<<< HEAD
    await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED", product);

    // await publishtoQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED",{
    //   email: req.user.email,
    //   productId: product._id,
    //   productName : product.title,
    //   ownerId: owner
    // })

    res.status(201).json(product);
=======
    await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED", product)

    await publishtoQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED",{
      email: req.user.email,
      productId: product._id,
      productName : product.title,
      ownerId: owner
    })

    res.status(201).json(product);
    
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
<<<<<<< HEAD
    const { q, minprice, maxprice, skip = 0, limit = 20 } = req.query;

    const filter = {};

    if (q) {
      filter.$text = { $search: q };
    }

=======
    const { e, minprice, maxprice, skip = 0, limit = 20 } = req.query;

    const filter = {};

>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
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

<<<<<<< HEAD
    const allowedUpdates = ["title", "description", "price"];

    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        if (key === "price" && typeof req.body.price === "object") {
          if (req.body.price.amount !== undefined) {
            product.price.amount = Number(req.body.price.amount);
          }
          if (req.body.price.currency !== undefined) {
            product.price.currency = req.body.price.currency;
          }
        } else {
          product[key] = req.body[key];
        }
      }
    }

    const updatedProduct = await product.save();
=======
    const allowedUpdates = [
      "title",
      "description",
      "priceAmount",
      "priceCurrency",
      "stock"
    ];

    const updates = {};

    if (req.body.title !== undefined) {
      updates.title = req.body.title;
    }
    if (req.body.description !== undefined) {
      updates.description = req.body.description;
    }
    if (req.body.priceAmount !== undefined) {
      updates.price = {
        amount: Number(req.body.priceAmount),
        currency: product.price.currency || "INR",
      };
    }
    if (req.body.priceCurrency !== undefined) {
      updates.price = {
        amount: product.price.amount,
        currency: req.body.priceCurrency,
      };
    }

    if (req.body.stock !== undefined) {
      updates.stock = req.body.stock;
    }

    const updatedProduct = await productModel.findByIdAndUpdate(id, updates, {
      new: true,
    });
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

    return res.status(200).json({ product: updatedProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

<<<<<<< HEAD
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

    return res.status(200).json({ message: "Inventory released successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

<<<<<<< HEAD
    // 1️⃣ Find product first (don't filter by owner here)
    const product = await productModel.findById(id);
=======
    const product = await productModel.findOne({ _id: id, owner: req.user.id });
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

<<<<<<< HEAD
    // 2️⃣ Permission check
    const isProductOwner = product.owner.toString() === req.user.id;
    const isOwnerRole = req.user.role === "owner";

    if (!isProductOwner && !isOwnerRole) {
=======
    if (!product.owner.toString() != req.user.id) {
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
      return res
        .status(403)
        .json({ message: "Forbidden: You can only delete your own products." });
    }

<<<<<<< HEAD
    // 3️⃣ Delete
=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
    await productModel.findByIdAndDelete(id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
<<<<<<< HEAD
    console.error("Delete product error:", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting product" });
=======
    res.status(500).json({ error: error.message });
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
  }
};

const getProductsByOwner = async (req, res) => {
  try {
    const { skip = 0, limit = 20 } = req.query;

    const products = await productModel
      .find({ owner: req.user.id })
      .skip(Number(skip))
      .limit(Math.min(Number(limit), 20));

    return res.status(200).json({ data: products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
<<<<<<< HEAD
  reserveInventory,
  releaseInventory,
=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
  deleteProduct,
  getProductsByOwner,
};
