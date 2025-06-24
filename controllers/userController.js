// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /signup - Register a new user
const registerUser = async (req, res) => {
  const { firstName, lastName, email, primaryPhone, secondaryPhone, password } =
    req.body;

  
    if (!firstName || !lastName || !email || !primaryPhone || !password) {
    return errorResponse(res, "Please fill all fields.", 400);
  }

  try {
    const phoneConditions = [{ primaryPhone }];
    if (secondaryPhone) phoneConditions.push({ secondaryPhone });

    const existingUser = await User.findOne({
      $or: [{ email }, ...phoneConditions],
    });

    if (existingUser) {
      if (existingUser.email == email) {
        return errorResponse(res, "Email is already registered", 409);
      }
      if (
        existingUser.primaryPhone == primaryPhone ||
        existingUser.primaryPhone == secondaryPhone
      ) {
        return errorResponse(res, "Phone number is already registered", 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let profileImage = "";
    if (req.file) {
      profileImage = req.file.path;
    }

    const newUser = new User({
      firstName,
      lastName,
      email,
      primaryPhone,
      secondaryPhone: undefined,
      password: hashedPassword,
      profileImage,
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
      $or: [{ primaryPhone: phoneNumber }, { secondaryPhone: phoneNumber }],
    }).select("+password");

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
      primaryPhone: user.primaryPhone,
      secondaryPhone: user.secondaryPhone,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...userWithoutPassword } = user.toObject();

    console.log("Found User:", userWithoutPassword);

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

  const authenticatedUserId = req.user._id.toString();

  if (userIdFromParam !== authenticatedUserId) {
    return errorResponse(
      res,
      "You are not authorized to modify this user's information.",
      403
    );
  }

  try {
    const user = await User.findById(userIdFromParam);

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
    );
    console.log("User : ", updatedUser);
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
    const user = await User.findById(userIdFromParam).select("+password");
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
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);

    console.log("Email Updated.");
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
      { profileImage: req.file.path },
      { new: true }
    );

    if (!updatedUser) {
      return errorResponse(res, "User not found.", 404);
    }
    console.log("ProfileImage Updated.");
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

// PATCH /users/:id/addPhoneNumber
const addPhoneNumber = async (req, res) => {
  const userId = req.params.id;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return errorResponse(res, "Phone number is required.", 400);
  }

  if (!/^\d{10}$/.test(phoneNumber)) {
    return errorResponse(res, "Phone number must be exactly 10 digits.", 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found.", 404);

    const phones = [user.primaryPhone, user.secondaryPhone].filter(Boolean);

    if (phones.length >= 2) {
      console.log("Cannot add more than 2 phone numbers.");
      return errorResponse(res, "Cannot add more than 2 phone numbers.", 400);
    }

    if (phones.includes(phoneNumber)) {
      console.log("Phone number already exists for this user.");
      return errorResponse(
        res,
        "Phone number already exists for this user.",
        409
      );
    }

    const fieldToUpdate = !user.primaryPhone
      ? { primaryPhone: phoneNumber }
      : { secondaryPhone: phoneNumber };

    const updatedUser = await User.findByIdAndUpdate(userId, fieldToUpdate, {
      new: true,
      runValidators: true,
    });

    console.log("PhoneNumber Added.");
    return successResponse(
      res,
      "Phone number added successfully.",
      updatedUser
    );
  } catch (err) {
    console.error("Error adding phone number:", err);
    return errorResponse(res, "Failed to add phone number.", 500);
  }
};

// PATCH /users/:id/deletePhoneNumber
const deletePhoneNumber = async (req, res) => {
  const userId = req.params.id;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    console.log("Phone number is required.");
    return errorResponse(res, "Phone number is required.", 400);
  }

  try {
    const user = await User.findById(userId);
    if (!user) return errorResponse(res, "User not found.", 404);

    const phones = [user.primaryPhone, user.secondaryPhone].filter(Boolean);

    if (!phones.includes(phoneNumber)) {
      console.log("Phone number not found.");
      return errorResponse(res, "Phone number not found.", 404);
    }

    if (phones.length <= 1) {
      return errorResponse(
        res,
        "User must have at least one phone number.",
        400
      );
    }

    let update = {};
    if (user.primaryPhone === phoneNumber) {
      update = {
        primaryPhone: user.secondaryPhone,
        $unset: { secondaryPhone: 1 },
      };
    } else if (user.secondaryPhone === phoneNumber) {
      update = { $unset: { secondaryPhone: 1 } };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, {
      new: true,
      runValidators: true,
    });

    console.log("PhoneNumber Deleted.");
    return successResponse(
      res,
      "Phone number removed successfully.",
      updatedUser
    );
  } catch (err) {
    console.error("Error deleting phone number:", err);
    return errorResponse(res, "Failed to delete phone number.", 500);
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
  deletePhoneNumber,
  deleteUser,
};
