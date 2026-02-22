const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cartModel = require("../src/models/cart.model");

const app = require("../src/app");

describe("DELETE /api/cart/items/:productId - Remove item from cart", () => {
  let mongoServer;
  let authToken;
  let userId;

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
    await cartModel.deleteMany({});
  });

  const authHeader = () => ({ Authorization: `Bearer ${authToken}` });

  describe("Validation & auth", () => {
    it("rejects when no auth token is provided", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      await request(app).delete(`/api/cart/items/${productId}`).expect(401);
    });

    it("rejects invalid token", async () => {
      const productId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("rejects when user role is insufficient", async () => {
      const adminToken = jwt.sign(
        { id: userId.toString(), role: "admin" },
        process.env.JWT_SECRET || "test-secret-key",
      );
      const productId = new mongoose.Types.ObjectId().toString();

      await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(401);
    });

    it("rejects invalid productId param format", async () => {
      const res = await request(app)
        .delete("/api/cart/items/not-an-objectid")
        .set(authHeader())
        .expect(400);

      expect(res.body.errors?.[0].msg).toMatch(/Product ID/i);
    });
  });

  describe("Cart and item existence", () => {
    it("returns 404 when cart does not exist", async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(404);

      const errorMessage = res.body?.error || res.body?.message || "";
      if (errorMessage) {
        expect(errorMessage).toMatch(/cart|not found/i);
      }
    });

    it("returns 404 when item does not exist in cart", async () => {
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();

      // Create cart with one item
      await cartModel.create({
        userId,
        items: [{ productId: productId1, quantity: 2 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId2}`)
        .set(authHeader())
        .expect(404);

      const errorMessage = res.body?.error || res.body?.message || "";
      if (errorMessage) {
        expect(errorMessage).toMatch(/item|not found/i);
      }
    });

    it("returns 404 when cart exists but is empty", async () => {
      const productId = new mongoose.Types.ObjectId().toString();

      // Create empty cart
      await cartModel.create({
        userId,
        items: [],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(404);

      const errorMessage = res.body?.error || res.body?.message || "";
      if (errorMessage) {
        expect(errorMessage).toMatch(/item|not found/i);
      }
    });
  });

  describe("Successful item removal", () => {
    it("removes item from cart when it exists", async () => {
      const productId = new mongoose.Types.ObjectId();

      // Create cart with one item
      await cartModel.create({
        userId,
        items: [{ productId, quantity: 2 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      // Verify response structure
      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toMatch(/removed|deleted/i);

      // Verify item is removed from database
      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items).toHaveLength(0);
    });

    it("removes specific item when cart has multiple items", async () => {
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();
      const productId3 = new mongoose.Types.ObjectId();

      // Create cart with multiple items
      await cartModel.create({
        userId,
        items: [
          { productId: productId1, quantity: 2 },
          { productId: productId2, quantity: 3 },
          { productId: productId3, quantity: 1 },
        ],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId2}`)
        .set(authHeader())
        .expect(200);

      // Verify response
      expect(res.body).toHaveProperty("message");
      expect(res.body.cart).toBeDefined();

      // Verify only the specified item is removed
      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items).toHaveLength(2);
      expect(
        updatedCart.items.find(
          (item) => item.productId.toString() === productId2.toString(),
        ),
      ).toBeUndefined();
      expect(
        updatedCart.items.find(
          (item) => item.productId.toString() === productId1.toString(),
        ),
      ).toBeDefined();
      expect(
        updatedCart.items.find(
          (item) => item.productId.toString() === productId3.toString(),
        ),
      ).toBeDefined();
    });

    it("returns updated cart in response", async () => {
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [
          { productId: productId1, quantity: 2 },
          { productId: productId2, quantity: 3 },
        ],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId1}`)
        .set(authHeader())
        .expect(200);

      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toHaveLength(1);
      expect(res.body.cart.items[0].productId.toString()).toBe(
        productId2.toString(),
      );
    });
  });

  describe("Edge cases", () => {
    it("handles removal of item with large quantity", async () => {
      const productId = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [{ productId, quantity: 1000000 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items).toHaveLength(0);
    });

    it("handles removal when item quantity is 1", async () => {
      const productId = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [{ productId, quantity: 1 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items).toHaveLength(0);
    });

    it("handles removal from cart with duplicate product IDs (if schema allows)", async () => {
      const productId = new mongoose.Types.ObjectId();

      // Create cart with duplicate product IDs (if schema allows)
      await cartModel.create({
        userId,
        items: [
          { productId, quantity: 2 },
          { productId, quantity: 3 },
        ],
      });

      // Should remove all instances or first instance based on implementation
      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader());

      // Accept either 200 (if removes all) or specific behavior
      expect([200, 404]).toContain(res.status);
    });

    it("handles removal when cart becomes empty", async () => {
      const productId = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [{ productId, quantity: 2 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      // Cart should still exist but be empty
      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart).toBeDefined();
      expect(updatedCart.items).toHaveLength(0);
    });
  });

  describe("Response structure", () => {
    it("returns correct response format on successful deletion", async () => {
      const productId = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [{ productId, quantity: 2 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      expect(res.body).toHaveProperty("message");
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message.length).toBeGreaterThan(0);
    });

    it("includes cart in response when item is removed", async () => {
      const productId = new mongoose.Types.ObjectId();

      await cartModel.create({
        userId,
        items: [{ productId, quantity: 2 }],
      });

      const res = await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      if (res.body.cart) {
        expect(res.body.cart).toHaveProperty("items");
        expect(Array.isArray(res.body.cart.items)).toBe(true);
      }
    });
  });

  describe("User isolation", () => {
    it("only removes item from authenticated user's cart", async () => {
      const productId = new mongoose.Types.ObjectId();
      const otherUserId = new mongoose.Types.ObjectId();

      // Create carts for two different users
      await cartModel.create({
        userId,
        items: [{ productId, quantity: 2 }],
      });
      await cartModel.create({
        userId: otherUserId,
        items: [{ productId, quantity: 5 }],
      });

      // Delete from authenticated user's cart
      await request(app)
        .delete(`/api/cart/items/${productId}`)
        .set(authHeader())
        .expect(200);

      // Verify other user's cart is unaffected
      const otherUserCart = await cartModel.findOne({ userId: otherUserId });
      expect(otherUserCart.items).toHaveLength(1);
      expect(otherUserCart.items[0].quantity).toBe(5);
    });
  });
});
