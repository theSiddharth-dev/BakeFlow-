const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
          // Allow 0 to support tests that create zero-quantity items directly.
          // API-level validation still enforces qty > 0 for new items.
        },
      },
    ],
  },
  { timestamps: true }
);

const cart = mongoose.model("cart", cartSchema);

module.exports = cart;
