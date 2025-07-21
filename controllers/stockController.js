// controllers/stockController.js
const mongoose = require("mongoose");
const Stock = require("../models/Stock");
const Product = require("../models/Product");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// GET /api/stocks - Get all stock levels for the logged-in user's products
const getAllStock = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      stockStatus,
      category,
    } = req.query;

    const productQuery = { createdBy: authenticatedUserId };

    if (search) {
      productQuery.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      productQuery.category = category;
    }

    // Get the list of product IDs that the user is allowed to see.
    const userProductIds = await Product.find(productQuery).distinct("_id");

    if (userProductIds.length === 0) {
      return successResponse(res, "No stock found matching criteria.", {
        items: [],
        pagination: {
          currentPage: 1,
          limit: parseInt(limit, 10),
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const stockQuery = { product: { $in: userProductIds } };

    const pipeline = [
      { $match: stockQuery },

      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "productInfo.category",
        },
      },
      // Deconstruct the new category array, preserving docs that might not have a category
      {
        $unwind: {
          path: "$productInfo.category",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    if (stockStatus) {
      const stockStatusMatch = {};
      if (stockStatus === "low_stock") {
        stockStatusMatch.$expr = {
          $lte: ["$currentStock", "$productInfo.minStockLevel"],
        };
      } else if (stockStatus === "out_of_stock") {
        stockStatusMatch.currentStock = { $eq: 0 };
      }
      if (Object.keys(stockStatusMatch).length > 0) {
        pipeline.push({ $match: stockStatusMatch });
      }
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    // Create a facet to run data query and count query in parallel
    const aggregation = await Stock.aggregate([
      {
        $facet: {
          items: [
            ...pipeline,
            { $sort: sortOptions },
            { $skip: skip },
            { $limit: parsedLimit },
          ],
          total: [...pipeline, { $count: "count" }],
        },
      },
    ]);

    const stocks = aggregation[0].items;
    const total =
      aggregation[0].total.length > 0 ? aggregation[0].total[0].count : 0;

    const totalPages = Math.ceil(total / parsedLimit);

    const data = {
      items: stocks.map((stock) => ({
        _id: stock._id,
        currentStock: stock.currentStock,
        product: {
          _id: stock.productInfo._id,
          name: stock.productInfo.name,
          sku: stock.productInfo.sku,
          minStockLevel: stock.productInfo.minStockLevel,
          category: {
            name: stock.productInfo.category?.name || "N/A",
          },
        },
        createdAt: stock.createdAt,
        updatedAt: stock.updatedAt,
      })),
      pagination: {
        currentPage: parsedPage,
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

// GET /api/stocks/product/:productId - Get stock for a single, user-owned product
const getStockByProductId = async (req, res, next) => {
  const { productId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    });

    if (!product) {
      return errorResponse(
        res,
        "Stock record not found or you lack permission.",
        404
      );
    }

    const stock = await Stock.findOne({ product: productId })
      .populate("product", "name sku sellingPrice purchasePrice unit category")
      .lean();

    if (!stock) {
      // This case might happen if a product was created but its initial stock record failed.
      return errorResponse(res, "Stock record not found.", 404);
    }
    return successResponse(res, "Stock level retrieved successfully.", stock);
  } catch (err) {
    console.error("Error getting stock by product ID:", err);
    next(err);
  }
};

// GET /api/stocks/history/:productId - Get stock movement history for a user-owned product
const getStockMovement = async (req, res, next) => {
  const { productId } = req.params;
  const authenticatedUserId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    });

    if (!product) {
      return errorResponse(
        res,
        "Stock record not found or you lack permission.",
        404
      );
    }

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    const aggregation = await Stock.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      {
        $facet: {
          paginatedHistory: [
            { $unwind: "$movementHistory" },
            { $sort: { "movementHistory.date": -1 } },
            { $skip: skip },
            { $limit: parsedLimit },
            {
              $lookup: {
                from: "users",
                localField: "movementHistory.movedBy",
                foreignField: "_id",
                as: "movedByUser",
              },
            },
            {
              $unwind: {
                path: "$movedByUser",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: "$movementHistory._id",
                movementType: "$movementHistory.movementType",
                quantity: "$movementHistory.quantity",
                date: "$movementHistory.date",
                notes: "$movementHistory.notes",
                movedBy: {
                  name: {
                    $concat: [
                      "$movedByUser.firstName",
                      " ",
                      "$movedByUser.lastName",
                    ],
                  },
                },
              },
            },
          ],
          totalCount: [
            { $project: { totalMovements: { $size: "$movementHistory" } } },
          ],
        },
      },
    ]);

    const history = aggregation[0]?.paginatedHistory || [];
    const totalMovements = aggregation[0]?.totalCount[0]?.totalMovements || 0;
    const totalPages = Math.ceil(totalMovements / parsedLimit);

    const data = {
      history: history,
      pagination: {
        currentPage: parsedPage,
        limit: parsedLimit,
        totalItems: totalMovements,
        totalPages: totalPages,
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
