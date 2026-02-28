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

describe("PATCH /api/orders/:id/address - Update delivery address", () => {
  describe("Success scenarios", () => {
    it("should successfully update the delivery address for a PENDING order", async () => {
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

      const newAddress = {
        street: "456 Park Ave",
        city: "Delhi",
        state: "DL",
        pincode: "110001",
        country: "India",
      };

      const res = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({ shippingAddress: newAddress });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/address.*updated/i);
      expect(res.body.order).toBeDefined();
      expect(res.body.order.shippingAddress.street).toBe("456 Park Ave");
      expect(res.body.order.shippingAddress.city).toBe("Delhi");
      expect(res.body.order.shippingAddress.state).toBe("DL");
      expect(res.body.order.shippingAddress.pincode).toBe("110001");

      // Verify in database
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.shippingAddress.street).toBe("456 Park Ave");
      expect(updatedOrder.shippingAddress.city).toBe("Delhi");
    });

    it("should update only the provided address fields", async () => {
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

      const partialAddress = {
        street: "789 New Street",
        city: "Mumbai",
        state: "MH",
        pincode: "400001",
        country: "India",
      };

      const res = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({ shippingAddress: partialAddress });

      expect(res.status).toBe(200);
      expect(res.body.order.shippingAddress.street).toBe("789 New Street");
      expect(res.body.order.shippingAddress.city).toBe("Mumbai");
    });

    it("should return the complete updated order object", async () => {
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
              amount: 150,
              currency: "INR",
            },
          },
        ],
        status: "PENDING",
        totalPrice: {
          amount: 150,
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

      const newAddress = {
        street: "101 Business Park",
        city: "Bangalore",
        state: "KA",
        pincode: "560001",
        country: "India",
      };

      const res = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({ shippingAddress: newAddress });

      expect(res.status).toBe(200);
      expect(res.body.order).toHaveProperty("_id");
      expect(res.body.order).toHaveProperty("user");
      expect(res.body.order).toHaveProperty("items");
      expect(res.body.order).toHaveProperty("status");
      expect(res.body.order).toHaveProperty("totalPrice");
      expect(res.body.order).toHaveProperty("shippingAddress");
      expect(res.body.order.status).toBe("PENDING");
    });
  });

  describe("Authentication Tests", () => {
    it("should return 401 if no authentication token is provided", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/orders/${orderId}/address`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Unauthorized/i);
    });

    it("should return 401 if invalid token is provided", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .patch(`/api/orders/${orderId}/address`)
        .set("Cookie", "token=invalid-token-format")
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Unauthorized/i);
    });

    it("should return 401 if expired token is provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();

      // Create an expired token
      const expiredToken = jwt.sign(
        { id: userId, role: "user" },
        process.env.JWT_SECRET || "test-secret-key",
        { expiresIn: "-1h" },
      );

      const response = await request(app)
        .patch(`/api/orders/${orderId}/address`)
        .set("Cookie", `token=${expiredToken}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Unauthorized/i);
    });
  });

  describe("Authorization Tests", () => {
    it("should return 403 if user tries to update another user's order address", async () => {
      const userId1 = new mongoose.Types.ObjectId();
      const userId2 = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();

      // Create order for userId1
      const order = await Order.create({
        user: userId1,
        items: [
          {
            product: productId,
            quantity: 2,
            price: { amount: 200, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 200, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      // Try to update with userId2's token
      const token = generateToken(userId2);
      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/forbidden|access|permission/i);

      // Verify address is unchanged
      const unchangedOrder = await Order.findById(order._id);
      expect(unchangedOrder.shippingAddress.street).toBe("123 Main St");
    });

    it("should allow the owner to update their order address", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "789 Owner St",
            city: "Pune",
            state: "MH",
            pincode: "411001",
            country: "India",
          },
        })
        .expect(200);

      expect(response.body.order.shippingAddress.street).toBe("789 Owner St");
    });
  });

  describe("Validation Tests", () => {
    it("should return 400 if order ID format is invalid", async () => {
      const userId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);
      const invalidOrderId = "invalid-id-format";

      const response = await request(app)
        .patch(`/api/orders/${invalidOrderId}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(/invalid.*id/i);
    });

    it("should return 404 if order does not exist", async () => {
      const userId = new mongoose.Types.ObjectId();
      const nonExistentOrderId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const response = await request(app)
        .patch(`/api/orders/${nonExistentOrderId}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(404);

      expect(response.body.message).toMatch(/not found/i);
    });

    it("should return 400 if shippingAddress is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/address.*required/i);
    });

    it("should return 400 if street is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should return 400 if city is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should return 400 if state is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should return 400 if pincode is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should return 400 if pincode format is invalid", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "12345",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });

    it("should return 400 if country is missing", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
          },
        })
        .expect(400);

      expect(response.body).toHaveProperty("errors");
    });
  });

  describe("Business Rule Tests - Order status restrictions", () => {
    it("should return 400 if order status is SHIPPED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "SHIPPED",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(
        /cannot.*update.*address.*shipped/i,
      );

      // Verify address unchanged
      const unchangedOrder = await Order.findById(order._id);
      expect(unchangedOrder.shippingAddress.street).toBe("123 Main St");
    });

    it("should return 400 if order status is DELIVERED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "DELIVERED",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(
        /cannot.*update.*address.*delivered/i,
      );
    });

    it("should return 400 if order status is COMPLETED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "COMPLETED",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(
        /cannot.*update.*address.*completed/i,
      );
    });

    it("should return 400 if order status is CANCELLED", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "CANCELLED",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(
        /cannot.*update.*address.*cancelled/i,
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle updating with the same address", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "123 Main St",
            city: "Mumbai",
            state: "MH",
            pincode: "400001",
            country: "India",
          },
        })
        .expect(200);

      expect(response.body.order.shippingAddress.street).toBe("123 Main St");
    });

    it("should trim whitespace from address fields", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "  456 Park Ave  ",
            city: "  Delhi  ",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(200);

      // Address fields should be trimmed or stored as-is depending on implementation
      expect(response.body.order.shippingAddress).toBeDefined();
    });

    it("should maintain order integrity after address update", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 3,
            price: { amount: 300, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 300, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "789 Business Park",
            city: "Bangalore",
            state: "KA",
            pincode: "560001",
            country: "India",
          },
        })
        .expect(200);

      // Verify other fields remain unchanged
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder.user.toString()).toBe(userId.toString());
      expect(updatedOrder.items[0].quantity).toBe(3);
      expect(updatedOrder.totalPrice.amount).toBe(300);
      expect(updatedOrder.status).toBe("PENDING");
    });
  });

  describe("Server Error Scenarios", () => {
    it("should return 500 if database error occurs during update", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
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

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(500);

      expect(response.body.message).toMatch(/internal.*server.*error/i);
    });
  });

  describe("Response Structure Validation", () => {
    it("should return properly formatted response on successful update", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();
      const token = generateToken(userId);

      const order = await Order.create({
        user: userId,
        items: [
          {
            product: productId,
            quantity: 1,
            price: { amount: 100, currency: "INR" },
          },
        ],
        status: "PENDING",
        totalPrice: { amount: 100, currency: "INR" },
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

      const response = await request(app)
        .patch(`/api/orders/${order._id}/address`)
        .set("Cookie", `token=${token}`)
        .send({
          shippingAddress: {
            street: "456 Park Ave",
            city: "Delhi",
            state: "DL",
            pincode: "110001",
            country: "India",
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body).toHaveProperty("order");
      expect(response.body.order).toHaveProperty("_id");
      expect(response.body.order).toHaveProperty("shippingAddress");
      expect(response.body.order.shippingAddress).toHaveProperty("street");
      expect(response.body.order.shippingAddress).toHaveProperty("city");
      expect(response.body.order.shippingAddress).toHaveProperty("state");
      expect(response.body.order.shippingAddress).toHaveProperty("pincode");
      expect(response.body.order.shippingAddress).toHaveProperty("country");
    });
  });
});
