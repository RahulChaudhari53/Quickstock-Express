// models/Stock.js
const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      unique: true,
    },

    currentStock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    movementHistory: [
      {
        movementType: {
          type: String,
          enum: ["purchase", "sale", "adjustment"],
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        date: {
          type: Date,
          default: Date.now,
        },
        notes: {
          type: String,
          maxlength: 200,
        },
      },
    ],
  },
  { timestamps: true }
);

stockSchema.statics.recordMovement = async function (
  productId,
  type,
  quantity,
  notes = ""
) {
  const stock = await this.findOne({ product: productId });

  if (!stock) throw new Error("Stock record not found");

  if (type === "sale") {
    stock.currentStock -= quantity;
  } else if (type === "purchase" || type === "adjustment") {
    stock.currentStock += quantity;
  }

  if (stock.currentStock < 0) throw new Error("Insufficient stock");

  stock.movementHistory.push({
    movementType: type,
    quantity,
    notes,
  });

  return await stock.save();
};

const Stock = mongoose.models.Stock || mongoose.model("Stock", stockSchema);
module.exports = Stock;
