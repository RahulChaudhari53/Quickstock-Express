// userController.js
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /signup - Register a new user
const registerUser = async (req, res) => {
  const { firstName, lastName, email, phoneNumbers, password } = req.body;

  try {
    if (!firstName || !lastName || !email || !phoneNumbers || !password) {
      return errorResponse(res, "Please fill all fields.", 400);
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { phoneNumbers: { $in: [phoneNumbers] } }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return errorResponse(res, "Email is already registered", 409);
      }
      if (existingUser.phoneNumbers.includes(phoneNumbers)) {
        return errorResponse(res, "Phone number is already registered", 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      firstName,
      lastName,
      email,
      phoneNumbers,
      password: hashedPassword,
    });
    await newUser.save();

    const { password: pwd, ...userWithoutPassword } = newUser.toObject();
    return successResponse(
      res,
      "User saved successfully.",
      userWithoutPassword
    );
  } catch (err) {
    console.error("POST /users - Error:", err);
    return errorResponse(res, "Error creating new user.");
  }
};

// POST /users/login - Login and receive JWT
const loginUser = async (req, res) => {
  const { phoneNumber, password } = req.body;

  if (!phoneNumber || !password) {
    return errorResponse(
      res,
      "Please provide both phoneNumber and password.",
      400
    );
  }

  try {
    console.log("Request Body:", req.body);

    const user = await User.findOne({
      phoneNumbers: { $in: [phoneNumber] },
    });

    console.log("Found User:", user);

    if (!user) {
      return errorResponse(
        res,
        "User not found with the provided phone number.",
        404
      );
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match:", isMatch);

    if (!isMatch) {
      return errorResponse(res, "Invalid password.", 400);
    }

    const payload = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumbers: user.phoneNumbers,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...userWithoutPassword } = user.toObject();

    return successResponse(res, "User successfully logged in.", {
      user: userWithoutPassword,
      token,
    });
  } catch (err) {
    console.error("Error in loginUser:", err);
    return errorResponse(
      res,
      "Error while logging in. Please try again later."
    );
  }
};

// GET /:id/me - Get current user
const getCurrentUser = async (req, res) => {
  const _id = req.params.id;

  try {
    const user = await User.findById(_id).select("-password");

    if (!user) {
      console.log("User not found");
      return errorResponse(res, "User not found.", 404);
    }

    console.log("User found:", user);
    return successResponse(res, "User fetched.", user);
  } catch (err) {
    console.error("GET /users/:id - Error:", err);
    return errorResponse(res, "Error fetching user.");
  }
};

// PATCH /users/:id/updateUserInfo - Update user info
const updateUserInfo = async (req, res) => {
  const { firstName, lastName } = req.body;
  const userId = req.params.id;

  if (!firstName || !lastName) {
    return errorResponse(res, "Both firstName and lastName are required.", 400);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName },
      { new: true }
    ).select("-password");
    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "User info updated.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/info - Error:", err);
    return errorResponse(res, "Failed to update user info.");
  }
};

// PATCH /users/:id/updatePassword - Update password
const updatePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.params.id;

  if (!oldPassword || !newPassword) {
    return errorResponse(res, "Both old and new password are required.", 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found.", 404);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return errorResponse(res, "Incorrect old password.", 401);

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return successResponse(res, "Password updated successfully.");
  } catch (err) {
    console.error("PATCH /users/:id/password - Error:", err);
    return errorResponse(res, "Failed to update password.");
  }
};

// PATCH /users/:id/updateEmail - Update email
const updateEmail = async (req, res) => {
  const { email } = req.body;
  const userId = req.params.id;

  if (!email) {
    return errorResponse(res, "Email is required.", 400);
  }

  try {
    const existing = await User.findOne({ email });
    if (existing && existing.email == email) {
      return errorResponse(res, "Email already in use.", 409);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email },
      { new: true }
    ).select("-password");
    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "Email updated.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/email - Error:", err);
    return errorResponse(res, "Failed to update email.");
  }
};

// PATCH /users/:id/addPhoneNumber - Update phone numbers
const addPhoneNumber = async (req, res) => {
  try {
    const userId = req.params.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $addToSet: { phoneNumbers: phoneNumber } },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Phone number added",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /users/:id/removePhoneNumber - Remove phone numbers
const removePhoneNumber = async (req, res) => {
  try {
    const userId = req.params.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $pull: { phoneNumbers: phoneNumber } },
      { new: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "Phone number removed",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Need a api to update userProfile

// DELETE /users/:id/deleteUser
const deleteUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const deletedUser = await User.findByIdAndDelete(userId);

    if (!deletedUser) {
      return errorResponse(res, "User not found.", 404);
    }

    return successResponse(res, "User deleted successfully.");
  } catch (err) {
    console.error("DELETE /users/:id - Error:", err);
    return errorResponse(res, "Error deleting user.");
  }
};

// GET /users - Get all users
const getAllUsers = async (req, res) => {
  console.log("GET /users - Fetching all users...");

  try {
    const userList = await User.find().select("-password");
    console.log("Fetched users:", userList.length);
    return successResponse(res, "Users fetched successfully.", userList);
  } catch (err) {
    console.error("GET /users - Error:", err);
    return errorResponse(res, "Failed to fetch users.");
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  addPhoneNumber,
  removePhoneNumber,
  deleteUser,

  getAllUsers, // for now to see all the users later in admin
};
