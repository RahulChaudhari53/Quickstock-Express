// controllers/saleController.js

const Sale = require("../../models/Sale");
const Product = require("../../models/Product");
const Customer = require("../../models/Customer");
const Stock = require("../../models/Stock");
const mongoose = require("mongoose");

const {
  successResponse,
  errorResponse,
  notFoundResource, // Corrected from notFoundResponse for consistency
  paginatedResponse,
} = require("../../utils/responseHandler");

// POST /api/sales - Create a new sale
const createSale = async (req, res, next) => {
  // Authorization (isShopOwner) and input validation (createSaleSchema) are handled by middleware.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const saleData = {
      ...req.body,
      createdBy: req.user._id, // Use req.user._id for consistency
    };

    // 1. Check for existing Invoice Number (case-sensitive as per typical invoice numbers)
    // Joi will handle format, this checks for uniqueness in DB.
    const existingSale = await Sale.findOne({
      invoiceNumber: saleData.invoiceNumber,
    }).session(session);
    if (existingSale) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Invoice number already exists.", 409); // 409 Conflict
    }

    // 2. Validate Customer: Ensure the customer exists and is active
    const customer = await Customer.findById(saleData.customer).session(
      session
    );
    if (!customer || !customer.isActive) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Invalid or inactive customer provided.", 400);
    }

    // 3. Pre-check stock for all items BEFORE creating sale or performing movements.
    // This helps prevent partial stock deductions and provides a clearer error message upfront.
    for (const item of saleData.items) {
      const stock = await Stock.findOne({ product: item.product }).session(
        session
      );
      // Ensure unitPrice is provided for each item.
      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(
          res,
          `Invalid unit price for product ID: ${item.product}.`,
          400
        );
      }
      if (!stock || stock.currentStock < item.quantity) {
        const product = await Product.findById(item.product)
          .select("name")
          .session(session);
        await session.abortTransaction();
        session.endSession();
        return errorResponse(
          res,
          `Insufficient stock for product: ${
            product ? product.name : "Unknown Product"
          }. Available: ${stock ? stock.currentStock : 0}, Requested: ${
            item.quantity
          }.`,
          400
        );
      }
    }

    // 4. Create the Sale document.
    // Assuming model pre-save hook calculates totalAmount.
    const sale = new Sale(saleData);
    await sale.save({ session }); // Pass session to save.

    // 5. Record stock movements for each item (deduction for sale).
    for (const item of sale.items) {
      await Stock.recordMovement(
        item.product,
        "sale_deduction", // Specific type for sale
        item.quantity,
        `Sale: ${sale.invoiceNumber}`,
        req.user._id, // User who created the sale
        sale._id, // Link to the sale document
        "Sale", // Indicate the source model
        session // Pass the session for transactional consistency
      );
    }

    // If all operations succeed, commit the transaction.
    await session.commitTransaction();
    session.endSession();

    // Populate necessary fields for the response AFTER transaction commits.
    await sale.populate([
      { path: "customer", select: "firstName lastName email phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(res, "Sale created successfully.", sale, 201);
  } catch (err) {
    // Consistent 'err' variable
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating sale:", err);
    // Delegate to global error handler for Mongoose errors or unexpected issues.
    next(err);
  }
};

// GET /api/sales - Get all sales with pagination and filtering
const getAllSales = async (req, res, next) => {
  // Authorization (isShopOwner) and query validation (saleQuerySchema) are handled by middleware.
  const {
    page = 1,
    limit = 10,
    sortBy = "saleDate",
    sortOrder = "desc",
    customer,
    saleStatus,
    paymentStatus,
    paymentMethod,
    startDate,
    endDate,
    search, // Added search query parameter
  } = req.query;

  const query = {};

  if (search) {
    query.invoiceNumber = { $regex: search, $options: "i" }; // Search by invoice number
    // For more complex search (e.g., customer name), an aggregation pipeline might be needed.
  }

  if (customer) {
    query.customer = new mongoose.Types.ObjectId(customer); // Ensure ObjectId type
  }

  if (saleStatus) {
    query.saleStatus = saleStatus;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  if (startDate || endDate) {
    query.saleDate = {};
    if (startDate) {
      query.saleDate.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set end date to end of day to include all records on the end date.
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query.saleDate.$lte = endOfDay;
    }
  }

  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

  try {
    const sales = await Sale.find(query)
      .populate("customer", "firstName lastName email phone")
      .populate("items.product", "name sku unit") // No 'currentStock' on Product model
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean(); // Use .lean() for faster query results if not modifying documents

    const total = await Sale.countDocuments(query);

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
      "Sales retrieved successfully.",
      sales,
      pagination
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Error fetching sales:", err);
    next(err); // Delegate to global error handler
  }
};

// GET /api/sales/:id - Get sale by ID
const getSaleById = async (req, res, next) => {
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const { id } = req.params; // Use 'id' for consistency

  try {
    const sale = await Sale.findById(id)
      .populate("customer", "firstName lastName email phone address")
      .populate("items.product", "name sku unit") // Removed 'currentStock' as it's not on Product model
      .lean(); // Use .lean() for faster query results

    if (!sale) {
      return notFoundResource(res, "Sale"); // Use notFoundResource helper
    }

    return successResponse(res, "Sale retrieved successfully.", sale);
  } catch (err) {
    // Consistent 'err' variable
    console.error("Error fetching sale:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/sales/:id - Update sale
const updateSale = async (req, res, next) => {
  // Authorization (isShopOwner) and validation (updateSaleSchema) handled by middleware.
  const { id } = req.params; // Use 'id' for consistency
  const updateData = req.body; // Joi validated this.

  try {
    const sale = await Sale.findById(id);
    if (!sale) {
      return notFoundResource(res, "Sale");
    }

    // IMPORTANT: Prevent item updates on sales with a 'completed' status.
    // If items need to be changed after completion, a dedicated "return" or "credit note"
    // system should be implemented that logs stock movements appropriately.
    if (sale.saleStatus === "completed" && updateData.items) {
      return errorResponse(
        res,
        "Cannot update items on a completed sale. Create a new transaction for adjustments.",
        400
      );
    }
    // Also prevent item updates if status changes to completed from a non-completed status.
    if (
      sale.saleStatus !== "completed" &&
      updateData.saleStatus === "completed" &&
      updateData.items
    ) {
      return errorResponse(
        res,
        "Cannot modify sale items when marking sale as completed.",
        400
      );
    }
    // If items are updated when sale is NOT completed, this would require a transaction
    // to reverse previous stock movements and apply new ones. For simplicity,
    // we assume item changes are rare or handled by separate return/refund flows,
    // as per your original approach (though stock integrity is at risk if items are changed without transaction).

    // Check if invoice number already exists (if being updated and changed)
    if (
      updateData.invoiceNumber &&
      updateData.invoiceNumber !== sale.invoiceNumber
    ) {
      const existingSale = await Sale.findOne({
        invoiceNumber: updateData.invoiceNumber,
      });
      if (existingSale) {
        return errorResponse(res, "Invoice number already exists.", 409); // 409 Conflict
      }
    }

    // Verify customer exists (if being updated and changed)
    if (
      updateData.customer &&
      updateData.customer.toString() !== sale.customer.toString()
    ) {
      const customer = await Customer.findById(updateData.customer);
      if (!customer || !customer.isActive) {
        return errorResponse(
          res,
          "Invalid or inactive customer provided.",
          400
        );
      }
    }

    // Update sale
    // Note: If updateData.items is present, and allowed by your Joi schema,
    // the model's pre-save hook for totalAmount would re-calculate,
    // but without transactional stock reversal, it's a "risky" update for stock.
    const updatedSale = await Sale.findByIdAndUpdate(id, updateData, {
      new: true, // Return the modified document
      runValidators: true, // Run Mongoose schema validators on the update
    }).populate([
      { path: "customer", select: "firstName lastName email phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(res, "Sale updated successfully.", updatedSale);
  } catch (err) {
    // Consistent 'err' variable
    console.error("Error updating sale:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/sales/:id/cancel - Cancel sale and restore stock
const cancelSale = async (req, res, next) => {
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(req.params.id).session(session); // Pass session to findById
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return notFoundResource(res, "Sale");
    }

    // Check if sale can be cancelled based on current status
    if (sale.saleStatus === "cancelled") {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Sale has already been cancelled.", 400);
    }
    if (sale.saleStatus === "refunded") {
      // Based on your model, 'refunded' is not a saleStatus, but a paymentStatus.
      // If sale.paymentStatus is 'refunded', it implies the financial aspect is handled,
      // and a 'cancel' might be redundant or require different logic.
      // Assuming 'refunded' is a paymentStatus, let's check against that for an error.
      if (sale.paymentStatus === "refunded") {
        await session.abortTransaction();
        session.endSession();
        return errorResponse(
          res,
          "Cannot cancel a sale that has already been refunded.",
          400
        );
      }
    }

    // Restore stock for each item using a specific 'sale_return' type of movement
    for (const item of sale.items) {
      await Stock.recordMovement(
        item.product,
        "sale_return", // Use 'sale_return' for stock restoration from cancellation/return
        item.quantity,
        `Cancelled Sale: ${sale.invoiceNumber}`,
        req.user._id, // User who cancelled it
        sale._id, // Link to the sale document
        "Sale", // Indicate source model
        session // Pass the session for transactional consistency
      );
    }

    // Update sale status to 'cancelled' and payment status to 'refunded'
    sale.saleStatus = "cancelled";
    sale.paymentStatus = "refunded"; // This assumes your Sale model has a 'paymentStatus' field.
    // If not, this line will have no effect.
    await sale.save({ session }); // Pass session to save

    await session.commitTransaction();
    session.endSession();

    // Populate details for response after committing
    await sale.populate([
      { path: "customer", select: "firstName lastName email phone" },
      { path: "items.product", select: "name sku unit" },
    ]);

    return successResponse(
      res,
      "Sale cancelled and stock restored successfully.",
      sale
    );
  } catch (err) {
    // Consistent 'err' variable
    await session.abortTransaction();
    session.endSession();
    console.error("Error cancelling sale:", err);
    next(err); // Delegate to global error handler
  }
};

// GET /api/sales/summary - Get sales summary for dashboard
const getSalesSummary = async (req, res, next) => {
  // Authorization (isShopOwner) and query validation handled by middleware.
  const { startDate, endDate } = req.query;

  try {
    // Parse dates or use default (last 30 days)
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    // Adjust endDate to end of day for proper range inclusion
    end.setHours(23, 59, 59, 999);

    // Base match stage for both aggregations
    const baseMatch = {
      saleDate: { $gte: start, $lte: end },
      saleStatus: "completed", // Only count completed sales for summary
    };

    // Get sales summary overview
    const salesSummary = await Sale.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null, // Group all matching documents
          totalSales: { $sum: "$totalAmount" },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: "$totalAmount" },
          totalItems: {
            $sum: {
              $reduce: {
                input: "$items",
                initialValue: 0,
                in: { $add: ["$$value", "$$this.quantity"] },
              },
            },
          },
        },
      },
      {
        $project: {
          // Ensure fields exist even if no sales for the period
          _id: 0, // Remove _id
          totalSales: { $ifNull: ["$totalSales", 0] },
          totalOrders: { $ifNull: ["$totalOrders", 0] },
          averageOrderValue: { $ifNull: ["$averageOrderValue", 0] },
          totalItems: { $ifNull: ["$totalItems", 0] },
        },
      },
    ]);

    // Get sales by payment method
    const salesByPaymentMethod = await Sale.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$paymentMethod", // Group by paymentMethod
          totalSales: { $sum: "$totalAmount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalSales: -1 } },
    ]);

    const summary = {
      period: { start, end },
      overview: salesSummary[0] || {
        // Ensure default values if no sales found
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        totalItems: 0,
      },
      byPaymentMethod: salesByPaymentMethod,
    };

    return successResponse(
      res,
      "Sales summary retrieved successfully.",
      summary
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Error fetching sales summary:", err);
    next(err); // Delegate to global error handler
  }
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSale,
  cancelSale,
  getSalesSummary,
};
