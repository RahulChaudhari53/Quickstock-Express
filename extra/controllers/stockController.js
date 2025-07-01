// controllers/stockController.js
const Stock = require("../../models/Stock");
const Product = require("../../models/Product"); // <-- ADDED: Product model import
const {
  successResponse,
  errorResponse,
  notFoundResource, // <-- Corrected from notFoundResponse
  paginatedResponse,
} = require("../../utils/responseHandler");

// GET /api/stock - Get all stock levels with pagination and filtering
const getAllStock = async (req, res, next) => {
  // <-- Added 'next' for global error handling
  // Authorization (isShopOwner) and query validation (stockQuerySchema) handled by middleware.
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search, // Search by product name, SKU, or description
      lowStockThreshold, // Optional: filter for low stock
    } = req.query;

    const query = {};

    // Product search based on name, SKU, or description
    if (search) {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
          // { description: { $regex: search, $options: "i" } }, // Optional: include description if needed
        ],
      }).select("_id"); // Only select the _id to keep the payload small

      const productIds = matchingProducts.map((p) => p._id);

      if (productIds.length > 0) {
        query.product = { $in: productIds };
      } else {
        // If no products match the search, return an empty array early
        return paginatedResponse(
          res,
          "No stock found matching search criteria.",
          [],
          {
            totalPages: 0,
            currentPage: 1,
            totalItems: 0,
          }
        );
      }
    }

    // Low stock filter
    if (lowStockThreshold !== undefined && lowStockThreshold !== null) {
      const threshold = parseInt(lowStockThreshold);
      if (!isNaN(threshold) && threshold >= 0) {
        query.currentStock = { $lte: threshold };
      }
    }

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const stocks = await Stock.find(query)
      .populate("product", "name sku sellingPrice purchasePrice unit category") // Added more product fields for better context
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean(); // Use .lean() for read operations

    const total = await Stock.countDocuments(query);

    const totalPages = Math.ceil(total / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    return paginatedResponse(
      res,
      "Stock levels retrieved successfully.",
      stocks,
      {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      }
    );
  } catch (err) {
    // <-- Consistent 'err' variable
    console.error("Error getting all stock:", err);
    next(err); // <-- Delegate to global error handler
  }
};

// GET /api/stock/product/:productId - Get stock level for a specific product
const getStockByProductId = async (req, res, next) => {
  // <-- Added 'next'
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const { productId } = req.params;

  try {
    const stock = await Stock.findOne({ product: productId })
      .populate("product", "name sku sellingPrice purchasePrice unit category") // Added more fields
      .lean(); // Use .lean()

    if (!stock) {
      return notFoundResource(res, "Stock record"); // <-- Corrected helper
    }

    return successResponse(res, "Stock level retrieved successfully.", stock);
  } catch (err) {
    // <-- Consistent 'err' variable
    console.error("Error getting stock by product ID:", err);
    next(err); // <-- Delegate to global error handler
  }
};

// GET /api/stock/history/:productId - Get stock movement history for a specific product
const getStockMovement = async (req, res, next) => {
  // <-- Added 'next'
  // Authorization (isShopOwner) and ID/query validation handled by middleware.
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const stock = await Stock.findOne({ product: productId }).lean(); // Use .lean()
    if (!stock) {
      return notFoundResource(res, "Stock record"); // <-- Corrected helper
    }

    // IMPORTANT: Paginating an embedded array like 'movementHistory' means fetching the entire
    // document first, then slicing in memory. For very large history arrays, this can be
    // memory intensive. If history becomes excessively large, consider moving it to a
    // separate 'StockMovement' collection for scalable database-level pagination.
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);

    const history = stock.movementHistory
      .sort((a, b) => b.date - a.date) // Sort by date descending
      .slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);

    const totalMovements = stock.movementHistory.length;
    const totalPages = Math.ceil(totalMovements / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    return paginatedResponse(
      res,
      "Stock movement history retrieved successfully.",
      history,
      {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: totalMovements,
        totalPages,
        hasNextPage,
        hasPrevPage,
      }
    );
  } catch (err) {
    // <-- Consistent 'err' variable
    console.error("Error getting stock movement history:", err);
    next(err); // <-- Delegate to global error handler
  }
};

// GET /api/stock/summary - Get a summary of the stock (total value, item count, etc.)
const getStockSummary = async (req, res, next) => {
  // <-- Added 'next'
  // Authorization (isShopOwner) handled by middleware.
  try {
    const summary = await Stock.aggregate([
      {
        $lookup: {
          from: "products", // Ensure this matches your actual 'products' collection name
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      {
        $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: false }, // Use preserveNullAndEmptyArrays if you want to keep stock records without a matching product, though typically you wouldn't.
      },
      {
        $group: {
          _id: null,
          totalItems: { $sum: "$currentStock" },
          totalValueByPurchasePrice: {
            $sum: {
              $multiply: [
                "$currentStock",
                { $ifNull: ["$productInfo.purchasePrice", 0] },
              ], // Handle missing purchasePrice
            },
          },
          totalValueBySellingPrice: {
            $sum: {
              $multiply: [
                "$currentStock",
                { $ifNull: ["$productInfo.sellingPrice", 0] },
              ], // Handle missing sellingPrice
            },
          },
          distinctItems: { $sum: 1 }, // Count of unique stock entries (i.e., unique products in stock)
        },
      },
      {
        $project: {
          _id: 0,
          totalItems: { $ifNull: ["$totalItems", 0] },
          totalValueByPurchasePrice: {
            $ifNull: ["$totalValueByPurchasePrice", 0],
          },
          totalValueBySellingPrice: {
            $ifNull: ["$totalValueBySellingPrice", 0],
          },
          distinctItems: { $ifNull: ["$distinctItems", 0] },
        },
      },
    ]);

    // Ensure a default summary object is returned even if no stock records exist
    const finalSummary =
      summary.length > 0
        ? summary[0]
        : {
            totalItems: 0,
            totalValueByPurchasePrice: 0,
            totalValueBySellingPrice: 0,
            distinctItems: 0,
          };

    return successResponse(
      res,
      "Stock summary retrieved successfully.",
      finalSummary
    );
  } catch (err) {
    // <-- Consistent 'err' variable
    console.error("Error getting stock summary:", err);
    next(err); // <-- Delegate to global error handler
  }
};

module.exports = {
  getAllStock,
  getStockByProductId,
  getStockMovement,
  getStockSummary,
};
