// models/Supplier.js
const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    contactPerson: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^\S+@\S+\.\S+$/,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{10}$/.test(v);
        },
        message: (props) =>
          `${props.value} is not a valid phone number! Must be exactly 10 digits.`,
      },
    },

    // is optional
    address: {
      street: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },
      city: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },
      state: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
      },
      zipCode: {
        type: String,
        required: true,
        trim: true,
        maxlength: 10,
      },
      country: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
        default: "Nepal",
      },
    },

    panNumber: {
      type: String,
      trim: true,
      maxlength: 20,
      // PAN (Permanent Account Number) for Nepal
    },

    paymentTerms: {
      type: Number,
      default: 30,
      min: 0,
      max: 365,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Supplier =
  mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);
module.exports = Supplier;
