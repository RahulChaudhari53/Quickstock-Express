// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30,
    },
    email: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    primaryPhone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid phone number! Must be exactly 10 digits.`,
      },
    },
    secondaryPhone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function (v) {
          return !v || /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid phone number! Must be exactly 10 digits.`,
      },
      required: false,
    },
    password: { type: String, required: true, minlength: 8, select: false },
    profileImage: { type: String, required: false, trim: true },
    role: {
      type: String,
      enum: ["shop_owner", "admin"], 
      default: "shop_owner",
      required: true,
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
