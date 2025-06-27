// /middlewares/authenticateUser.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/responseHandler");

const authenticateUser = async (req, res, next) => {
  try {
    console.log("Authenticating user...");

    const authHeader = req.headers.authorization;
    console.log("Authorization Header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("Missing or malformed token");
      return errorResponse(res, "Authentication required.", 401);
    }

    const token = authHeader.split(" ")[1];
    console.log("Extracted Token:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded JWT Payload:", decoded);

    const user = await User.findOne({ _id: decoded._id });
    console.log("Fetched User from DB:", user);

    if (!user) {
      console.warn("User not found or token mismatch.");
      return errorResponse(res, "Token mismatch.", 401);
    }

    req.user = user;
    console.log("Authentication successful, proceeding to next middleware.");
    next();
  } catch (err) {
    console.error("Authorization failed:", err.message);
    if (err.name === "TokenExpiredError") {
      return errorResponse(res, "Authentication failed: Token expired.", 401);
    } else if (err.name === "JsonWebTokenError") {
      return errorResponse(res, "Authentication failed: Invalid token.", 401);
    }
    return errorResponse(res, "Authorization failed.", 500, err.message);
  }
};

const isAdmin = (req, res, next) => {
  console.log("Checking if user is admin...");

  if (req.user && req.user.role === "admin") {
    console.log("Admin verified.");
    return next();
  } else {
    console.warn("Admin privilege required but user is:", req.user?.role);
    return errorResponse(res, "Admin privilege required.", 403);
  }
};

module.exports = {
  authenticateUser,
  isAdmin,
};
