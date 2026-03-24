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

describe("GET /api/orders/:id - Get order by ID with timeline and payment summary", () => {
  describe("Authentication Tests", () => {
    it("should return 401 if no authentication token is provided", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Unauthorized|not authenticated/i);
    });

    it("should return 401 if invalid token is provided", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Cookie", "token=invalid-token-format")
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(/Invalid token|Unauthorized/i);
    });

    it("should return 401 if expired token is provided", async () => {
      const userId = new mongoose.Types.ObjectId();
      const orderId = new mongoose.Types.ObjectId();

      // Create an expired token
      const expiredToken = jwt.sign(
        { id: userId, role: "user" },
        process.env.JWT_SECRET || "test-secret-key",
        { expiresIn: "-1h" }, // Expired 1 hour ago
      );

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Cookie", `token=${expiredToken}`)
        .expect(401);

      expect(response.body).toHaveProperty("message");
      // The middleware returns generic "Unauthorized User" for security reasons
      expect(response.body.message).toMatch(/Unauthorized/i);
    });

    it("should return 401 if token is malformed", async () => {
      const orderId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/orders/${orderId}`)
        .set("Authorization", "Bearer malformed.token.here")
        .expect(401);

      expect(response.body).toHaveProperty("message");
    });
  });

  describe("Authorization Tests", () => {
    it("should return 403 if user tries to access another user's order", async () => {
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

      // Try to access with userId2's token
      const token = generateToken(userId2);
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set("Cookie", `token=${token}`)
        .expect(403);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toMatch(
        /forbidden|not authorized|access denied/i,
      );
    });

    it("should return 200 if user accesses their own order", async () => {
      const userId = new mongoose.Types.ObjectId();
      const productId = new mongoose.Types.ObjectId();

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

      const token = generateToken(userId);
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set("Cookie", `token=${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("order");
      expect(response.body.order._id.toString()).toBe(order._id.toString());
    });
  });
});
