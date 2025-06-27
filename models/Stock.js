// models/Stock.js
const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    movementType: {
      type: String,
      enum: ["purchase", "sale", "adjustment", "return"],
      required: true,
      message:
        "Movement type is required and must be one of 'purchase', 'sale', 'adjustment', 'return'.",
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1 for a stock movement."],
    },
    sourceDocument: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
    },
    sourceModel: {
      type: String,
      enum: ["Purchase", "Sale", "Adjustment"],
      required: false,
      message:
        "Source model must be 'Purchase', 'Sale', or 'Adjustment' if provided.",
    },
    movedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      message: "The user who performed this movement is required.",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [200, "Notes cannot exceed 200 characters."],
    },
  },
  { _id: false }
);

const stockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
      message: "Product ID is required for a stock record.",
    },
    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Current stock cannot be negative."],
      message: "Current stock is required and cannot be negative.",
    },
    movementHistory: [stockMovementSchema],
  },
  {
    timestamps: true,
  }
);

stockSchema.statics.recordMovement = async function (
  productId,
  type,
  quantity,
  notes = "",
  sourceDocument = null,
  sourceModel = null,
  movedBy
) {
  if (typeof quantity !== "number" || quantity <= 0) {
    throw new Error("Quantity for stock movement must be a positive number.");
  }

  let updateQuantity;
  if (type === "sale") {
    updateQuantity = -quantity;
  } else if (
    type === "purchase" ||
    type === "adjustment" ||
    type === "return"
  ) {
    updateQuantity = quantity;
  } else {
    throw new Error(
      "Invalid movement type provided. Must be 'purchase', 'sale', 'adjustment', or 'return'."
    );
  }

  const movementEntry = {
    movementType: type,
    quantity: quantity,
    notes: notes,
    date: new Date(),
    movedBy: movedBy,
  };

  if (sourceDocument) {
    movementEntry.sourceDocument = sourceDocument;
  }
  if (sourceModel) {
    movementEntry.sourceModel = sourceModel;
  }

  const updatedStock = await this.findOneAndUpdate(
    { product: productId },
    {
      $inc: { currentStock: updateQuantity },
      $push: { movementHistory: movementEntry },
    },
    {
      new: true,
      upsert: false,
      runValidators: true,
    }
  );

  if (!updatedStock) {
    throw new Error(`Stock record not found for product ID: ${productId}.`);
  }

  return updatedStock;
};

const Stock = mongoose.models.Stock || mongoose.model("Stock", stockSchema);
module.exports = Stock;
