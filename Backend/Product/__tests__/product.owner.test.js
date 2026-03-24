const productController = require("../src/Controllers/Product.controller");

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

describe("getProductsByOwner controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: "user123" },
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    Product.find.mockClear();
  });

  it("should return products owned by the user", async () => {
    const mockProducts = [
      { title: "Product 1", owner: "user123" },
      { title: "Product 2", owner: "user123" },
    ];

    Product.find.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockProducts),
    });

    await productController.getProductsByOwner(req, res);

    expect(Product.find).toHaveBeenCalledWith({ owner: "user123" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: mockProducts });
  });

  it("should handle pagination", async () => {
    req.query = { skip: "5", limit: "10" };
    const mockProducts = [{ title: "Product 1", owner: "user123" }];

    const mockQuery = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockProducts),
    };
    Product.find.mockReturnValue(mockQuery);

    await productController.getProductsByOwner(req, res);

    expect(mockQuery.skip).toHaveBeenCalledWith(5);
    expect(mockQuery.limit).toHaveBeenCalledWith(10);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: mockProducts });
  });

  it("should use default pagination values", async () => {
    const mockProducts = [{ title: "Product 1", owner: "user123" }];

    const mockQuery = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockProducts),
    };
    Product.find.mockReturnValue(mockQuery);

    await productController.getProductsByOwner(req, res);

    expect(mockQuery.skip).toHaveBeenCalledWith(0);
    expect(mockQuery.limit).toHaveBeenCalledWith(20);
  });

  it("should handle database errors", async () => {
    const error = new Error("Database error");
    Product.find.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockRejectedValue(error),
    });

    await productController.getProductsByOwner(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Database error" });
  });
});
