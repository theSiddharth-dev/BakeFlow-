const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cartModel = require("../src/models/cart.model");

// Mock external product service calls
jest.mock("axios", () => ({
  get: jest.fn(),
}));

const axios = require("axios");
const app = require("../src/app");

describe("PATCH /api/cart/items/:productId - Update item quantity", () => {
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
      const productId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .patch(`/api/cart/items/${productId}`)
        .send({ qty: 2 })
        .expect(401);
    });

    it("rejects invalid productId param", async () => {
      const res = await request(app)
        .patch("/api/cart/items/not-an-objectid")
        .set(authHeader())
        .send({ qty: 2 })
        .expect(400);

      expect(res.body.errors?.[0].msg).toMatch(/Product ID/i);
    });

    it("rejects non-positive qty", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 0 })
        .expect(400);

      expect(res.body.errors?.[0].msg).toMatch(/Quantity/i);
    });
  });

  describe("Availability checks", () => {
    it("returns 404 when product service reports not found", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockRejectedValue({ response: { status: 404 } });

      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 2 })
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

      // Create cart with item
      await cartModel.create({
        userId,
        items: [{ productId, quantity: 1 }],
      });

      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 5 })
        .expect(409);

      expect(res.body.error || res.body.message).toMatch(/stock/i);
    });
  });

  describe("Cart update behaviour", () => {
    it("returns 404 when cart or item is missing", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      axios.get.mockResolvedValue({
        data: { _id: productId, name: "Product A", stock: 5, price: 10 },
      });

      await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 2 })
        .expect(404);
    });

    it("updates quantity when item exists", async () => {
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
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 3 })
        .expect(200);

      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items[0].quantity).toBe(3);
      expect(res.body.cart?.items?.[0].quantity).toBe(3);
    });

    it("surfaces product service outage as 503", async () => {
      const productId = new mongoose.Types.ObjectId();
      await cartModel.create({
        userId,
        items: [{ productId, quantity: 1 }],
      });

      axios.get.mockRejectedValue(new Error("ECONNREFUSED"));

      const res = await request(app)
        .patch(`/api/cart/items/${productId}`)
        .set(authHeader())
        .send({ qty: 2 })
        .expect(503);

      expect(res.body.error || res.body.message).toMatch(/service/i);
    });
  });
});
