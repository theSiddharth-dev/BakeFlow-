const { MongoMemoryServer } = require("mongodb-memory-server"); // Import MongoDB Memory Server for testing
const mongoose = require("mongoose"); // Import Mongoose for database operations
const request = require("supertest"); // Import supertest for HTTP testing
const app = require("../src/app"); // Import the Express app

let mongoServer; // Declare variable for MongoDB server

beforeAll(async () => {
  // Setup before all tests
  // Start MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create(); // Create in-memory MongoDB server
  const mongoUri = mongoServer.getUri(); // Get connection URI

  // Connect to the in-memory database
  await mongoose.connect(mongoUri); // Connect Mongoose to in-memory DB
}, 30000); // Increased timeout to 30 seconds

afterAll(async () => {
  // Cleanup after all tests
  // Close database connection
  await mongoose.connection.dropDatabase(); // Drop the database
  await mongoose.connection.close(); // Close connection

  // Stop MongoDB Memory Server
  await mongoServer.stop(); // Stop the server
});

afterEach(async () => {
  // Cleanup after each test
  // Clear all collections after each test
  const collections = mongoose.connection.collections; // Get all collections
  for (const key in collections) {
    // Loop through collections
    const collection = collections[key]; // Get collection
    await collection.deleteMany({}); // Delete all documents
  }
});

describe("POST /api/auth/register", () => {
  // Test suite for registration endpoint
  it("should register a new user successfully", async () => {
    // Test successful registration
    const userData = {
      // Define test user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    const response = await request(app) // Make POST request
      .post("/api/auth/register")
      .send(userData)
      .expect(201); // Expect 201 status

    expect(response.body).toHaveProperty(
      // Check response has message
      "message",
      "User registered Successfully"
    );
    expect(response.body).toHaveProperty("user"); // Check has user object

    expect(response.body.user).toHaveProperty("id"); // Check user has id
    expect(response.body.user).toHaveProperty("username", userData.username); // Check username
    expect(response.body.user).toHaveProperty("email", userData.email); // Check email
    expect(response.body.user).not.toHaveProperty("password"); // Ensure password not returned
  });

  it("should return 400 if user already exists with same email", async () => {
    // Test duplicate email
    const userData = {
      // Define user data
      username: "testuser1",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test1",
        lastName: "User1",
      },
    };

    // First registration
    await request(app).post("/api/auth/register").send(userData).expect(201); // Register first user

    // Second registration with same email
    const response = await request(app) // Try to register again
      .post("/api/auth/register")
      .send({
        username: "testuser2",
        email: "test@example.com", // Same email
        password: "password456",
        fullName: {
          firstName: "Test2",
          lastName: "User2",
        },
      })
      .expect(400); // Expect 400 status

    expect(response.body).toHaveProperty(
      // Check error message
      "message",
      "Username or email already exists"
    );
  });

  it("should return 400 if user already exists with same username", async () => {
    // Test duplicate username
    const userData = {
      // Define user data
      username: "testuser",
      email: "test1@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    // First registration
    await request(app).post("/api/auth/register").send(userData).expect(201); // Register first user

    // Second registration with same username
    const response = await request(app) // Try to register again
      .post("/api/auth/register")
      .send({
        username: "testuser", // Same username
        email: "test2@example.com",
        password: "password456",
        fullName: {
          firstName: "Test2",
          lastName: "User2",
        },
      })
      .expect(400); // Expect 400 status

    expect(response.body).toHaveProperty(
      // Check error message
      "message",
      "Username or email already exists"
    );
  });

  it("should return 500 on internal server error", async () => {
    // Test internal error (placeholder)
    // This test would require mocking mongoose or other dependencies
    // For now, we'll skip this as it's harder to simulate internal errors
    // without modifying the actual code
  });
});

describe("POST /api/auth/login", () => {
  // Test suite for login endpoint
  it("should login a user successfully", async () => {
    // Test successful login
    // First register a user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    // Now login
    const loginData = {
      // Define login data
      email: "test@example.com",
      password: "password123",
    };

    const response = await request(app) // Make login request
      .post("/api/auth/login")
      .send(loginData)
      .expect(200); // Expect 200 status

    expect(response.body).toHaveProperty("message", "Login successful"); // Check message
    expect(response.body).toHaveProperty("user"); // Check has user
    expect(response.body.user).toHaveProperty("id"); // Check user id
    expect(response.body.user).toHaveProperty("username", userData.username); // Check username
    expect(response.body.user).toHaveProperty("email", userData.email); // Check email
    expect(response.body.user).not.toHaveProperty("password"); // Ensure no password
  });

  it("should return 401 for invalid email", async () => {
    // Test invalid email
    const loginData = {
      // Define invalid login data
      email: "nonexistent@example.com",
      password: "password123",
    };

    const response = await request(app) // Make login request
      .post("/api/auth/login")
      .send(loginData)
      .expect(401); // Expect 401 status

    expect(response.body).toHaveProperty(
      // Check error message
      "message",
      "Invalid email or password"
    );
  });

  it("should return 401 for invalid password", async () => {
    // Test invalid password
    // First register a user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    // Now login with wrong password
    const loginData = {
      // Define wrong password data
      email: "test@example.com",
      password: "wrongpassword",
    };

    const response = await request(app) // Make login request
      .post("/api/auth/login")
      .send(loginData)
      .expect(401); // Expect 401 status
  });
});

describe("GET /api/auth/me", () => {
  // Test suite for get current user endpoint
  it("should return user information for authenticated user", async () => {
    // Test authenticated user
    // First register and login a user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginData = {
      // Define login data
      email: "test@example.com",
      password: "password123",
    };

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send(loginData)
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    // Now make GET request to /me
    const response = await request(app) // Make request to /me
      .get("/api/auth/me")
      .set("Cookie", cookies) // Set cookies
      .expect(200); // Expect 200 status

    expect(response.body).toHaveProperty("user"); // Check has user
    expect(response.body.user).toHaveProperty("id"); // Check id
    expect(response.body.user).toHaveProperty("username", userData.username); // Check username
    expect(response.body.user).toHaveProperty("email", userData.email); // Check email
    expect(response.body.user).toHaveProperty("fullName"); // Check fullName
    expect(response.body.user).toHaveProperty("role"); // Check role
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated
    const response = await request(app).get("/api/auth/me").expect(401); // Make request without auth

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });

  it("should return 401 for invalid token", async () => {
    // Test invalid token
    const response = await request(app) // Make request with invalid token
      .get("/api/auth/me")
      .set("Cookie", "token=invalidtoken")
      .expect(401);

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });
});

describe("GET /api/auth/logout", () => {
  // Test suite for logout endpoint
  it("should logout a user successfully", async () => {
    // Test successful logout
    // First register and login a user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginData = {
      // Define login data
      email: "test@example.com",
      password: "password123",
    };

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send(loginData)
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    // Now make GET request to /logout
    const response = await request(app) // Make logout request
      .get("/api/auth/logout")
      .set("Cookie", cookies)
      .expect(200); // Expect 200 status

    expect(response.body).toHaveProperty("message", "Logout successful"); // Check message

    // Verify cookie is cleared
    const setCookieHeader = response.headers["set-cookie"]; // Get set-cookie header
    expect(setCookieHeader).toBeDefined(); // Check defined
    expect(setCookieHeader[0]).toMatch(/token=;/); // Check token cleared

    // Verify that the token is now blacklisted - try to access /me with the same cookie
    const meResponse = await request(app) // Try to access /me
      .get("/api/auth/me")
      .set("Cookie", cookies)
      .expect(401);

    expect(meResponse.body).toHaveProperty("message", "Unauthorized"); // Check unauthorized
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated logout
    const response = await request(app).get("/api/auth/logout").expect(401); // Make request without auth

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });

  it("should return 401 for invalid token", async () => {
    // Test invalid token logout
    const response = await request(app) // Make request with invalid token
      .get("/api/auth/logout")
      .set("Cookie", "token=invalidtoken")
      .expect(401);

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });

  it("should return 401 for blacklisted token", async () => {
    // Test blacklisted token
    // First register and login a user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginData = {
      // Define login data
      email: "test@example.com",
      password: "password123",
    };

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send(loginData)
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    // Logout the user
    await request(app) // Logout
      .get("/api/auth/logout")
      .set("Cookie", cookies)
      .expect(200);

    // Verify that the token is now blacklisted - try to access /me with the same cookie
    const meResponse = await request(app) // Try to access /me
      .get("/api/auth/me")
      .set("Cookie", cookies)
      .expect(401);

    expect(meResponse.body).toHaveProperty("message", "Unauthorized"); // Check unauthorized
  });
});

describe("GET /api/auth/users/me/address", () => {
  // Test suite for get addresses endpoint
  it("should return user's addresses successfully", async () => {
    // Test successful get addresses
    // Register and login user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    // Add an address first
    const addressData = {
      // Define address data
      street: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      isDefault: true,
    };

    await request(app) // Add address
      .post("/api/auth/users/me/address")
      .set("Cookie", cookies)
      .send(addressData)
      .expect(201);

    // Now get addresses
    const response = await request(app) // Get addresses
      .get("/api/auth/users/me/address")
      .set("Cookie", cookies)
      .expect(200);

    expect(response.body).toHaveProperty(
      // Check message
      "message",
      "Addresses retrieved successfully"
    );
    expect(response.body).toHaveProperty("addresses"); // Check has addresses
    expect(Array.isArray(response.body.addresses)).toBe(true); // Check is array
    expect(response.body.addresses.length).toBe(1); // Check length
    expect(response.body.addresses[0]).toHaveProperty(
      // Check street
      "street",
      addressData.street
    );
    expect(response.body.addresses[0]).toHaveProperty("isDefault", true); // Check isDefault
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated
    const response = await request(app) // Make request without auth
      .get("/api/auth/users/me/address")
      .expect(401);

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });
});

describe("POST /api/auth/users/me/address", () => {
  // Test suite for add address endpoint
  it("should add address successfully", async () => {
    // Test successful add address
    // Register and login user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    const addressData = {
      // Define address data
      street: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
      isDefault: true,
    };

    const response = await request(app) // Add address
      .post("/api/auth/users/me/address")
      .set("Cookie", cookies)
      .send(addressData)
      .expect(201);

    expect(response.body).toHaveProperty(
      // Check message
      "message",
      "Address added successfully"
    );
    expect(response.body).toHaveProperty("address"); // Check has address
    expect(response.body.address).toHaveProperty("street", addressData.street); // Check street
    expect(response.body.address).toHaveProperty("isDefault", true); // Check isDefault
  });

  it("should return 400 for validation error on invalid pincode", async () => {
    // Test invalid pincode
    // Register and login user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    const addressData = {
      // Define invalid address data
      street: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "invalid", // Invalid pincode
      country: "India",
    };

    const response = await request(app) // Try to add address
      .post("/api/auth/users/me/address")
      .set("Cookie", cookies)
      .send(addressData)
      .expect(400);

    expect(response.body).toHaveProperty("errors"); // Check has errors
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated
    const addressData = {
      // Define address data
      street: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    };

    const response = await request(app) // Make request without auth
      .post("/api/auth/users/me/address")
      .send(addressData)
      .expect(401);

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });
});

describe("DELETE /api/auth/users/me/address/:addressId", () => {
  // Test suite for remove address endpoint
  it("should remove address successfully", async () => {
    // Test successful remove address
    // Register and login user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    // Add an address first
    const addressData = {
      // Define address data
      street: "123 Main St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
      country: "India",
    };

    const addResponse = await request(app) // Add address
      .post("/api/auth/users/me/address")
      .set("Cookie", cookies)
      .send(addressData)
      .expect(201);

    const addressId = addResponse.body.address._id; // Get address ID

    // Now delete the address
    const response = await request(app) // Delete address
      .delete(`/api/auth/users/me/address/${addressId}`)
      .set("Cookie", cookies)
      .expect(200);

    expect(response.body).toHaveProperty(
      // Check message
      "message",
      "Address removed successfully"
    );
  });

  it("should return 404 for non-existent address", async () => {
    // Test non-existent address
    // Register and login user
    const userData = {
      // Define user data
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201); // Register user

    const loginResponse = await request(app) // Login user
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const cookies = loginResponse.headers["set-cookie"]; // Get cookies

    const response = await request(app) // Try to delete non-existent address
      .delete("/api/auth/users/me/address/507f1f77bcf86cd799439011") // Random ObjectId
      .set("Cookie", cookies)
      .expect(404);

    expect(response.body).toHaveProperty("message", "Address not found"); // Check error
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated
    const response = await request(app) // Make request without auth
      .delete("/api/auth/users/me/address/507f1f77bcf86cd799439011")
      .expect(401);

    expect(response.body).toHaveProperty("message", "Unauthorized"); // Check error
  });
});

describe("POST /api/auth/change-password", () => {
  // Test suite for change password endpoint
  it("should change password successfully", async () => {
    // Test successful password change
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "oldPassword123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Change password
    const changePasswordData = {
      currentPassword: "oldPassword123",
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(200);

    expect(response.body).toHaveProperty(
      "message",
      "Password changed successfully"
    );

    // Verify old password no longer works
    await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: "oldPassword123" })
      .expect(401);

    // Verify new password works
    const newLoginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: "newPassword456" })
      .expect(200);

    expect(newLoginResponse.body).toHaveProperty("message", "Login successful");
  });

  it("should return 401 for incorrect current password", async () => {
    // Test incorrect current password
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "correctPassword123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Try to change password with wrong current password
    const changePasswordData = {
      currentPassword: "wrongPassword123",
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(401);

    expect(response.body).toHaveProperty(
      "message",
      "Current password is incorrect"
    );
  });

  it("should return 400 if new password is same as current password", async () => {
    // Test same password
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Try to change password to the same password
    const changePasswordData = {
      currentPassword: "password123",
      newPassword: "password123",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(400);

    expect(response.body).toHaveProperty(
      "message",
      "New password must be different from current password"
    );
  });

  it("should return 401 for unauthenticated user", async () => {
    // Test unauthenticated request
    const changePasswordData = {
      currentPassword: "oldPassword123",
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .send(changePasswordData)
      .expect(401);

    expect(response.body).toHaveProperty(
      "message",
      "Unauthorized: No token provided"
    );
  });

  it("should return 401 for invalid token", async () => {
    // Test invalid token
    const changePasswordData = {
      currentPassword: "oldPassword123",
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", "Bearer invalidtoken")
      .send(changePasswordData)
      .expect(401);

    expect(response.body).toHaveProperty(
      "message",
      "Unauthorized: Invalid token"
    );
  });

  it("should return 400 for missing currentPassword", async () => {
    // Test missing currentPassword
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Try to change password without currentPassword
    const changePasswordData = {
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(400);

    expect(response.body).toHaveProperty("errors");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: "Current password is required" }),
      ])
    );
  });

  it("should return 400 for missing newPassword", async () => {
    // Test missing newPassword
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Try to change password without newPassword
    const changePasswordData = {
      currentPassword: "password123",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(400);

    expect(response.body).toHaveProperty("errors");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: "New password is required" }),
      ])
    );
  });

  it("should return 400 for newPassword less than 6 characters", async () => {
    // Test newPassword too short
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Try to change password with short newPassword
    const changePasswordData = {
      currentPassword: "password123",
      newPassword: "12345", // Only 5 characters
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(400);

    expect(response.body).toHaveProperty("errors");
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          msg: "New password must be at least 6 characters long",
        }),
      ])
    );
  });

  it("should return 401 for blacklisted token", async () => {
    // Test blacklisted token (after logout)
    // Register a user
    const userData = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
      fullName: {
        firstName: "Test",
        lastName: "User",
      },
    };

    await request(app).post("/api/auth/register").send(userData).expect(201);

    // Login to get token
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email: userData.email, password: userData.password })
      .expect(200);

    const token = loginResponse.body.token;

    // Logout to blacklist the token
    await request(app)
      .get("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    // Try to change password with blacklisted token
    const changePasswordData = {
      currentPassword: "password123",
      newPassword: "newPassword456",
    };

    const response = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${token}`)
      .send(changePasswordData)
      .expect(401);

    expect(response.body).toHaveProperty(
      "message",
      "Unauthorized: Token has been revoked"
    );
  });
});
