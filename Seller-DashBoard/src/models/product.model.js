const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  price: {
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ["USD", "INR"],
      default: "INR",
    },
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  image: [
    {
      url: String,
      thumbnail: String,
      id: String,
    },
  ],
  stock:{
    type:Number,
    default:0
  }
});

const productModel = mongoose.model("product", productSchema);
productSchema.index({ title: "text", description: "text" });

module.exports = productModel;

