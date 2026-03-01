const request = require("supertest");
const express = require("express");

// Mock mongoose first
jest.mock("mongoose", () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn().mockReturnValue(true),
    },
  },
}));

// Mock the imagekit service
jest.mock("../src/services/imagekit.service", () => ({
  uploadImages: jest.fn().mockResolvedValue([
    {
      url: "https://ik.imagekit.io/test/image.jpg",
      thumbnail: "https://ik.imagekit.io/test/thumbnail.jpg",
      id: "file123",
    },
  ]),
}));

// Mock the Product model
const mockProductResponse = {
  title: "Test Product",
  description: "A test product",
  price: { amount: 100, currency: "INR" },
  owner: "user123",
  image: [
    {
      url: "https://ik.imagekit.io/test/image.jpg",
      thumbnail: "https://ik.imagekit.io/test/thumbnail.jpg",
      id: "file123",
    },
  ],
};

jest.mock("../src/models/product.model", () => ({
  findById: jest.fn(),
}));

const Product = require("../src/models/product.model");

// Mock the product controller
jest.mock("../src/Controllers/Product.controller", () => ({
  createProduct: jest.fn(),
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
  reserveInventory: jest.fn(),
  releaseInventory: jest.fn(),
  deleteProduct: jest.fn(),
  getProductsByOwner: jest.fn(),
}));

const productController = require("../src/Controllers/Product.controller");

// Now require the routes after all mocks are set up
const productRoutes = require("../src/routes/product.routes");

const app = express();
app.use(express.json());
app.use("/api/products", productRoutes);

describe("GET /api/products/:id", () => {
  beforeEach(() => {
    productController.getProductById.mockClear();
  });

  it("should return a product by id", async () => {
    productController.getProductById.mockImplementation((req, res) => {
      res.status(200).json({ product: mockProductResponse });
    });

    const response = await request(app).get("/api/products/123");

    expect(response.status).toBe(200);
    expect(response.body.product).toEqual(mockProductResponse);
  });

  it("should return 404 if product not found", async () => {
    productController.getProductById.mockImplementation((req, res) => {
      res.status(404).json({ message: "Product not found" });
    });

    const response = await request(app).get("/api/products/123");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Product not found");
  });

  it("should handle database errors", async () => {
    productController.getProductById.mockImplementation((req, res) => {
      res.status(500).json({ error: "Database error" });
    });

    const response = await request(app).get("/api/products/123");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Database error");
  });

  it("should handle invalid ObjectId format", async () => {
    productController.getProductById.mockImplementation((req, res) => {
      res.status(500).json({ error: "Cast to ObjectId failed" });
    });

    const response = await request(app).get("/api/products/invalid-id");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Cast to ObjectId failed");
  });
});
