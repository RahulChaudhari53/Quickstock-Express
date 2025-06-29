// User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    phoneNumbers: {
      type: [String],
      default: [],
      validate: {
        validator: function (v) {
          return v.length <= 2;
        },
        message: (props) =>
          `Maximum of 2 phone numbers allowed. You have ${props.value.length}.`,
      },
    },
    password: { type: String, required: true },
    profileUrl: { type: String },
    role: {
      type: String,
      enum: ["shop_owner", "admin"],
      default: "shop_owner",
    },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
