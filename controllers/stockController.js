// controllers/stockController.js
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// GET /api/stocks - Get all stocks
const getAllStock = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      lowStockThreshold,
    } = req.query;

    const query = {};

    if (search) {
      const matchingProducts = await Product.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { sku: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      const productIds = matchingProducts.map((p) => p._id);

      if (productIds.length === 0) {
        return successResponse(
          res,
          "No stock found matching search criteria.",
          {
            items: [],
            pagination: {
              page: 1,
              limit: parseInt(limit, 10),
              totalItems: 0,
              totalPages: 0,
            },
          }
        );
      }
      query.product = { $in: productIds };
    }

    if (lowStockThreshold) {
      const threshold = parseInt(lowStockThreshold, 10);
      if (!isNaN(threshold)) {
        query.currentStock = { $lte: threshold };
      }
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const stocks = await Stock.find(query)
      .populate("product", "name sku sellingPrice purchasePrice unit category")
      .sort(sortOptions)
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Stock.countDocuments(query);
    const totalPages = Math.ceil(total / parsedLimit);

    const data = {
      items: stocks,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: total,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };

    return successResponse(res, "Stock levels retrieved successfully.", data);
  } catch (err) {
    console.error("Error getting all stock:", err);
    next(err);
  }
};

// GET /api/stocks/product/:productId
const getStockByProductId = async (req, res, next) => {
  const { productId } = req.params;
  try {
    const stock = await Stock.findOne({ product: productId })
      .populate("product", "name sku sellingPrice purchasePrice unit category")
      .lean();

    if (!stock) {
      return errorResponse(res, "Stock record not found.", 404);
    }
    return successResponse(res, "Stock level retrieved successfully.", stock);
  } catch (err) {
    console.error("Error getting stock by product ID:", err);
    next(err);
  }
};

// GET /api/stocks/history/:productId - Get stock movement history for a specific product
const getStockMovement = async (req, res, next) => {
  const { productId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const stock = await Stock.findOne({ product: productId }).lean();
    if (!stock) {
      return errorResponse(res, "Stock record not found.", 404);
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const totalMovements = stock.movementHistory.length;

    const history = stock.movementHistory
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);

    const totalPages = Math.ceil(totalMovements / parsedLimit);

    const data = {
      history: history,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalItems: totalMovements,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };

    return successResponse(
      res,
      "Stock movement history retrieved successfully.",
      data
    );
  } catch (err) {
    console.error("Error getting stock movement history:", err);
    next(err);
  }
};

module.exports = {
  getAllStock,
  getStockByProductId,
  getStockMovement,
};
