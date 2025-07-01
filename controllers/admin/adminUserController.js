// controllers/admin/adminUserController.js
const User = require("../../models/User");
const mongoose = require("mongoose");
const {
  successResponse,
  errorResponse,
} = require("../../utils/responseHandler");

const getAllUsers = async (req, res, next) => {
  try {
    const {
      search = "",
      role,
      sort = "desc",
      page = 1,
      limit = 10,
    } = req.query;
    const searchRegex = new RegExp(search, "i");

    const query = {};
    if (search) {
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { primaryPhone: searchRegex },
        { secondaryPhone: searchRegex },
      ];
    }
    if (role) {
      query.role = role;
    }

    const sortOption = { createdAt: sort === "asc" ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    return successResponse(res, "Users fetched successfully.", {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      users,
    });
  } catch (err) {
    next(err);
  }
};

// GET/users/:id - Get user by id
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid user ID", 400);
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(res, "User fetched successfully", user);
  } catch (err) {
    console.error("getUserById error:", err);
    next(err);
  }
};

const makeAdmin = async (req, res, next) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return errorResponse(res, "Invalid user ID", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    if (user.role === "admin") {
      return errorResponse(res, "User is already an admin", 400);
    }

    user.role = "admin";
    await user.save();

    return successResponse(res, "User promoted to admin successfully", user);
  } catch (err) {
    console.error("makeAdmin error:", err);
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  makeAdmin,
};
