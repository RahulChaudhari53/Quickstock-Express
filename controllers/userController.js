const User = require("../models/User");
const bcrypt = require("bcrypt");
const { successResponse, errorResponse } = require("../utils/responseHandler");

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

// GET /users/:id - Get current user
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

// POST /users - Create new user
const createUser = async (req, res) => {
  const { firstname, lastname, email, phoneNumbers, password } = req.body;

  try {
    if (!firstname || !lastname || !email || !phoneNumbers || !password) {
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
      firstname,
      lastname,
      email,
      phoneNumbers,
      password: hashedPassword,
    });
    await newUser.save();

    return successResponse(res, "User saved successfully.", newUser);
  } catch (err) {
    console.error("POST /users - Error:", err);
    return errorResponse(res, "Error creating new user.");
  }
};

// PATCH /users/:id/info - Update user info
const updateUserInfo = async (req, res) => {
  const { firstname, lastname } = req.body;
  const userId = req.params.id;

  if (!firstname || !lastname) {
    return errorResponse(res, "Both firstname and lastname are required.", 400);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { firstname, lastname },
      { new: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "User info updated.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/info - Error:", err);
    return errorResponse(res, "Failed to update user info.");
  }
};

// PATCH /users/:id/password - Update password
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

// PATCH /users/:id/email - Update email
const updateEmail = async (req, res) => {
  const { email } = req.body;
  const userId = req.params.id;

  if (!email) {
    return errorResponse(res, "Email is required.", 400);
  }

  try {
    const existing = await User.findOne({ email });
    if (existing && existing._id.toString() !== userId) {
      return errorResponse(res, "Email already in use.", 409);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email },
      { new: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "Email updated.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/email - Error:", err);
    return errorResponse(res, "Failed to update email.");
  }
};

// PATCH /users/:id/addPhoneNumber - Update phone numbers
const addPhoneNumber = async (req, res) => {
  const { phoneNumbers } = req.body;
  const _id = req.params.id;

  if (!Array.isArray(phoneNumbers)) {
    return errorResponse(res, "Phone numbers must be an array.", 400);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        $addToSet: { phoneNumbers: { $each: phoneNumbers } },
      },
      { new: true }
    );

    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "Phone number added.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/phoneNumbers - Error:", err);
    return errorResponse(res, "Failed to add phone number.");
  }
};

// PATCH /users/:id/removePhoneNumber - Update phone numbers
const removePhoneNumber = async (req, res) => {
  const { phoneNumbers } = req.body;
  const _id = req.params.id;

  if (!Array.isArray(phoneNumbers)) {
    return errorResponse(res, "Phone numbers must be an array.", 400);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      _id,
      {
        $pull: { phoneNumbers: {$in : phoneNumbers} },
      },
      { new: true }
    );

    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    return successResponse(res, "Phone number removed.", updatedUser);
  } catch (err) {
    console.error("PATCH /users/:id/phoneNumbers - Error:", err);
    return errorResponse(res, "Failed to remove phone number.");
  }
};

// DELETE /users/:id
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

// Export all functions
module.exports = {
  getAllUsers,
  getCurrentUser,
  createUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  addPhoneNumber,
  removePhoneNumber,
  deleteUser,
};
