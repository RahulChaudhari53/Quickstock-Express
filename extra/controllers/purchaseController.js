// controllers/purchaseController.js
// Simplified purchase controller for small stores
// Keeps purchase records simple and updates stock quantities immediately

const Purchase = require("../../models/Purchase"); // Your provided Purchase model
const Product = require("../../models/Product");
const Supplier = require("../../models/Supplier");
const Stock = require("../../models/Stock"); // Ensure Stock model is available for recordMovement
const {
  successResponse,
  errorResponse,
  notFoundResource, // Corrected from notFoundResponse
  paginatedResponse,
} = require("../../utils/responseHandler");
const mongoose = require("mongoose"); // For transactions

// ===== CONTROLLER FUNCTIONS =====

/**
 * Create a new purchase
 * POST /api/purchases
 */
const createPurchase = async (req, res, next) => {
  // Added 'next' for global error handling
  // Authorization and input validation (req.body) handled by middleware
  // No transaction here, as per your original code for createPurchase
  // If you later decide createPurchase should also update stock (e.g., for immediate receipt),
  // then a transaction would be absolutely necessary here.

  try {
    const purchaseData = {
      ...req.body,
      createdBy: req.user._id, // Use req.user._id for consistency
    };

    // 1. Check if purchase number already exists (if provided by client)
    if (purchaseData.purchaseNumber) {
      // Only check if purchaseNumber is explicitly provided in the body
      const existingPurchase = await Purchase.findOne({
        purchaseNumber: purchaseData.purchaseNumber,
      });
      if (existingPurchase) {
        return errorResponse(res, "Purchase number already exists.", 409); // 409 Conflict
      }
    } else {
      // If purchaseNumber is not provided, the model's pre-save hook will generate it.
      // We don't need a uniqueness check here because the model's unique index will handle it
      // and the global error handler will catch the 11000 error.
    }

    // 2. Verify supplier exists and is active
    const supplier = await Supplier.findById(purchaseData.supplier);
    if (!supplier || !supplier.isActive) {
      return errorResponse(res, "Invalid or inactive supplier provided.", 400);
    }

    // 3. Verify all products exist and are active
    // Ensure totalCost is correctly calculated if not provided by client
    for (const item of purchaseData.items) {
      const product = await Product.findById(item.product);
      if (!product || !product.isActive) {
        return errorResponse(
          res,
          `Invalid or inactive product: ${item.product}.`,
          400
        );
      }
      // Ensure unitCost is valid for calculation on the model
      if (typeof item.unitCost !== "number" || item.unitCost < 0) {
        return errorResponse(
          res,
          `Invalid unit cost for product ${item.product}.`,
          400
        );
      }
      // totalCost is calculated by model's pre-save. If client sends it, we can ignore/override.
      // But if model depends on it being set, it needs to be explicitly derived here if not provided.
      // Given your model's pre-save hook, it sums up existing item.totalCost, so client needs to provide it.
      // Or, the model's pre-save hook needs to calculate it. (My previous suggestion did this).
      // Sticking to your model: if client doesn't send totalCost, it will be 0 on sum.
      // Assuming Joi ensures unitCost and quantity are numbers.
      if (item.quantity && item.unitCost) {
        item.totalCost = item.quantity * item.unitCost; // Calculate if not already set, or override
      } else {
        return errorResponse(
          res,
          `Missing quantity or unit cost for product ${item.product}.`,
          400
        );
      }
    }

    const purchase = new Purchase(purchaseData);
    await purchase.save(); // Model's pre-save calculates totalAmount

    // Populate supplier and product details for response
    await purchase.populate([
      { path: "supplier", select: "name contactPerson phone" },
      { path: "items.product", select: "name sku unit" }, // Removed 'currentStock'
    ]);

    return successResponse(
      res,
      "Purchase created successfully.",
      purchase,
      201
    );
  } catch (err) {
    // Corrected 'error' to 'err'
    console.error("Error creating purchase:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Get all purchases with pagination and filtering
 * GET /api/purchases
 */
const getAllPurchases = async (req, res, next) => {
  // Added 'next'
  // Authorization and query validation handled by middleware
  const {
    page = 1,
    limit = 10,
    sortBy = "orderDate",
    sortOrder = "desc",
    supplier,
    purchaseStatus,
    paymentStatus, // This field does not exist in your provided model
    startDate,
    endDate,
    search, // From query schema
  } = req.query;

  const query = {};

  if (supplier) {
    query.supplier = new mongoose.Types.ObjectId(supplier); // Ensure ObjectId type
  }

  if (purchaseStatus) {
    query.purchaseStatus = purchaseStatus;
  }

  // NOTE: paymentStatus filter cannot be applied as 'paymentStatus' is not in your provided model.
  // if (paymentStatus) {
  //   query.paymentStatus = paymentStatus;
  // }

  if (startDate || endDate) {
    query.orderDate = {};
    if (startDate) {
      query.orderDate.$gte = new Date(startDate);
    }
    if (endDate) {
      const endOfDay = new Date(endDate); // Include full end day
      endOfDay.setHours(23, 59, 59, 999);
      query.orderDate.$lte = endOfDay;
    }
  }

  if (search) {
    query.$or = [
      { purchaseNumber: { $regex: search, $options: "i" } },
      // You could add logic here to search by supplier name,
      // but it would require an aggregation pipeline to join and then match.
    ];
  }

  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  try {
    const purchases = await Purchase.find(query)
      .populate("supplier", "name contactPerson phone")
      .populate("items.product", "name sku unit") // Removed 'currentStock'
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean(); // Use .lean() for performance

    const total = await Purchase.countDocuments(query);

    const totalPages = Math.ceil(total / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    const pagination = {
      page: parsedPage,
      limit: parsedLimit,
      totalItems: total,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };

    return paginatedResponse(
      res,
      "Purchases retrieved successfully.",
      purchases,
      pagination
    );
  } catch (err) {
    // Corrected 'error' to 'err'
    console.error("Error fetching purchases:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Get purchase by ID
 * GET /api/purchases/:id
 */
const getPurchaseById = async (req, res, next) => {
  // Added 'next'
  // Authorization and ID validation handled by middleware
  const { id } = req.params; // Use 'id' for consistency

  try {
    const purchase = await Purchase.findById(id) // Use 'id'
      .populate("supplier", "name contactPerson phone email address")
      .populate("items.product", "name sku unit") // Removed 'currentStock'
      .lean(); // Use .lean()

    if (!purchase) {
      return notFoundResource(res, "Purchase"); // Use notFoundResource
    }

    return successResponse(res, "Purchase retrieved successfully.", purchase);
  } catch (err) {
    // Corrected 'error' to 'err'
    console.error("Error fetching purchase:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Update purchase
 * PATCH /api/purchases/:id (using PATCH for partial updates)
 *
 * IMPORTANT: This simplified update allows item changes. If items are changed
 * it does NOT automatically adjust stock. Stock adjustments are handled only
 * by the `receivePurchase` endpoint or manual stock adjustments.
 * This is a simplification based on your provided model.
 */
const updatePurchase = async (req, res, next) => {
  // Added 'next'
  // Authorization and validation handled by middleware
  const { id } = req.params;
  const updateData = req.body;

  try {
    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return notFoundResource(res, "Purchase");
    }

    // Check if purchase number already exists (if being updated and changed)
    if (
      updateData.purchaseNumber &&
      updateData.purchaseNumber !== purchase.purchaseNumber
    ) {
      const existingPurchase = await Purchase.findOne({
        purchaseNumber: updateData.purchaseNumber,
      });
      if (existingPurchase) {
        return errorResponse(res, "Purchase number already exists.", 409); // 409 Conflict
      }
    }

    // Verify supplier exists (if being updated and changed)
    if (
      updateData.supplier &&
      updateData.supplier.toString() !== purchase.supplier.toString()
    ) {
      const supplier = await Supplier.findById(updateData.supplier);
      if (!supplier || !supplier.isActive) {
        return errorResponse(
          res,
          "Invalid or inactive supplier provided.",
          400
        );
      }
    }

    // Verify all products exist and are active if items are being updated
    // IMPORTANT: This update DOES NOT trigger stock adjustments automatically for item changes.
    // Stock is only adjusted via the 'receivePurchase' endpoint.
    if (updateData.items) {
      for (const item of updateData.items) {
        const product = await Product.findById(item.product);
        if (!product || !product.isActive) {
          return errorResponse(
            res,
            `Invalid or inactive product: ${item.product}.`,
            400
          );
        }
        // Ensure totalCost for each item is calculated if not provided by client
        if (item.quantity && item.unitCost) {
          item.totalCost = item.quantity * item.unitCost; // Calculate totalCost for consistency with model's pre-save sum
        } else {
          return errorResponse(
            res,
            `Missing quantity or unit cost for product ${item.product} in update.`,
            400
          );
        }
      }
      // Re-calculate totalAmount if items change. Model's pre-save hook should handle this.
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id, // Use 'id' for consistency
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: "supplier", select: "name contactPerson phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(
      res,
      "Purchase updated successfully.",
      updatedPurchase
    );
  } catch (err) {
    // Corrected 'error' to 'err'
    console.error("Error updating purchase:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Cancel purchase (soft delete by status update)
 * PATCH /api/purchases/:id/cancel (Renamed from DELETE)
 * This avoids direct deletion for transactional records.
 */
const cancelPurchase = async (req, res, next) => {
  // Added 'next'
  // Authorization and ID validation handled by middleware
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return notFoundResource(res, "Purchase");
    }

    // Check if purchase can be cancelled
    if (purchase.purchaseStatus === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Purchase has already been cancelled.", 400);
    }
    // Cannot cancel if already received (full or partial) as per fixed model enum
    if (purchase.purchaseStatus === "received") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(
        res,
        "Cannot cancel a received purchase. Initiate a return-to-supplier process if needed.",
        400
      );
    }
    // Your original code had `if (purchase.purchaseStatus !== 'draft')`.
    // Since 'draft' is not in your model's enum, this logic is removed.
    // The current logic only allows cancelling 'ordered' purchases.

    // Soft delete - set purchase status to cancelled
    purchase.purchaseStatus = "cancelled";
    // NOTE: Your model does not have 'paymentStatus' or 'paidAmount', so cannot adjust these here.
    await purchase.save({ session });

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, "Purchase cancelled successfully.");
  } catch (err) {
    // Corrected 'error' to 'err'
    await session.abortTransaction();
    session.endSession();
    console.error("Error cancelling purchase:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Receive purchase and update stock
 * PATCH /api/purchases/:id/receive (Changed from PUT to PATCH)
 */
const receivePurchase = async (req, res, next) => {
  // Added 'next'
  // Authorization and ID validation handled by middleware
  // You might want to validate req.body for 'receivedItems' if partial receipt is allowed
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findById(req.params.id).session(session);
    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return notFoundResource(res, "Purchase"); // Use notFoundResource
    }

    // Check if purchase can be received
    if (purchase.purchaseStatus === "received") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(
        res,
        "Purchase has already been fully received.",
        400
      );
    }
    if (purchase.purchaseStatus === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Cannot receive a cancelled purchase.", 400);
    }
    // If you plan for partial receipt, you'd add logic here to compare quantities
    // For simplicity, assuming full receipt of all items on the purchase order
    // as your original code did.

    // Update stock for each item
    for (const item of purchase.items) {
      await Stock.recordMovement(
        item.product,
        "purchase_receipt", // Specific type for receiving items
        item.quantity,
        `Purchase Receipt: ${purchase.purchaseNumber}`,
        req.user._id, // Who performed the movement
        purchase._id, // Source document ID
        "Purchase", // Source document model
        session // Pass the session for transactional consistency
      );
    }

    // Update purchase status and received date (NOTE: receivedDate is NOT in your model, so this will have no effect)
    purchase.purchaseStatus = "received";
    // purchase.receivedDate = new Date(); // This field is NOT in your provided model

    await purchase.save({ session });

    await session.commitTransaction();
    session.endSession();

    // Populate details for response
    await purchase.populate([
      { path: "supplier", select: "name contactPerson phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(
      res,
      "Purchase received and stock updated successfully.",
      purchase
    );
  } catch (err) {
    // Corrected 'error' to 'err'
    await session.abortTransaction();
    session.endSession();
    console.error("Error receiving purchase:", err);
    next(err); // Delegate to global error handler
  }
};

/**
 * Get overdue purchases (removed due to model limitations)
 * GET /api/purchases/overdue - This endpoint cannot be fully implemented with your current model
 * as 'paidAmount', 'paymentStatus', and 'dueDate' fields are missing from the Purchase model.
 * It will be kept commented out or removed from module.exports until the model is extended.
 */
// const getOverduePurchases = async (req, res, next) => { /* ... (Removed logic) ... */ };

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  cancelPurchase, // Renamed from deletePurchase
  receivePurchase,
  // getOverduePurchases, // Removed due to model limitations
};
