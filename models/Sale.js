// models/Sale.js
const mongoose = require("mongoose");

const saleItemSchema = new mongoose.Schema({
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
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },
    items: [saleItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "online"],
      required: true,
    },
    saleDate: {
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

// Pre-save hook to calculate totalAmount and auto-generate invoiceNumber
saleSchema.pre("save", async function (next) {
  this.totalAmount = this.items.reduce((sum, item) => sum + item.totalPrice, 0);

  if (this.isNew && !this.invoiceNumber) {
    try {
      const lastSale = await this.constructor
        .findOne({}, { invoiceNumber: 1 })
        .sort({ invoiceNumber: -1 })
        .exec();

      let nextNumber = 1;
      if (lastSale && lastSale.invoiceNumber) {
        const lastNum = parseInt(lastSale.invoiceNumber.replace("INV-", ""));
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
      this.invoiceNumber = `INV-${String(nextNumber).padStart(6, "0")}`; 
    } catch (error) {
      console.error("Error generating invoice number:", error);
      return next(error);
    }
  }

  next();
});

const Sale = mongoose.models.Sale || mongoose.model("Sale", saleSchema);
module.exports = Sale;