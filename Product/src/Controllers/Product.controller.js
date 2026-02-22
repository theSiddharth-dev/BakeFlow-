const productModel = require("../models/product.model");
const { uploadImages } = require("../services/imagekit.service");
const mongoose = require("mongoose");
const {publishtoQueue} = require('./../Broker/Broker')

const createProduct = async (req, res) => {
  try {
    const { title, description, priceAmount, priceCurrency = "INR" } = req.body;
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
      image: imageUploads,
    });

    await product.save();

    await publishtoQueue("PRODUCT_SELLER_DASHBOARD.PRODUCT_CREATED", product)

    await publishtoQueue("PRODUCT_NOTIFICATION.PRODUCT_CREATED",{
      email: req.user.email,
      productId: product._id,
      productName : product.title,
      ownerId: owner
    })

    res.status(201).json(product);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getProducts = async (req, res) => {
  try {
    const { e, minprice, maxprice, skip = 0, limit = 20 } = req.query;

    const filter = {};

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

    return res.status(200).json({ product: updatedProduct });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product id" });
    }

    const product = await productModel.findOne({ _id: id, owner: req.user.id });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.owner.toString() != req.user.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You can only delete your own products." });
    }

    await productModel.findByIdAndDelete(id);

    return res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  deleteProduct,
  getProductsByOwner,
};
