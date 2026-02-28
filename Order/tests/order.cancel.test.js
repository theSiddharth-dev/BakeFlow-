// Set timeout for MongoMemoryServer binary download/startup
process.env.MONGOMS_STARTUP_TIMEOUT = "60000";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const jwt = require("jsonwebtoken");
const Order = require("../src/models/order.model");

jest.setTimeout(60000); // 1 minute timeout

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: "6.0.6",
      skipMD5: true,
    },
    spawn: { startupTimeout: 60000 },
  });

  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 300000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
  }
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

const generateToken = (userId, role = "user") => {
  return jwt.sign(
    { id: userId, role: role },
    process.env.JWT_SECRET || "test-secret-key",
    { expiresIn: "1h" },
  );
};

describe("POST /api/orders/:id/cancel - Buyer initiated cancel", () => {
  describe("Success scenarios", () => {
    it("should successfully cancel a PENDING order by the buyer", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      // Create a pending order
      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 2,
            price: {
              amount: 200,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 200,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/cancel/i);
      expect(res.body.order).toBeDefined();
      expect(res.body.order.status).toBe("CANCELLED");

      // Verify in database
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.status).toBe("CANCELLED");
    });

    it("should successfully cancel an order with multiple items", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId1,
            quantity: 2,
            price: {
              amount: 200,
              currency: "INR",
            },
          },
          {
            product: productId2,
            quantity: 1,
            price: {
              amount: 150,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 350,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.order.status).toBe("CANCELLED");
      expect(res.body.order.items.length).toBe(2);
    });
  });

  describe("Authorization failures", () => {
    it("should return 401 if user is not authenticated", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const res = await request(app).post(`/api/orders/${orderId}/cancel`);

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/unauthorized/i);
    });

    it("should return 403 if user is not the owner of the order", async () => {
      const ownerUserId = new mongoose.Types.ObjectId();
      const differentUserId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(differentUserId);

      // Create order owned by ownerUserId
      const order = await Order.create({
        user: ownerUserId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      // Try to cancel with a different user
      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/forbidden|access|permission/i);

      // Verify order is still pending
      const unchangedOrder = await Order.findById(order._id);
      expect(unchangedOrder.status).toBe("PENDING");
    });
  });

  describe("Validation failures", () => {
    it("should return 400 if order ID format is invalid", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);
      const invalidOrderId = "invalid-id-format";

      const res = await request(app)
        .post(`/api/orders/${invalidOrderId}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid.*id/i);
    });

    it("should return 404 if order does not exist", async () => {
      const userId = new mongoose.Types.ObjectId();
      const nonExistentOrderId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const res = await request(app)
        .post(`/api/orders/${nonExistentOrderId}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/not found/i);
    });
  });

  describe("Business rule failures - Order status restrictions", () => {
    it("should return 400 if order is already CANCELLED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "CANCELLED",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already.*cancel/i);
    });

    it("should return 400 if order is SHIPPED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "SHIPPED",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot.*cancel.*shipped/i);
    });

    it("should return 400 if order is DELIVERED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "DELIVERED",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot.*cancel.*delivered/i);
    });

    it("should return 400 if order is COMPLETED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "COMPLETED",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/cannot.*cancel.*completed/i);
    });
  });

  describe("Edge cases", () => {
    it("should handle cancellation request with extra whitespace in ID", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      // Add whitespace to the ID
      const orderIdWithSpace = ` ${order._id} `;

      const res = await request(app)
        .post(`/api/orders/${orderIdWithSpace}/cancel`)
        .set("Cookie", `token=${token}`);

      // Should either succeed (if trimmed) or return 400 for invalid format
      expect([200, 400]).toContain(res.status);
    });

    it("should maintain order data integrity after cancellation", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const originalOrderData = {
        user: userId,
        items: [
          {
            product: productId,
            quantity: 3,
            price: {
              amount: 300,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 300,
          currency: "INR",
        },
        shippingAddress: {
          street: "456 Park Ave",
          city: "Delhi",
          state: "DL",
          pincode: "110001",
          country: "India",
        },
      };

      const order = await Order.create(originalOrderData);

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(200);

      // Verify all data except status remains unchanged
      const cancelledOrder = await Order.findById(order._id);
      expect(cancelledOrder.user.toString()).toBe(userId.toString());
      expect(cancelledOrder.items[0].quantity).toBe(3);
      expect(cancelledOrder.totalPrice.amount).toBe(300);
      expect(cancelledOrder.shippingAddress.street).toBe("456 Park Ave");
      expect(cancelledOrder.status).toBe("CANCELLED");
    });
  });

  describe("Server error scenarios", () => {
    it("should return 500 if database error occurs during cancellation", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      // Mock database error
      jest
        .spyOn(Order, "findById")
        .mockRejectedValueOnce(new Error("Database connection failed"));

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(500);
      expect(res.body.message).toMatch(/internal.*server.*error/i);
    });
  });

  describe("Response structure validation", () => {
    it("should return properly formatted response on successful cancellation", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      expect(res.body).toHaveProperty("order");
      expect(res.body.order).toHaveProperty("_id");
      expect(res.body.order).toHaveProperty("status");
      expect(res.body.order).toHaveProperty("user");
      expect(res.body.order).toHaveProperty("items");
      expect(res.body.order).toHaveProperty("totalPrice");
      expect(res.body.order).toHaveProperty("shippingAddress");
    });
  });

  describe("Concurrent cancellation attempts", () => {
    it("should handle idempotent cancellation (cancelling already cancelled order)", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: {
              amount: 100,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 100,
          currency: "INR",
        },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      // First cancellation
      const res1 = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res1.status).toBe(200);
      expect(res1.body.order.status).toBe("CANCELLED");

      // Second cancellation attempt
      const res2 = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set("Cookie", `token=${token}`);

      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/already.*cancel/i);
    });
  });
});
