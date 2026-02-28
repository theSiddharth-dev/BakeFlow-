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
  findOne: jest.fn(),
  findByIdAndDelete: jest.fn(),
}));

const Product = require("../src/models/product.model");

// Mock the auth middleware
jest.mock("../src/middlewares/Auth.middleware", () => {
  return jest.fn((roles) => (req, res, next) => {
    req.user = { id: "user123", role: "admin" }; // Mock user
    next();
  });
});

// Mock the product controller
jest.mock("../src/Controllers/Product.controller", () => ({
  createProduct: jest.fn(),
  getProducts: jest.fn(),
  getProductById: jest.fn(),
  updateProduct: jest.fn(),
<<<<<<< HEAD
  reserveInventory: jest.fn(),
  releaseInventory: jest.fn(),
=======
>>>>>>> 67354662e4367294a6848e3b2f2e0eb4582a3050
  deleteProduct: jest.fn(),
  getProductsByOwner: jest.fn(),
}));

const productController = require("../src/Controllers/Product.controller");

// Now require the routes after all mocks are set up
const productRoutes = require("../src/routes/product.routes");

const app = express();
app.use(express.json());
app.use("/api/products", productRoutes);

describe("DELETE /api/products/:id", () => {
  beforeEach(() => {
    productController.deleteProduct.mockClear();
  });

  it("should delete product successfully", async () => {
    productController.deleteProduct.mockImplementation((req, res) => {
      res.status(200).json({ message: "Product deleted successfully" });
    });

    const response = await request(app).delete("/api/products/123");

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Product deleted successfully");
  });

  it("should return 404 if product not found", async () => {
    productController.deleteProduct.mockImplementation((req, res) => {
      res.status(404).json({ message: "Product not found" });
    });

    const response = await request(app).delete("/api/products/123");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Product not found");
  });

  it("should return 404 if product doesn't belong to user", async () => {
    productController.deleteProduct.mockImplementation((req, res) => {
      res.status(404).json({ message: "Product not found" });
    });

    const response = await request(app).delete("/api/products/123");

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Product not found");
  });

  it("should handle database errors", async () => {
    productController.deleteProduct.mockImplementation((req, res) => {
      res.status(500).json({ error: "Database error" });
    });

    const response = await request(app).delete("/api/products/123");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Database error");
  });

  it("should handle invalid ObjectId format", async () => {
    productController.deleteProduct.mockImplementation((req, res) => {
      res.status(400).json({ message: "Invalid product id" });
    });

    const response = await request(app).delete("/api/products/invalid-id");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid product id");
  });
});
