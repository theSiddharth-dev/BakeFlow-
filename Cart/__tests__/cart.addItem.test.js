const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cartModel = require("../src/models/cart.model");

// Mock external product service calls
jest.mock("axios", () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const axios = require("axios");
const app = require("../src/app");

describe("POST /api/cart/items - Add item with availability + optional soft reserve", () => {
  let mongoServer;
  let authToken;
  let userId;
  const productServiceUrl =
    process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";

  jest.setTimeout(30000);

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { dbName: "test-cart-db", launchTimeout: 60000 },
    });
    await mongoose.connect(mongoServer.getUri());

    userId = new mongoose.Types.ObjectId();
    authToken = jwt.sign(
      { id: userId.toString(), role: "user" },
      process.env.JWT_SECRET || "test-secret-key",
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await cartModel.deleteMany({});
  });

  const authHeader = () => ({ Authorization: `Bearer ${authToken}` });

  describe("Validation & auth", () => {
    it("rejects when no auth token is provided", async () => {
      await request(app)
        .post("/api/cart/items")
        .send({ productId: new mongoose.Types.ObjectId().toString(), qty: 2 })
        .expect(401);
    });

    it("rejects invalid productId", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId: "not-an-objectid", qty: 1 })
        .expect(400);

      expect(res.body.errors?.[0].msg).toMatch(/Product ID/i);
    });

    it("rejects non-positive qty", async () => {
      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId: new mongoose.Types.ObjectId().toString(), qty: 0 })
        .expect(400);

      expect(res.body.errors?.[0].msg).toMatch(/Quantity/i);
    });
  });

  describe("Availability checks", () => {
    it("returns 404 when product service reports not found", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId, qty: 2 })
        .expect(404);

      expect(axios.get).toHaveBeenCalledWith(
        `${productServiceUrl}/api/products/${productId}`,
      );
      expect(res.body.error || res.body.message).toMatch(/not found/i);
    });

    it("returns 409 when requested qty exceeds available stock", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockResolvedValue({
        data: { _id: productId, name: "Product A", stock: 1, price: 10 },
      });

      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId, qty: 5 })
        .expect(409);

      expect(res.body.error || res.body.message).toMatch(/stock/i);
    });
  });

  describe("Cart updates without reservation", () => {
    it("creates a new cart entry when none exists", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockResolvedValue({
        data: { _id: productId, name: "Product A", stock: 5, price: 10 },
      });

      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId, qty: 2 })
        .expect(201);

      expect(axios.get).toHaveBeenCalledWith(
        `${productServiceUrl}/api/products/${productId}`,
      );
      expect(res.body.cart?.items?.[0].productId?.toString()).toBe(productId);
      expect(res.body.cart?.items?.[0].quantity).toBe(2);
    });

    it("increments quantity when item already exists", async () => {
      const productId = new mongoose.Types.ObjectId();
      await cartModel.create({
        userId,
        items: [{ productId, quantity: 1 }],
      });

      axios.get.mockResolvedValue({
        data: {
          _id: productId.toString(),
          name: "Product A",
          stock: 10,
          price: 10,
        },
      });

      const res = await request(app)
        .post("/api/cart/items")
        .set(authHeader())
        .send({ productId: productId.toString(), qty: 2 })
        .expect(200);

      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items[0].quantity).toBe(3);
      expect(res.body.cart?.items?.[0].quantity).toBe(3);
    });
  });

  describe("Optional soft stock reservation", () => {
    it("calls reservation endpoint when reserve=true", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockResolvedValue({
        data: { _id: productId, name: "Product A", stock: 5, price: 10 },
      });
      axios.post.mockResolvedValue({ data: { reserved: true } });

      await request(app)
        .post("/api/cart/items?reserve=true")
        .set(authHeader())
        .send({ productId, qty: 2 })
        .expect(201);

      expect(axios.post).toHaveBeenCalledWith(
        `${productServiceUrl}/api/products/${productId}/reserve`,
        { qty: 2, userId: userId.toString() },
      );
    });

    it("surfaces reservation failure as service unavailable", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockResolvedValue({
        data: { _id: productId, name: "Product A", stock: 5, price: 10 },
      });
      axios.post.mockRejectedValue(new Error("reservation failed"));

      const res = await request(app)
        .post("/api/cart/items?reserve=true")
        .set(authHeader())
        .send({ productId, qty: 1 })
        .expect(503);

      expect(res.body.error || res.body.message).toMatch(/reserve/i);
    });
  });
});
