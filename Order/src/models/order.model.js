const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  // Define schema for address subdocument
  street: String, // Street field as string
  city: String, // City field as string
  state: String, // State field as string
  pincode: String, // pincode field as string (note: in code it's pincode, but validation uses pincode)
  country: String, // Country field as string
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
        default: "PAID",
      },
      paymentId: {
        type: String,
      },
      customerName: {
        type: String,
      },
    },
  },
  { timestamps: true },
);

const orderModel = mongoose.model("Order", OrderSchema);

module.exports = orderModel;
