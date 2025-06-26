// models/Purchase.js
const mongoose = require("mongoose");

const purchaseItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitCost: {
    type: Number,
    required: true,
    min: 0,
  },
  totalCost: {
    type: Number,
    required: true,
    min: 0,
  },
});

const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    items: [purchaseItemSchema],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    purchaseStatus: {
      type: String,
      enum: ["ordered", "received", "cancelled"],
      default: "ordered",
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "online"],
      required: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
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

purchaseSchema.pre("save", function (next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalCost, 0);
  next();
});

const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
module.exports = Purchase;
