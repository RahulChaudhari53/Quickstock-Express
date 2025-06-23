// controllers/admin/adminUserController.js
const User = require("../../models/User");
const mongoose = require("mongoose");
const {
  successResponse,
  errorResponse,
} = require("../../utils/responseHandler");

// GET /users - Get all users with search, sort, and pagination
const getAllUsers = async (req, res) => {
  console.log("GET /users - Fetching users with filters...");

  try {
    const {
      search = "",
      role,
      sort = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const searchRegex = new RegExp(search, "i");

    const query = {
      $or: [
        { firstName: { $regex: searchRegex } },
        { lastName: { $regex: searchRegex } },
        { $or: [{ primaryPhone: search }, { secondaryPhone: search }] },
      ],
    };

    if (role) {
      query.role = role;
    }

    const sortOption = sort === "asc" ? 1 : -1;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: sortOption })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    console.log(`Fetched ${users.length} users out of ${total} total.`);

    return successResponse(res, "Users fetched successfully.", {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      users,
    });
  } catch (err) {
    console.error("GET /users - Error:", err);
    return errorResponse(res, "Failed to fetch users.");
  }
};

// GET/users/:id - Get user by id
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return errorResponse(res, "Invalid user ID", 400);
    }

    const user = await User.findById(id).select("-password");
    // console.log("User found:", user);

    if (!user) {
      return errorResponse(res, "User not found", 404);
    }

    return successResponse(res, "User fetched successfully", user);
  } catch (err) {
    console.error("getUserById error:", err);
    return errorResponse(res, "Failed to fetch user", 500);
  }
};

// PATCH/users/:id/make-admin
const makeAdmin = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found", 404);

    if (user.role === "admin") {
      return errorResponse(res, "User is already an admin");
    }

    user.role = "admin";
    await user.save();

    return successResponse(res, "User promoted to admin successfully", user);
  } catch (err) {
    console.error("makeAdmin error:", err);
    return errorResponse(res, "Failed to promote user", 500);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  makeAdmin,
};
