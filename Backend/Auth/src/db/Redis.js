const { Redis } = require("ioredis"); // Import Redis class from ioredis library

let redis; // Declare redis variable

if (process.env.NODE_ENV !== "test") {
  // If not in test environment
  redis = new Redis({
    // Create Redis instance with config
    host: process.env.REDIS_HOST, // Redis host from environment
    port: process.env.REDIS_PORT, // Redis port from environment
    password: process.env.REDIS_PASSWORD, // Redis password from environment
  });

  redis.on("connect", () => {
    // Event listener for connection
    console.log("Connected to Redis"); // Log connection success
  });
} else {
  // If in test environment
  // Mock Redis for tests with in-memory storage
  const mockStore = new Map(); // Create a Map for mock storage
  redis = {
    // Mock redis object
    get: (key) => Promise.resolve(mockStore.get(key) || null), // Mock get method
    set: (key, value) => {
      // Mock set method
      mockStore.set(key, value); // Store in map
      return Promise.resolve("OK"); // Return promise
    },
    on: () => {}, // Mock on method
  };
}

module.exports = redis; // Export redis instance
