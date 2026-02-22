// Set timeout for MongoMemoryServer binary download/startup
process.env.MONGOMS_STARTUP_TIMEOUT = "60000";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const Order = require("../src/models/order.model");

jest.mock("axios");
jest.setTimeout(60000); // 1 minute timeout

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: "6.0.6",
      skipMD5: true,
    },
    spawn: { startupTimeout: 60000 },
  });

  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 300000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
  }
  jest.clearAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId, role: "user" },
    process.env.JWT_SECRET || "test-secret-key",
    { expiresIn: "1h" },
  );
};

// create a order by logged in user
describe("POST /api/orders", () => {
  it("should create an order successfully", async () => {
    const userId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    // Mock Cart Service Response
    axios.get.mockImplementation((url) => {
      if (url.includes("/cart/items")) {
        return Promise.resolve({
          data: {
            items: [{ productId: productId, quantity: 2 }],
          },
        });
      }
      if (url.includes(`/products/${productId}`)) {
        return Promise.resolve({
          data: {
            product: {
              _id: productId,
              title: "Test Product",
              stock: 10,
              price: { amount: 100, currency: "INR" },
            },
          },
        });
      }
      return Promise.reject(new Error("Not Found"));
    });

    // Mock Product Service Stock Update
    axios.put.mockResolvedValue({});

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${token}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

    // If this fails with 400/500, we know the controller has issues we need to fix.
    // Based on previous analysis, we know 'user.id' and stock update are likely issues.
    if (res.status !== 201) {
      console.log("Create Order Failed:", res.body);
    }

    expect(res.status).toBe(201);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.status).toBe("PENDING");
  });

  it("should return 400 if cart is empty", async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    axios.get.mockImplementation((url) => {
      if (url.includes("/cart/items")) {
        return Promise.resolve({
          data: { items: [] },
        });
      }
      return Promise.reject(new Error("Not Found"));
    });

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${token}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/empty/i);
  });

  it("should fail if inventory is insufficient", async () => {
    const userId = new mongoose.Types.ObjectId();
    const productId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    axios.get.mockImplementation((url) => {
      if (url.includes("/cart/items")) {
        return Promise.resolve({
          data: { items: [{ productId: productId, quantity: 20 }] },
        });
      }
      if (url.includes(`/products/${productId}`)) {
        return Promise.resolve({
          data: {
            product: {
              _id: productId,
              title: "Test Product",
              stock: 5, // Less than 20
              price: { amount: 100, currency: "INR" },
            },
          },
        });
      }
      return Promise.reject(new Error("Not Found"));
    });

    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", `token=${token}`)
      .send({
        shippingAddress: {
          street: "123 Main St",
          city: "Mumbai",
          state: "MH",
          pincode: "400001",
          country: "India",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/stock/i);
  });
});

// Get orders of logged in person api test cases started
describe("GET /api/orders/me", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 200 and a list of orders for the authenticated user", async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    const mockOrders = [
      { id: 1, item: "Product A" },
      { id: 2, item: "Product B" },
    ];

    jest.spyOn(Order, "find").mockImplementation(() => ({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue(mockOrders),
    }));

    jest.spyOn(Order, "countDocuments").mockResolvedValue(2);

    const response = await request(app)
      .get("/api/orders/me")
      .set("Cookie", `token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.orders).toEqual(mockOrders);
    expect(response.body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 10,
    });
  });

  it("should return 400 if pagination parameters are invalid", async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    const response = await request(app)
      .get("/api/orders/me?page=invalid&limit=10")
      .set("Cookie", `token=${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid pagination parameters");
  });

  it("should return 401 if the user is not authenticated", async () => {
    const response = await request(app).get("/api/orders/me");

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Unauthorized User");
  });

  it("should return 404 if no orders are found", async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    jest.spyOn(Order, "find").mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(Order, "countDocuments").mockResolvedValue(0);

    const response = await request(app)
      .get("/api/orders/me")
      .set("Cookie", `token=${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toBe("No Orders found");
  });

  it("should return 500 if there is a server error", async () => {
    const userId = new mongoose.Types.ObjectId();
    const token = generateToken(userId);

    jest.spyOn(Order, "find").mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockRejectedValue(new Error("Database error")),
    });

    const response = await request(app)
      .get("/api/orders/me")
      .set("Cookie", `token=${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Internal server error");
  });
});
