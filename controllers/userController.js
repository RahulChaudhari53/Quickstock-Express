const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const registerUser = async (req, res, next) => {
  const { firstName, lastName, email, primaryPhone, password } = req.body;

  if (!firstName || !lastName || !email || !primaryPhone || !password) {
    return errorResponse(res, "Please fill all required fields.", 400);
  }

  try {
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { primaryPhone: primaryPhone },
        { secondaryPhone: primaryPhone },
      ],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return errorResponse(
          res,
          "An account with this email already exists.",
          409
        );
      }
      if (
        existingUser.primaryPhone === primaryPhone ||
        existingUser.secondaryPhone === primaryPhone
      ) {
        return errorResponse(
          res,
          "An account with this phone number already exists.",
          409
        );
      }
    }

    const newUser = new User({
      firstName,
      lastName,
      email,
      primaryPhone,
      password,
    });
    await newUser.save();

    const { password: _, ...userWithoutPassword } = newUser.toObject();
    return successResponse(
      res,
      "User registered successfully.",
      userWithoutPassword,
      201
    );
  } catch (err) {
    next(err);
  }
};

// POST /login - Login and receive JWT
const loginUser = async (req, res, next) => {
  const { phoneNumber, password } = req.body;
  if (!phoneNumber || !password) {
    return errorResponse(
      res,
      "Please provide both phoneNumber and password.",
      400
    );
  }

  try {
    const user = await User.findOne({
      $or: [{ primaryPhone: phoneNumber }, { secondaryPhone: phoneNumber }],
      isActive: true,
    }).select("+password");

    if (!user) {
      return errorResponse(
        res,
        "Invalid credentials or user is inactive.",
        401
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return errorResponse(res, "Invalid credentials.", 401);
    }

    const payload = { _id: user._id, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const { password: _, ...userWithoutPassword } = user.toObject();
    return successResponse(res, "User successfully logged in.", {
      user: userWithoutPassword,
      token,
    });
  } catch (err) {
    next(err);
  }
};

// GET /me - Get current user profile
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return errorResponse(res, "User not found.", 404);
    }
    return successResponse(res, "User profile fetched successfully.", user);
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/updateUserInfo - Update user info
const updateUserInfo = async (req, res, next) => {
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) {
    return errorResponse(res, "Both firstName and lastName are required.", 400);
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);
    return successResponse(res, "User info updated successfully.", updatedUser);
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/updatePassword - Update password
const updatePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return errorResponse(res, "Both old and new password are required.", 400);
  }
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user) return errorResponse(res, "User not found.", 404);

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) return errorResponse(res, "Incorrect old password.", 401);

    user.password = newPassword;
    await user.save();
    return successResponse(res, "Password updated successfully.");
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/updateEmail - Update email
const updateEmail = async (req, res, next) => {
  const { email } = req.body;
  if (!email) return errorResponse(res, "Email is required.", 400);
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { email },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);
    return successResponse(res, "Email updated successfully.", updatedUser);
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/updateProfileImage - Update user profile image
const updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded.", 400);
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { profileImage: req.file.path },
      { new: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);
    return successResponse(
      res,
      "Profile image updated successfully.",
      updatedUser
    );
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/addPhoneNumber
const addPhoneNumber = async (req, res, next) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return errorResponse(res, "Phone number is required.", 400);
  }
  if (!/^\d{10}$/.test(phoneNumber)) {
    return errorResponse(res, "Phone number must be exactly 10 digits.", 400);
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, "User not found.", 404);

    if (
      user.primaryPhone === phoneNumber ||
      user.secondaryPhone === phoneNumber
    ) {
      return errorResponse(
        res,
        "This phone number is already associated with your account.",
        409
      );
    }

    if (user.secondaryPhone) {
      return errorResponse(res, "Cannot add more than two phone numbers.", 400);
    }

    const existingPhoneUser = await User.findOne({
      $or: [{ primaryPhone: phoneNumber }, { secondaryPhone: phoneNumber }],
    });
    if (existingPhoneUser) {
      return errorResponse(
        res,
        "This phone number is already registered with another account.",
        409
      );
    }

    user.secondaryPhone = phoneNumber;
    await user.save();

    return successResponse(
      res,
      "Secondary phone number added successfully.",
      user
    );
  } catch (err) {
    next(err);
  }
};

// PATCH /:id/deletePhoneNumber
const deletePhoneNumber = async (req, res, next) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return errorResponse(res, "Phone number to delete is required.", 400);
  }

  try {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, "User not found.", 404);

    if (
      user.primaryPhone !== phoneNumber &&
      user.secondaryPhone !== phoneNumber
    ) {
      return errorResponse(res, "Phone number not found for this user.", 404);
    }

    if (!user.secondaryPhone) {
      return errorResponse(
        res,
        "Cannot delete the only phone number for the account.",
        400
      );
    }

    let update;
    if (user.primaryPhone === phoneNumber) {
      update = {
        primaryPhone: user.secondaryPhone,
        $unset: { secondaryPhone: 1 },
      };
    } else {
      update = { $unset: { secondaryPhone: 1 } };
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    return successResponse(
      res,
      "Phone number removed successfully.",
      updatedUser
    );
  } catch (err) {
    next(err);
  }
};

// DELETE /:id/deactivateUser (Soft Delete)
const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!user) {
      return errorResponse(res, "User not found.", 404);
    }
    return successResponse(res, "User account deactivated successfully.");
  } catch (err) {
    next(err);
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
  deactivateUser,
};
