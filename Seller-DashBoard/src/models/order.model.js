const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
  country: String,
});

const OrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        quantity: {
          type: Number,
          default: 1,
          min: 1,
        },
        price: {
          amount: {
            type: Number,
            required: true,
          },
          currency: {
            type: String,
            required: true,
            enum: ["USD", "INR"],
          },
        },
        costPrice: {
          amount: {
            type: Number,
            default: 0,
            min: 0,
          },
          currency: {
            type: String,
            default: "INR",
            enum: ["USD", "INR"],
          },
        },
      },
    ],
    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "READY",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
        "SHIPPED",
        "DELIVERED",
      ],
    },
    totalPrice: {
      amount: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        required: true,
        enum: ["USD", "INR"],
      },
    },
    shippingAddress: {
      type: addressSchema,
      required: true,
    },
    receipt: {
      filePath: {
        type: String,
      },
      fileName: {
        type: String,
      },
      generatedAt: {
        type: Date,
      },
      paymentMethod: {
        type: String,
        default: "Razorpay",
      },
      paymentStatus: {
        type: String,
      },
      paymentId: {
        type: String,
      },
      customerName: {
        type: String,
      },
      imageKitUrl: {
        type: String,
      },
      imageKitFileId: {
        type: String,
      },
    },
     completedAt: {
        type: Date,
  },
  },
  { timestamps: true },
);

const orderModel = mongoose.model("Order", OrderSchema);

module.exports = orderModel;
