// controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { generateOTP } = require("../utils/optUtils");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// function for gmail smtp
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/users/signup
const registerUser = async (req, res, next) => {
  const { firstName, lastName, email, primaryPhone, password } = req.body;

  if (!firstName || !lastName || !email || !primaryPhone || !password) {
    console.log("Please fill all required fields.", req.body);
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

// POST /api/users/login - Login and receive JWT
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

// POST /api/users/forgotPassword - Send reset password email
const forgotPassword = async (req, res, next) => {
  console.log("Forgot Password Request:", req.body);
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, "Email is required.", 400);
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return successResponse(
        res,
        "If an account with this email exists, an OTP has been sent."
      );
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save();

    // const resetToken = jwt.sing({ id: user._id }, process.end.JWT_SECRET, {
    //   expiresIn: "1h",
    // });
    // const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    // email_template = `<p>Hi ${user.firstName},</p>
    //  <p>You requested a password reset. Click the link below to reset your password:</p>
    //  <a href="${resetUrl}">Reset Password</a>
    //  <p>If you did not request this, please ignore this email.</p>
    //  <p>Thank you!</p>`

    const otp_html = `<p>Hi ${user.firstName},</p>
             <p>You requested a password reset. Your OTP is: <strong>${otp}</strong></p>
             <p>This OTP is valid for 10 minutes. </p>
             <p>If you did not request this, please ignore this email.</p>
             <p>Thank you!</p>`;

    const mailOptions = {
      from: `"QuickStock"<${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: otp_html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    const temp_opt_token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "10m",
    });

    return successResponse(res, "OTP email sent successfully.", {
      temp_opt_token
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/verify-otp - Verify OTP for password reset
const verifyOtp = async (req, res, next) => {
  console.log("Verify OTP Request:", req.body);
  const { otp } = req.body;
  const token = req.headers.authorization?.split(" ")[1];

  if (!otp || !token) {
    return errorResponse(res, "OTP and token are required.", 400);
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const user = await User.findOne({ email }).select("+otp +otpExpires");

    if (!user) return errorResponse(res, "User not found.", 404);
    if (!user.otp || user.otp !== otp)
      return errorResponse(res, "Invalid OTP.", 400);
    if (user.otpExpires < Date.now())
      return errorResponse(res, "OTP has expired.", 400);

    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // single-use token for the actual reset.
    const reset_token = jwt.sign(
      { email: user.email, purpose: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "10m" }
    );

    return successResponse(res, "OTP verified successfully.", { reset_token });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    next(err);
  }
};

// POST /api/users/resetPassword - Reset user password
const resetPassword = async (req, res, next) => {
  const { newPassword } = req.body;
  const token = req.headers.authorization?.split(" ")[1]; // This should be the 'reset_token'

  if (!newPassword || !token) {
    return errorResponse(res, "New password and token are required.", 400);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== "password-reset") {
      return errorResponse(res, "Invalid token purpose.", 403);
    }
    const email = decoded.email;

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return errorResponse(res, "User not found.", 404);
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    console.log("Password reset successfully for user:", user._id);
    return successResponse(res, "Password reset successfully.");
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return errorResponse(res, "Reset token has expired.", 400);
    }
    console.error("Error resetting password:", err);
    next(err);
  }
};

// GET /api/users/me - Get current user profile
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

// PATCH /api/users/updateUserInfo/:userId - Update user info
const updateUserInfo = async (req, res, next) => {
  const { firstName, lastName } = req.body;
  if (!firstName || !lastName) {
    return errorResponse(res, "Both firstName and lastName are required.", 400);
  }
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { firstName, lastName },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);
    return successResponse(res, "User info updated successfully.", updatedUser);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/updatePassword/:userId - Update password
const updatePassword = async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return errorResponse(res, "Both old and new password are required.", 400);
  }
  try {
    const user = await User.findById(req.params.userId).select("+password");
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

// PATCH /api/users/updateEmail/:userId - Update email
const updateEmail = async (req, res, next) => {
  const { email } = req.body;
  if (!email) return errorResponse(res, "Email is required.", 400);
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { email },
      { new: true, runValidators: true }
    );
    if (!updatedUser) return errorResponse(res, "User not found.", 404);
    return successResponse(res, "Email updated successfully.", updatedUser);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/updateProfileImage/:id - Update user profile image
const updateProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, "No file uploaded.", 400);
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
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

// PATCH /api/users/addPhoneNumber/:userId
const addPhoneNumber = async (req, res, next) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return errorResponse(res, "Phone number is required.", 400);
  }
  if (!/^\d{10}$/.test(phoneNumber)) {
    return errorResponse(res, "Phone number must be exactly 10 digits.", 400);
  }

  try {
    const user = await User.findById(req.params.userId);
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

// PATCH /api/users/deletePhoneNumber/:userId
const deletePhoneNumber = async (req, res, next) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return errorResponse(res, "Phone number to delete is required.", 400);
  }

  try {
    const user = await User.findById(req.params.userId);
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

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      update,
      {
        new: true,
      }
    );
    return successResponse(
      res,
      "Phone number removed successfully.",
      updatedUser
    );
  } catch (err) {
    next(err);
  }
};

// DELETE /api/users/deactivateUser/:userId (Soft Delete)
const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
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
  forgotPassword,
  verifyOtp,
  resetPassword,
  getCurrentUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  updateProfileImage,
  addPhoneNumber,
  deletePhoneNumber,
  deactivateUser,
};
