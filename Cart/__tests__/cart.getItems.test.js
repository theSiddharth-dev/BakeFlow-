const request = require("supertest");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const cartModel = require("../src/models/cart.model");

// Mock the product service
jest.mock("axios", () => ({
  get: jest.fn(),
}));

const axios = require("axios");

// Import app
const app = require("../src/app");

describe("GET /api/cart/items - Fetch Cart Items with Totals", () => {
  let mongoServer;
  let authToken;
  let userId;

  // Increase timeout for hooks (MongoDB Memory Server can take time to start)
  jest.setTimeout(30000); // 30 seconds

  beforeAll(async () => {
    try {
      // Start MongoDB Memory Server
      mongoServer = await MongoMemoryServer.create({
        instance: {
          dbName: "test-cart-db",
          launchTimeout: 60000,
        },
      });
      const mongoUri = mongoServer.getUri();

      // Connect mongoose to the in-memory database
      await mongoose.connect(mongoUri);

      // Generate a test JWT token
      userId = new mongoose.Types.ObjectId();
      authToken = jwt.sign(
        { id: userId.toString(), role: "user" },
        process.env.JWT_SECRET || "test-secret-key",
      );
    } catch (error) {
      console.error("Error setting up test database:", error);
      throw error;
    }
  }, 30000); // 30 second timeout for this hook

  afterAll(async () => {
    // Disconnect mongoose and stop the in-memory server
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      if (mongoServer) {
        await mongoServer.stop();
      }
    } catch (error) {
      console.error("Error cleaning up test database:", error);
    }
  }, 30000); // 30 second timeout for cleanup

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear the cart collection before each test
    await cartModel.deleteMany({});
  });

  describe("Authentication", () => {
    it("should return 401 if no token is provided", async () => {
      const response = await request(app).get("/api/cart/items").expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Unauthorized");
    });

    it("should return 401 if invalid token is provided", async () => {
      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Invalid token");
    });

    it("should return 401 if user role is insufficient", async () => {
      const adminToken = jwt.sign(
        { id: userId.toString(), role: "admin" },
        process.env.JWT_SECRET || "test-secret-key",
      );

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("Insufficient permissions");
    });
  });

  describe("Cart Retrieval", () => {
    it("should return empty cart if user has no cart", async () => {
      // No cart created in database

      // Mock product service to return empty array (no products to fetch)
      axios.get.mockResolvedValue({ data: [] });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("totals");
      expect(response.body.items).toEqual([]);
      expect(response.body.totals.subtotal).toBe(0);
      expect(response.body.totals.total).toBe(0);
    });

    it("should fetch cart items for authenticated user", async () => {
      // Create a cart in the database
      const cart = await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      // Mock product service responses
      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("totals");
      expect(response.body.items).toHaveLength(2);
    });
  });

  describe("Price Fetching from Product Service (Anti-Tampering)", () => {
    it("should fetch prices from product service, not from cart items", async () => {
      // Create cart in database (cart schema doesn't store price, but if it did, it would be ignored)
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
        ],
      });

      // Product service returns correct price
      const correctProduct = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99, // Correct price from service
      };

      axios.get.mockResolvedValue({ data: correctProduct });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify product service was called
      expect(axios.get).toHaveBeenCalled();

      // Verify the price used is from product service, not cart
      expect(response.body.items[0].price).toBe(10.99);

      // Verify totals use correct price
      const expectedSubtotal = 10.99 * 2;
      expect(response.body.totals.subtotal).toBe(expectedSubtotal);
    });

    it("should call product service for each unique product ID", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Verify product service was called for each product
      expect(axios.get).toHaveBeenCalledTimes(2);

      // Verify correct product IDs were requested
      const productServiceUrl =
        process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";
      expect(axios.get).toHaveBeenCalledWith(
        `${productServiceUrl}/api/products/507f1f77bcf86cd799439011`,
      );
      expect(axios.get).toHaveBeenCalledWith(
        `${productServiceUrl}/api/products/507f1f77bcf86cd799439012`,
      );
    });

    it("should handle product service returning different price than stored", async () => {
      // Create cart in database (no price stored, as it should be)
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
        ],
      });

      // Product service returns updated price
      const updatedProduct = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 15.99, // Updated price
      };

      axios.get.mockResolvedValue({ data: updatedProduct });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should use updated price from service
      expect(response.body.items[0].price).toBe(15.99);
      expect(response.body.totals.subtotal).toBe(15.99 * 2);
    });

    it("should reject items if product service returns 404 (product not found)", async () => {
      // Create cart with two items
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      // First product exists, second doesn't
      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockRejectedValueOnce({ response: { status: 404 } });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should only return valid products
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0].productId).toBe("507f1f77bcf86cd799439011");
    });
  });

  describe("Totals Calculation", () => {
    it("should calculate correct subtotal from product service prices", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const expectedSubtotal = 10.99 * 2 + 25.5 * 3;
      expect(response.body.totals.subtotal).toBeCloseTo(expectedSubtotal, 2);
    });

    it("should calculate total including tax if applicable", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totals).toHaveProperty("subtotal");
      expect(response.body.totals).toHaveProperty("total");

      // Total should be >= subtotal (may include tax, shipping, etc.)
      expect(response.body.totals.total).toBeGreaterThanOrEqual(
        response.body.totals.subtotal,
      );
    });

    it("should handle zero quantity items correctly", async () => {
      // Create cart with zero quantity (though schema validation might prevent this)
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 0,
          },
        ],
      });

      const product = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      axios.get.mockResolvedValue({ data: product });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totals.subtotal).toBe(0);
    });
  });

  describe("Response Structure", () => {
    it("should return items with correct structure", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
        description: "Test product",
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("items");
      expect(response.body).toHaveProperty("totals");

      // Each item should have product info and quantity
      expect(response.body.items[0]).toHaveProperty("productId");
      expect(response.body.items[0]).toHaveProperty("quantity");
      expect(response.body.items[0]).toHaveProperty("price");
      expect(response.body.items[0]).toHaveProperty("name");
    });

    it("should return totals with correct structure", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"),
            quantity: 3,
          },
        ],
      });

      const product1 = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      const product2 = {
        _id: "507f1f77bcf86cd799439012",
        name: "Product 2",
        price: 25.5,
      };

      axios.get
        .mockResolvedValueOnce({ data: product1 })
        .mockResolvedValueOnce({ data: product2 });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totals).toHaveProperty("subtotal");
      expect(response.body.totals).toHaveProperty("total");
      expect(typeof response.body.totals.subtotal).toBe("number");
      expect(typeof response.body.totals.total).toBe("number");
    });
  });

  describe("Error Handling", () => {
    it("should handle product service timeout gracefully", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
        ],
      });

      axios.get.mockRejectedValue(new Error("ECONNREFUSED"));

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(500);

      expect(response.body).toHaveProperty("error");
    });

    it("should handle invalid product data from service", async () => {
      // Create cart in database
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
        ],
      });

      // Product service returns invalid data (missing price)
      axios.get.mockResolvedValue({
        data: {
          _id: "507f1f77bcf86cd799439011",
          name: "Product 1",
          // Missing price
        },
      });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`);

      // Should either skip invalid items or return error
      // Adjust based on your implementation
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe("Edge Cases", () => {
    it("should handle cart with duplicate product IDs", async () => {
      // Create cart with duplicate product IDs
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 2,
          },
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 3,
          },
        ],
      });

      const product = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      axios.get.mockResolvedValue({ data: product });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      // Should handle duplicates appropriately (either merge or list separately)
      expect(response.body.items).toBeDefined();
    });

    it("should handle very large quantities", async () => {
      // Create cart with large quantity
      await cartModel.create({
        userId: userId,
        items: [
          {
            productId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
            quantity: 1000000,
          },
        ],
      });

      const product = {
        _id: "507f1f77bcf86cd799439011",
        name: "Product 1",
        price: 10.99,
      };
      axios.get.mockResolvedValue({ data: product });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      const expectedSubtotal = 10.99 * 1000000;
      expect(response.body.totals.subtotal).toBeCloseTo(expectedSubtotal, 2);
    });

    it("should handle empty cart items array", async () => {
      // Create cart with empty items array
      await cartModel.create({
        userId: userId,
        items: [],
      });

      const response = await request(app)
        .get("/api/cart/items")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toEqual([]);
      expect(response.body.totals.subtotal).toBe(0);
      expect(axios.get).not.toHaveBeenCalled();
    });
  });
});
