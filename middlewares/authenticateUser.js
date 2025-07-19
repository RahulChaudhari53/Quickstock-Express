const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { errorResponse } = require("../utils/responseHandler");

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(res, "Authentication required.", 401);
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({ _id: decoded._id, isActive: true });

    if (!user) {
      return errorResponse(
        res,
        "Authentication failed. User not found or inactive.",
        401
      );
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return errorResponse(res, "Authentication failed: Token expired.", 401);
    }
    return errorResponse(res, "Authentication failed: Invalid token.", 401);
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  } else {
    return errorResponse(res, "Admin privilege required.", 403);
  }
};

const isOwner = (req, res, next) => {
  console.log(req.user);
  if (req.user.role !== "shop_owner") {
    return errorResponse(
      res,
      "You are not authorized to perform this action.",
      403
    );
  }
  next();
};

const isSelf = (req, res, next) => {
  console.log("Checking if user is self:", req.user, req.params.userId);
  console.log("req.params", req.params);
  if (
    req.user &&
    req.params.userId &&
    req.user._id.toString() === req.params.userId
  ) {
    return next();
  }
  return errorResponse(
    res,
    "You are not authorized to perform this action.",
    403
  );
};

module.exports = {
  authenticateUser,
  isSelf,
  isAdmin,
  isOwner,
};
