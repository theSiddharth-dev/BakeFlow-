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
const mockProduct = {
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
  save: jest.fn().mockImplementation(function () {
    return Promise.resolve(this);
  }),
};

jest.mock("../src/models/product.model", () => ({
  create: jest.fn(),
}));

const Product = require("../src/models/product.model");

// Mock the auth middleware
jest.mock("../src/middlewares/Auth.middleware", () => {
  return jest.fn((roles) => (req, res, next) => {
    req.user = { id: "user123", role: "admin" }; // Mock user
    next();
  });
});

// Mock the validation middleware
jest.mock("../src/validations/product.validation", () => ({
  validateProduct: jest.fn((req, res, next) => next()),
}));

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

describe("POST /api/products", () => {
  beforeEach(() => {
    productController.createProduct.mockClear();
  });

  it("should create a new product with images", async () => {
    productController.createProduct.mockImplementation((req, res) => {
      res.status(201).json(mockProduct);
    });

    const productData = {
      title: "Test Product",
      description: "A test product",
      priceAmount: 100,
      owner: "user123",
    };

    const response = await request(app)
      .post("/api/products")
      .field("title", productData.title)
      .field("description", productData.description)
      .field("priceAmount", productData.priceAmount)
      .field("owner", productData.owner)
      .attach("images", Buffer.from("fake image"), "test.jpg");

    expect(response.status).toBe(201);
    expect(response.body.title).toBe(productData.title);
    expect(response.body.image).toHaveLength(1);
    expect(response.body.image[0].url).toBe(
      "https://ik.imagekit.io/test/image.jpg"
    );
  });

  it("should handle errors", async () => {
    productController.createProduct.mockImplementation((req, res) => {
      res.status(500).json({ error: "Database error" });
    });

    const response = await request(app)
      .post("/api/products")
      .field("title", "Test")
      .field("priceAmount", 100)
      .field("owner", "user123")
      .attach("images", Buffer.from("fake image"), "test.jpg");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Database error");
  });
});
