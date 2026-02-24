const jwt = require("jsonwebtoken");

const createAuthMiddleware = (roles = ["user"]) => {
  return function authMiddleware(req, res, next) {
    // Extract token from Authorization: Bearer <token> header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!roles.includes(decoded.role)) {
        return res.status(403).json({
          message: "Forbidden: Insufficient permissions.",
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        message: "Unauthorized: Invalid token",
      });
    }
  };
};

module.exports = createAuthMiddleware;