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
      // required: true,
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
      // required: true,
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

// Pre-save hook to calculate totalAmount and auto-generate purchaseNumber
purchaseSchema.pre("save", async function (next) {
  this.totalAmount = (this.items || []).reduce(
    (sum, item) => sum + item.totalCost,
    0
  );

  if (this.isNew && !this.purchaseNumber) {
    try {
      const lastPurchase = await this.constructor
        .findOne({}, { purchaseNumber: 1 })
        .sort({ purchaseNumber: -1 })
        .exec();

      let nextNumber = 1;
      if (lastPurchase && lastPurchase.purchaseNumber) {
        const lastNum = parseInt(
          lastPurchase.purchaseNumber.replace("PO-", "")
        );
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
      this.purchaseNumber = `PO-${String(nextNumber).padStart(6, "0")}`; // e.g., PO-000001
    } catch (error) {
      console.error("Error generating purchase number:", error);
      return next(error);
    }
  }

  next();
});

const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);
module.exports = Purchase;
