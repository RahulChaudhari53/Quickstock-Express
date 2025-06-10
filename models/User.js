// User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    phoneNumbers: { type: [String], default: [], required: true }, // max 2, at least 1
    password: { type: String, required: true },
    profileUrl: { type: String },
    role: { type: String, default: "shop_owner" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
