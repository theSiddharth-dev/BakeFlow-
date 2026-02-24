process.env.NODE_ENV = "test"; // Set environment to test
process.env.JWT_SECRET = "testsecret"; // Set test JWT secret
process.env.REDIS_HOST = "localhost"; // Set Redis host for test
process.env.REDIS_PORT = 6379; // Set Redis port for test
process.env.REDIS_PASSWORD = ""; // Set Redis password for test (empty)

// Mock ioredis for tests
jest.mock("ioredis", () => ({
  // Mock the ioredis module
  Redis: jest.fn().mockImplementation(() => ({
    // Mock Redis constructor
    get: jest.fn().mockResolvedValue(null), // Mock get method to return null
    set: jest.fn().mockResolvedValue("OK"), // Mock set method to return "OK"
    on: jest.fn(), // Mock on method
  })),
}));

// Mock Broker for tests
jest.mock("../src/Broker/Broker", () => ({
  // Mock the Broker module
  Connect: jest.fn().mockResolvedValue(true), // Mock Connect function
  publishtoQueue: jest.fn().mockResolvedValue(true), // Mock publishtoQueue function
  subscribeToQueue: jest.fn(), // Mock subscribeToQueue function
}));
