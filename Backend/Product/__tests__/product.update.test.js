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
  findOne: jest.fn(),
  findByIdAndUpdate: jest.fn(),
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

describe("PATCH /api/products/:id", () => {
  beforeEach(() => {
    productController.updateProduct.mockClear();
  });

  it("should update product fields successfully", async () => {
    const updatedProduct = {
      ...mockProductResponse,
      title: "Updated Product",
      description: "Updated description",
      price: { amount: 150, currency: "INR" },
    };

    productController.updateProduct.mockImplementation((req, res) => {
      res.status(200).json({ product: updatedProduct });
    });

    const updateData = {
      title: "Updated Product",
      description: "Updated description",
      priceAmount: 150,
    };

    const response = await request(app)
      .patch("/api/products/123")
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.product.title).toBe("Updated Product");
    expect(response.body.product.description).toBe("Updated description");
    expect(response.body.product.price.amount).toBe(150);
  });

  it("should update only provided fields", async () => {
    const updatedProduct = {
      ...mockProductResponse,
      title: "Updated Title Only",
    };

    productController.updateProduct.mockImplementation((req, res) => {
      res.status(200).json({ product: updatedProduct });
    });

    const updateData = {
      title: "Updated Title Only",
    };

    const response = await request(app)
      .patch("/api/products/123")
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.product.title).toBe("Updated Title Only");
    expect(response.body.product.description).toBe(
      mockProductResponse.description
    ); // unchanged
  });

  it("should return 404 if product not found", async () => {
    productController.updateProduct.mockImplementation((req, res) => {
      res.status(404).json({ message: "Product not found" });
    });

    const updateData = {
      title: "Updated Product",
    };

    const response = await request(app)
      .patch("/api/products/123")
      .send(updateData);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Product not found");
  });

  it("should handle database errors", async () => {
    productController.updateProduct.mockImplementation((req, res) => {
      res.status(500).json({ error: "Database error" });
    });

    const updateData = {
      title: "Updated Product",
    };

    const response = await request(app)
      .patch("/api/products/123")
      .send(updateData);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Database error");
  });

  it("should handle invalid ObjectId format", async () => {
    productController.updateProduct.mockImplementation((req, res) => {
      res.status(400).json({ message: "Invalid product id" });
    });

    const updateData = {
      title: "Updated Product",
    };

    const response = await request(app)
      .patch("/api/products/invalid-id")
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid product id");
  });
});
