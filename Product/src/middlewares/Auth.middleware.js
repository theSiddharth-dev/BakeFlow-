const jwt = require("jsonwebtoken");

const createAuthMiddleware = (roles = ["user"]) => {
  return function authMiddleware(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!roles.includes(decoded.role)) {
        return res.status(401).json({
          message: "Forbidden : Insufficient permissions.",
        });
      }

      req.user = decoded;
      next();

    } catch (error) {
      return res.status(401).json({
        message: "Unauthorised Invalid token",
      });
    }
  };
};


module.exports = createAuthMiddleware;