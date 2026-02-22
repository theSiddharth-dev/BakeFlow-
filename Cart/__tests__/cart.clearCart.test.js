const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cartModel = require("../src/models/cart.model");

const app = require("../src/app");

describe("DELETE /api/cart/ - Clear cart", () => {
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
      await request(app).delete("/api/cart/").expect(401);
    });

    it("rejects invalid token", async () => {
      await request(app)
        .delete("/api/cart/")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);
    });

    it("rejects when user role is insufficient", async () => {
      const adminToken = jwt.sign(
        { id: userId.toString(), role: "admin" },
        process.env.JWT_SECRET || "test-secret-key",
      );
      await request(app)
        .delete("/api/cart/")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(401);
    });
  });

  describe("Cart existence checks", () => {
    it("returns 404 when cart does not exist", async () => {
      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(404);

      expect(res.body.error).toBe("Cart not found");
    });

    it("successfully clears an empty cart", async () => {
      // Create an empty cart
      const cart = new cartModel({ userId, items: [] });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body).toHaveProperty("message");
      expect(res.body.message).toBe("Cart cleared successfully");
      expect(res.body.cart).toBeDefined();
      expect(res.body.cart.items).toEqual([]);
    });
  });

  describe("Successful cart clearing", () => {
    it("clears cart with single item", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.message).toBe("Cart cleared successfully");
      expect(res.body.cart.items).toHaveLength(0);

      // Verify in database
      const updatedCart = await cartModel.findOne({ userId });
      expect(updatedCart.items).toHaveLength(0);
    });

    it("clears cart with multiple items", async () => {
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();
      const productId3 = new mongoose.Types.ObjectId();

      const cart = new cartModel({
        userId,
        items: [
          { productId: productId1, quantity: 5 },
          { productId: productId2, quantity: 3 },
          { productId: productId3, quantity: 2 },
        ],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart.items).toHaveLength(0);
      expect(res.body.cart.items).toEqual([]);
    });

    it("clears cart with items of large quantities", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 999999 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart.items).toHaveLength(0);
    });
  });

  describe("Response structure", () => {
    it("returns correct response format on successful clear", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 2 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body).toHaveProperty("message");
      expect(typeof res.body.message).toBe("string");
      expect(res.body).toHaveProperty("cart");
      expect(typeof res.body.cart).toBe("object");
    });

    it("returns cleared cart object in response", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart).toHaveProperty("_id");
      expect(res.body.cart).toHaveProperty("userId");
      expect(res.body.cart).toHaveProperty("items");
      expect(res.body.cart.items).toBeInstanceOf(Array);
    });

    it("returns cart with correct userId", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart.userId.toString()).toBe(userId.toString());
    });
  });

  describe("User isolation", () => {
    it("only clears the authenticated user's cart", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();

      // Create cart for authenticated user
      const userCart = new cartModel({
        userId,
        items: [{ productId: productId1, quantity: 3 }],
      });
      await userCart.save();

      // Create cart for another user
      const otherUserCart = new cartModel({
        userId: otherUserId,
        items: [{ productId: productId2, quantity: 5 }],
      });
      await otherUserCart.save();

      // Clear authenticated user's cart
      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      // Verify authenticated user's cart is cleared
      expect(res.body.cart.items).toHaveLength(0);

      // Verify other user's cart is unaffected
      const otherUserCartCheck = await cartModel.findOne({
        userId: otherUserId,
      });
      expect(otherUserCartCheck.items).toHaveLength(1);
      expect(otherUserCartCheck.items[0].productId.toString()).toBe(
        productId2.toString(),
      );
    });

    it("does not affect carts of other users when clearing", async () => {
      const otherUserId = new mongoose.Types.ObjectId();
      const otherAuthToken = jwt.sign(
        { id: otherUserId.toString(), role: "user" },
        process.env.JWT_SECRET || "test-secret-key",
      );

      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();

      // Create carts for both users
      const userCart = new cartModel({
        userId,
        items: [{ productId: productId1, quantity: 2 }],
      });
      await userCart.save();

      const otherUserCart = new cartModel({
        userId: otherUserId,
        items: [{ productId: productId2, quantity: 4 }],
      });
      await otherUserCart.save();

      // Clear first user's cart
      await request(app)
        .delete("/api/cart/")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Clear second user's cart
      const res = await request(app)
        .delete("/api/cart/")
        .set("Authorization", `Bearer ${otherAuthToken}`)
        .expect(200);

      expect(res.body.cart.items).toHaveLength(0);

      // Verify both carts are now cleared
      const userCartCheck = await cartModel.findOne({ userId });
      const otherCartCheck = await cartModel.findOne({ userId: otherUserId });

      expect(userCartCheck.items).toHaveLength(0);
      expect(otherCartCheck.items).toHaveLength(0);
    });
  });

  describe("Data persistence", () => {
    it("persists cleared cart in database", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      await request(app).delete("/api/cart/").set(authHeader()).expect(200);

      const persistedCart = await cartModel.findOne({ userId });
      expect(persistedCart).toBeDefined();
      expect(persistedCart.items).toHaveLength(0);
    });

    it("maintains cart id after clearing", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();
      const cartId = cart._id.toString();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart._id.toString()).toBe(cartId);
    });

    it("maintains userId after clearing", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart.userId.toString()).toBe(userId.toString());
    });
  });

  describe("Edge cases", () => {
    it("can clear cart multiple times consecutively", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 1 }],
      });
      await cart.save();

      // First clear
      const res1 = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res1.body.cart.items).toHaveLength(0);

      // Second clear on already empty cart
      const res2 = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res2.body.cart.items).toHaveLength(0);
      expect(res2.body.message).toBe("Cart cleared successfully");
    });

    it("handles clearing cart with mixed quantity items", async () => {
      const productId1 = new mongoose.Types.ObjectId();
      const productId2 = new mongoose.Types.ObjectId();
      const productId3 = new mongoose.Types.ObjectId();

      const cart = new cartModel({
        userId,
        items: [
          { productId: productId1, quantity: 1 },
          { productId: productId2, quantity: 100 },
          { productId: productId3, quantity: 50 },
        ],
      });
      await cart.save();

      const res = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      expect(res.body.cart.items).toHaveLength(0);
    });

    it("returns 200 even when clearing already empty cart", async () => {
      const cart = new cartModel({
        userId,
        items: [],
      });
      await cart.save();

      await request(app).delete("/api/cart/").set(authHeader()).expect(200);
    });
  });

  describe("Idempotency", () => {
    it("clearing cart is idempotent", async () => {
      const productId = new mongoose.Types.ObjectId();
      const cart = new cartModel({
        userId,
        items: [{ productId, quantity: 5 }],
      });
      await cart.save();

      // First request
      const res1 = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      // Second identical request
      const res2 = await request(app)
        .delete("/api/cart/")
        .set(authHeader())
        .expect(200);

      // Both should return empty cart
      expect(res1.body.cart.items).toEqual([]);
      expect(res2.body.cart.items).toEqual([]);
    });
  });
});
