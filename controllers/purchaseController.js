// controllers/purchaseController.js
const Purchase = require("../models/Purchase");
const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const Stock = require("../models/Stock");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const mongoose = require("mongoose");

// POST /api/purchases - Create a new purchase
const createPurchase = async (req, res, next) => {
  const authenticatedUserId = req.user._id;

  try {
    const purchaseData = {
      ...req.body,
      createdBy: req.user._id,
    };

    const { supplier: supplierId, items } = purchaseData;

    if (!supplierId) {
      return errorResponse(res, "Supplier is required.", 400);
    }
    const supplier = await Supplier.findOne({
      _id: supplierId,
      createdBy: authenticatedUserId,
    });
    if (!supplier || !supplier.isActive) {
      return errorResponse(res, "Invalid or inactive supplier provided.", 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(
        res,
        "Purchase must include at least one item.",
        400
      );
    }

    for (const item of items) {
      if (!item.product || !item.quantity || !item.unitCost) {
        return errorResponse(
          res,
          "Each item must have a product, quantity, and unit cost.",
          400
        );
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return errorResponse(
          res,
          `Invalid quantity for product ${item.product}.`,
          400
        );
      }
      if (typeof item.unitCost !== "number" || item.unitCost < 0) {
        return errorResponse(
          res,
          `Invalid unit cost for product ${item.product}.`,
          400
        );
      }

      const product = await Product.findOne({
        _id: item.product,
        createdBy: authenticatedUserId,
      });
      if (!product || !product.isActive) {
        return errorResponse(
          res,
          `Invalid or inactive product: ${item.product}.`,
          400
        );
      }
      item.totalCost = item.quantity * item.unitCost;
    }

    if (purchaseData.purchaseNumber) {
      const existingPurchase = await Purchase.findOne({
        purchaseNumber: purchaseData.purchaseNumber,
      });
      if (existingPurchase) {
        return errorResponse(res, "Purchase number already exists.", 409);
      }
    }

    const purchase = new Purchase(purchaseData);
    await purchase.save();

    await purchase.populate([
      { path: "supplier", select: "name contactPerson phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(
      res,
      "Purchase created successfully.",
      purchase,
      201
    );
  } catch (err) {
    console.error("Error creating purchase:", err);
    next(err);
  }
};

// GET /api/purchases - Get all purchases
const getAllPurchases = async (req, res, next) => {
  const authenticatedUserId = req.user._id;

  const {
    page = 1,
    limit = 10,
    sortBy = "orderDate",
    sortOrder = "desc",
    supplier,
    purchaseStatus,
    startDate,
    endDate,
    search,
  } = req.query;

  const query = { createdBy: authenticatedUserId };

  if (supplier) query.supplier = new mongoose.Types.ObjectId(supplier);
  if (purchaseStatus) query.purchaseStatus = purchaseStatus;

  if (startDate || endDate) {
    query.orderDate = {};
    if (startDate) query.orderDate.$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.orderDate.$lte = endOfDay;
    }
  }

  if (search) {
    query.purchaseNumber = { $regex: search, $options: "i" };
  }

  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);
  const skip = (parsedPage - 1) * parsedLimit;
  const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  try {
    const purchases = await Purchase.find(query)
      .populate("supplier", "name contactPerson phone")
      .populate("items.product", "name sku unit")
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Purchase.countDocuments(query);
    const totalPages = Math.ceil(total / parsedLimit);

    const data = {
      items: purchases,
      pagination: {
        currentPage: parsedPage,
        limit: parsedLimit,
        totalItems: total,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };

    return successResponse(res, "Purchases retrieved successfully.", data);
  } catch (err) {
    console.error("Error fetching purchases:", err);
    next(err);
  }
};

// GET /api/purchases/purchase/:purchaseId - Get purchase by ID
const getPurchaseById = async (req, res, next) => {
  const { purchaseId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      createdBy: authenticatedUserId,
    })
      .populate("supplier", "name contactPerson phone email address")
      .populate("items.product", "name sku unit")
      .lean();

    if (!purchase) {
      return errorResponse(res, "Purchase not found.", 404);
    }

    return successResponse(res, "Purchase retrieved successfully.", purchase);
  } catch (err) {
    console.error("Error fetching purchase:", err);
    next(err);
  }
};

// PATCH /api/purchases/purchase/update/:purchaseId - Update purchase
const updatePurchase = async (req, res, next) => {
  const { purchaseId } = req.params;
  const updateData = req.body;
  const authenticatedUserId = req.user._id;

  try {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      createdBy: authenticatedUserId,
    });
    if (!purchase) {
      return errorResponse(res, "Purchase not found.", 404);
    }

    if (["received", "cancelled"].includes(purchase.purchaseStatus)) {
      return errorResponse(
        res,
        `Cannot update a purchase that is already ${purchase.purchaseStatus}.`,
        400
      );
    }

    if (
      updateData.purchaseNumber &&
      updateData.purchaseNumber !== purchase.purchaseNumber
    ) {
      const existingPurchase = await Purchase.findOne({
        purchaseNumber: updateData.purchaseNumber,
      });
      if (existingPurchase) {
        return errorResponse(res, "Purchase number already exists.", 409);
      }
    }

    if (
      updateData.supplier &&
      updateData.supplier.toString() !== purchase.supplier.toString()
    ) {
      const supplier = await Supplier.findOne({
        _id: updateData.supplier,
        createdBy: authenticatedUserId,
      });
      if (!supplier || !supplier.isActive) {
        return errorResponse(
          res,
          "Invalid or inactive supplier provided.",
          400
        );
      }
    }

    if (updateData.items) {
      if (!Array.isArray(updateData.items) || updateData.items.length === 0) {
        return errorResponse(
          res,
          "Purchase must include at least one item.",
          400
        );
      }
      for (const item of updateData.items) {
        if (!item.product || !item.quantity || !item.unitCost) {
          return errorResponse(
            res,
            "Each item must have a product, quantity, and unit cost.",
            400
          );
        }
        const product = await Product.findOne({
          _id: item.product,
          createdBy: authenticatedUserId,
        });
        if (!product || !product.isActive) {
          return errorResponse(
            res,
            `Invalid or inactive product: ${item.product}.`,
            400
          );
        }
        item.totalCost = item.quantity * item.unitCost;
      }

      updateData.totalAmount = updateData.items.reduce(
        (sum, item) => sum + item.totalCost,
        0
      );
    }

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      purchaseId,
      updateData,
      {
        new: true,
        runValidators: true,
      }
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
    console.error("Error updating purchase:", err);
    next(err);
  }
};

// PATCH /api/purchases/purchase/cancel/:purchaseId - Cancel a purchase
const cancelPurchase = async (req, res, next) => {
  const { purchaseId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      createdBy: authenticatedUserId,
    });
    if (!purchase) {
      return errorResponse(res, "Purchase not found.", 404);
    }

    if (purchase.purchaseStatus === "cancelled") {
      return errorResponse(res, "Purchase has already been cancelled.", 400);
    }
    if (purchase.purchaseStatus === "received") {
      return errorResponse(res, "Cannot cancel a received purchase.", 400);
    }

    purchase.purchaseStatus = "cancelled";
    await purchase.save();

    return successResponse(res, "Purchase cancelled successfully.");
  } catch (err) {
    console.error("Error cancelling purchase:", err);
    next(err);
  }
};

// PATCH /api/purchases/purchase/receive:purchaseId - Receive purchase and update stock
const receivePurchase = async (req, res, next) => {
  const { purchaseId } = req.params;
  const authenticatedUserId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const purchase = await Purchase.findOne({
      _id: purchaseId,
      createdBy: authenticatedUserId,
    }).session(session);

    if (!purchase) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Purchase not found.", 404);
    }

    if (purchase.purchaseStatus !== "ordered") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(
        res,
        `Cannot receive a purchase that is already ${purchase.purchaseStatus}.`,
        400
      );
    }

    for (const item of purchase.items) {
      await Stock.recordMovement(
        item.product,
        "purchase", // type for receiving stock
        item.quantity,
        `Receipt for PO: ${purchase.purchaseNumber}`, // this is the note for the stock movement
        purchase._id, // sourceDocument is the purchase ID
        "Purchase", // sourceModel is "Purchase"
        req.user._id, // movedBy is the user ID
        session
      );
    }

    purchase.purchaseStatus = "received";
    await purchase.save({ session });

    await session.commitTransaction();
    session.endSession();

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
    await session.abortTransaction();
    session.endSession();
    console.error("Error receiving purchase:", err);
    next(err);
  }
};

module.exports = {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  cancelPurchase,
  receivePurchase,
};
