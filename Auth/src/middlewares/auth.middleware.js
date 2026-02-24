const jwt = require("jsonwebtoken");
const redis = require("../db/Redis");

const authMiddleware = async (req, res, next) => {
  
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  try {
    // Check if token is blacklisted in Redis
    const isBlacklisted = await redis.get(`blacklist_${token}`);
    if (isBlacklisted) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Token has been revoked" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

module.exports = { authMiddleware };
