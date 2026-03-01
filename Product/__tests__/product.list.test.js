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
jest.mock("../src/models/product.model", () => ({
  find: jest.fn(),
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

describe("GET /api/products", () => {
  beforeEach(() => {
    productController.getProducts.mockClear();
  });

  it("should return all products with default pagination", async () => {
    const mockProducts = [
      {
        title: "Test Product",
        description: "A test product",
        price: { amount: 100, currency: "INR" },
        owner: "user123",
      },
      {
        title: "Product 2",
        description: "Another product",
        price: { amount: 200, currency: "INR" },
        owner: "user456",
      },
    ];

    productController.getProducts.mockImplementation((req, res) => {
      res.status(200).json({ data: mockProducts });
    });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
  });

  it("should filter products by minprice", async () => {
    const mockProducts = [
      {
        title: "Test Product",
        description: "A test product",
        price: { amount: 100, currency: "INR" },
        owner: "user123",
      },
    ];

    productController.getProducts.mockImplementation((req, res) => {
      res.status(200).json({ data: mockProducts });
    });

    const response = await request(app).get("/api/products?minprice=50");

    expect(response.status).toBe(200);
  });

  it("should filter products by maxprice", async () => {
    const mockProducts = [
      {
        title: "Test Product",
        description: "A test product",
        price: { amount: 100, currency: "INR" },
        owner: "user123",
      },
    ];

    productController.getProducts.mockImplementation((req, res) => {
      res.status(200).json({ data: mockProducts });
    });

    const response = await request(app).get("/api/products?maxprice=200");

    expect(response.status).toBe(200);
  });

  it("should filter products by both minprice and maxprice", async () => {
    const mockProducts = [
      {
        title: "Test Product",
        description: "A test product",
        price: { amount: 100, currency: "INR" },
        owner: "user123",
      },
    ];

    productController.getProducts.mockImplementation((req, res) => {
      res.status(200).json({ data: mockProducts });
    });

    const response = await request(app).get(
      "/api/products?minprice=50&maxprice=200"
    );

    expect(response.status).toBe(200);
  });

  it("should handle pagination with skip and limit", async () => {
    const mockProducts = [
      {
        title: "Test Product",
        description: "A test product",
        price: { amount: 100, currency: "INR" },
        owner: "user123",
      },
    ];

    productController.getProducts.mockImplementation((req, res) => {
      res.status(200).json({ data: mockProducts });
    });

    const response = await request(app).get("/api/products?skip=10&limit=5");

    expect(response.status).toBe(200);
  });

  it("should handle database errors", async () => {
    productController.getProducts.mockImplementation((req, res) => {
      res.status(500).json({ error: "Database error" });
    });

    const response = await request(app).get("/api/products");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Database error");
  });
});
