// saleController.js
const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const mongoose = require("mongoose");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /api/sales/create - Create a new sale
// transactional stock updates
const createSale = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const authenticatedUserId = req.user._id;

    const saleData = {
      ...req.body,
      createdBy: authenticatedUserId,
    };

    const { items, paymentMethod } = saleData;

    if (!paymentMethod) {
      await session.abortTransaction();
      return errorResponse(res, "Payment method is required.", 400);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return errorResponse(res, "A sale must include at least one item.", 400);
    }

    // first validating all items and check stock
    for (const item of items) {
      if (
        !item.product ||
        !item.quantity ||
        typeof item.unitPrice === "undefined"
      ) {
        await session.abortTransaction();
        return errorResponse(
          res,
          "Each item must have a product, quantity, and unit price.",
          400
        );
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        await session.abortTransaction();
        return errorResponse(
          res,
          `Invalid quantity for product ${item.product}.`,
          400
        );
      }
      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        await session.abortTransaction();
        return errorResponse(
          res,
          `Invalid unit price for product ${item.product}.`,
          400
        );
      }

      // validating product ownership first
      const product = await Product.findOne({
        _id: item.product,
        createdBy: authenticatedUserId,
      }).session(session);

      if (!product || !product.isActive) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(
          res,
          `Product not found or is inactive: ${item.product}.`,
          400
        );
      }

      // checking ownership after stock is confirmed
      const stock = await Stock.findOne({ product: item.product }).session(
        session
      );

      if (!stock || stock.currentStock < item.quantity) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(
          res,
          `Insufficient stock for product: ${product.name}.`,
          400
        );
      }
      item.totalPrice = item.quantity * item.unitPrice;
    }

    // second write to database
    const sale = new Sale(saleData);
    await sale.save({ session });

    // looping through the items again to record all stock movements.
    for (const item of sale.items) {
      await Stock.recordMovement(
        item.product,
        "sale",
        item.quantity,
        `Sale Invoice: ${sale.invoiceNumber}`,
        sale._id,
        "Sale",
        req.user._id,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    await sale.populate({ path: "items.product", select: "name sku unit" });

    return successResponse(res, "Sale created successfully.", sale, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating sale:", err);
    next(err);
  }
};

// Get api/sales - Get all sales
const getAllSales = async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "saleDate",
    sortOrder = "desc",
    paymentMethod,
    startDate,
    endDate,
    search,
  } = req.query;
  const authenticatedUserId = req.user._id;

  const query = { createdBy: authenticatedUserId }; // fixing the scope

  if (search) {
    query.invoiceNumber = { $regex: search, $options: "i" };
  }

  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  if (startDate || endDate) {
    query.saleDate = {};
    if (startDate) query.saleDate.$gte = new Date(startDate);
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.saleDate.$lte = endOfDay;
    }
  }

  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10) || 10;
  const skip = (parsedPage - 1) * parsedLimit;
  const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

  try {
    const sales = await Sale.find(query)
      .populate("items.product", "name sku unit")
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Sale.countDocuments(query);
    const totalPages = Math.ceil(total / parsedLimit);

    const data = {
      items: sales,
      pagination: {
        currentPage: parsedPage,
        limit: parsedLimit,
        totalItems: total,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };
    return successResponse(res, "Sales retrieved successfully.", data);
  } catch (err) {
    console.error("Error fetching sales: ", err);
    next(err);
  }
};

// Get api/sales/sale/:saleId
const getSaleById = async (req, res, next) => {
  const { saleId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const sale = await Sale.findOne({
      _id: saleId,
      createdBy: authenticatedUserId,
    })
      .populate("items.product", "name sku unit")
      .lean();

    if (!sale) {
      return errorResponse(res, "Sale not found.", 404);
    }
    return successResponse(res, "Sale retrieved successfully.", sale);
  } catch (err) {
    console.error("Error fetching sale:", err);
    next(err);
  }
};

// DELETE api/sales/sale/cancel/:saleId - Cancel a sale, restock stock and delete sale record
const cancelSale = async (req, res, next) => {
  const { saleId } = req.params;
  const authenticatedUserId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findOne({
      _id: saleId,
      createdBy: authenticatedUserId,
    }).session(session);

    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Sale not found.", 404);
    }

    // Restore stock for each item using 'return' movement type
    for (const item of sale.items) {
      await Stock.recordMovement(
        item.product, // product ID
        "return", // when customer returns items, we use 'return' type
        item.quantity, // quantity to restore
        `Cancellation for INV: ${sale.invoiceNumber}`, // notes for the movement
        sale._id, // sourceDocument
        "Sale", // sourceModel
        req.user._id, // movedBy is the user ID
        session
      );
    }

    // Delete the sale record itself within same transaction
    await Sale.findByIdAndDelete({
      _id: saleId,
      createdBy: authenticatedUserId,
    }).session(session);

    await session.commitTransaction();
    session.endSession();

    return successResponse(
      res,
      "Sale cancelled, stock restored, and record deleted successfully."
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error cancelling sale:", err);
    next(err);
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  cancelSale,
};
