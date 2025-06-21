// userController.js
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /signup - Register a new user
const registerUser = async (req, res) => {
  const { firstName, lastName, email, phoneNumbers, password } = req.body;

  if (!firstName || !lastName || !email || !phoneNumbers || !password) {
    return errorResponse(res, "Please fill all fields.", 400);
  }

  try {
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

    let profileUrl = "";
    if (req.file) {
      profileUrl = req.file.path;
    }

    const newUser = new User({
      firstName,
      lastName,
      email,
      phoneNumbers: [phoneNumbers],
      password: hashedPassword,
      profileUrl,
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
      return errorResponse(res, "Invalid credentials.", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("Password Match:", isMatch);

    if (!isMatch) {
      return errorResponse(res, "Invalid credentials.", 401);
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
  const userIdFromParam = req.user.id;

  const authenticatedUserId = req.user._id.toString(); // The ID from the JWT token

  // CRITICAL SECURITY CHECK
  if (userIdFromParam !== authenticatedUserId) {
    return errorResponse(
      res,
      "You are not authorized to modify this user's information.",
      403
    );
  }

  try {
    const user = await User.findById(userIdFromParam).select("-password");

    if (!user) {
      console.log(
        "User not found via token ID. This should ideally not happen if token is valid."
      );
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
  const userIdFromParam = req.params.id;

  if (!firstName || !lastName) {
    return errorResponse(res, "Both firstName and lastName are required.", 400);
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      userIdFromParam,
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
  const userIdFromParam = req.params.id;

  if (!oldPassword || !newPassword) {
    return errorResponse(res, "Both old and new password are required.", 400);
  }

  try {
    const user = await User.findById(userIdFromParam);
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
  const userIdFromParam = req.params.id;

  if (!email) {
    return errorResponse(res, "Email is required.", 400);
  }

  try {
    const existing = await User.findOne({ email });
    if (existing && existing._id.toString() !== userIdFromParam) {
      return errorResponse(
        res,
        "Email already in use by another account.",
        409
      );
    }

    const updatedUser = await User.findByIdAndUpdate(
      userIdFromParam,
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

// Patch /users/:id/updateProfileImage - Update user profile image
const updateProfileImage = async (req, res) => {
  const userIdFromParam = req.params.id;

  try {
    if (!req.file) {
      return errorResponse(res, "No fil uploaded.", 400);
    }

    const updatedUser = await User.findByIdAndUpdate(
      userIdFromParam,
      { profileUrl: req.file.path },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return errorResponse(res, "User not found.", 404);
    }
    return successResponse(
      res,
      "Profile image updated successfully.",
      updatedUser
    );
  } catch (err) {
    console.error("PATCH /users/:id/updateProfileImage - Error:", err);
    return errorResponse(res, "Failed to update profile image.");
  }
};

// PATCH /users/:id/addPhoneNumber - Update phone numbers
const addPhoneNumber = async (req, res) => {
  console.log("Adding phone number....");
  try {
    const userIdFromParam = req.params.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return errorResponse(res, "Phone number is required.", 400);
    }

    // Find the user first to check current phone number count before updating
    const user = await User.findById(userIdFromParam);
    if (!user) {
      return errorResponse(res, "User not found.", 404);
    }

    // Check if the phone number already exists
    if (user.phoneNumbers.includes(phoneNumber)) {
      return errorResponse(
        res,
        "Phone number already exists for this user.",
        409
      ); // 409 Conflict
    }

    // Before pushing, check if adding would exceed the limit
    if (user.phoneNumbers.length >= 2) {
      return errorResponse(res, "Cannot add more than 2 phone numbers.", 400); // 400 Bad Request
    }

    // If all checks pass, add the new phone number
    user.phoneNumbers.push(phoneNumber); // Add to the array in memory

    const updatedUser = await user.save();

    return successResponse(res, "Phone number added.", updatedUser);
  } catch (error) {
    console.error("Error adding phone number:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(res, messages.join(", "), 400); // Send specific validation messages
    }

    return errorResponse(res, "Failed to add phone number.");
  }
};

// PATCH /users/:id/removePhoneNumber - Remove phone numbers
const removePhoneNumber = async (req, res) => {
  console.log("Attempting to remove phone number....");
  try {
    const userIdFromParam = req.params.id;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      console.log("Validation Error: Phone number is required for removal.");
      return errorResponse(res, "Phone number is required.", 400);
    }

    const user = await User.findById(userIdFromParam);

    if (!user) {
      console.log(`User not found for ID: ${userIdFromParam}`);
      return errorResponse(res, "User not found.", 404);
    }

    if (!user.phoneNumbers.includes(phoneNumber)) {
      console.log(
        `Phone number '${phoneNumber}' not found for user ${userIdFromParam}.`
      );
      return errorResponse(
        res,
        "Phone number not found in user's record.",
        404
      );
    }

    if (user.phoneNumbers.length <= 1) {
      console.log(
        `Constraint Violation: Cannot remove the last phone number for user ${userIdFromParam}.`
      );
      return errorResponse(
        res,
        "User must have at least one phone number.",
        400
      ); // 400 Bad Request
    }

    const updatedUser = await User.findByIdAndUpdate(
      userIdFromParam,
      { $pull: { phoneNumbers: phoneNumber } },
      { new: true, runValidators: true } // runValidators: true for schema-level validations if any apply
    );

    if (!updatedUser) {
      console.error(
        `Unexpected: User ${userIdFromParam} disappeared after findById but before update.`
      );
      return errorResponse(
        res,
        "User not found or an unexpected error occurred during update.",
        404
      );
    }
    console.log(
      `Phone number '${phoneNumber}' successfully removed for user ${userIdFromParam}.`
    );
    return successResponse(
      res,
      "Phone number removed successfully.",
      updatedUser
    );
  } catch (error) {
    console.error("Error removing phone number:", error);

    // Mongoose validation errors (though less likely for $pull without custom schema validation on pull)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return errorResponse(
        res,
        `Validation error: ${messages.join(", ")}`,
        400
      );
    }

    return errorResponse(
      res,
      "Failed to remove phone number due to an internal error.",
      500
    );
  }
};

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

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  updateProfileImage,
  addPhoneNumber,
  removePhoneNumber,
  deleteUser,

};
