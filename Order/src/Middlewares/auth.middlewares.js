const jwt = require("jsonwebtoken");

const createAuthMiddleware = (roles = ["user"]) => {
  return function authMiddleware(req, res, next) {
    // Safely read token from cookies or Authorization header
    const token =
      (req.cookies && req.cookies.token) ||
      req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Unauthorized User" });
    }
    try {
      // Use same default secret as tests if JWT_SECRET is not provided
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "test-secret-key",
      );

      if (!roles.includes(decoded.role)) {
        return res.status(401).json({
          message: "Forbidden : Insufficient permissions.",
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        message: "Unauthorized User",
      });
    }
  };
};

module.exports = createAuthMiddleware;
