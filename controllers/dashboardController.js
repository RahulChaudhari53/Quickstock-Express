const Stock = require("../models/Stock");
const Sale = require("../models/Sale");
const Purchase = require("../models/Purchase");
const Supplier = require("../models/Supplier");
const { successResponse, errorResponse } = require("../utils/responseHandler");

const getDashboardOverview = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id;
    const { startDate, endDate } = req.query;

    // Default to the last 30 days
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const [stockMetrics, salesOrders, purchaseOrders, activeSuppliers] =
      await Promise.all([
        // 1. aggregating core inventory metrics scoped to user
        Stock.aggregate([
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
            $match: {
              "productInfo.createdBy": authenticatedUserId,
              "productInfo.isActive": true,
            },
          },
          {
            $group: {
              _id: null,
              totalStockItems: { $sum: "$currentStock" },
              inventoryPurchaseValue: {
                $sum: {
                  $multiply: ["$currentStock", "$productInfo.purchasePrice"],
                },
              },
              inventorySellingValue: {
                $sum: {
                  $multiply: ["$currentStock", "$productInfo.sellingPrice"],
                },
              },
              activeProducts: { $sum: 1 },
              lowStockCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gt: ["$currentStock", 0] },
                        {
                          $lte: ["$currentStock", "$productInfo.minStockLevel"],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              outOfStockCount: {
                $sum: { $cond: [{ $eq: ["$currentStock", 0] }, 1, 0] },
              },
            },
          },
        ]),

        // 2. Aggregate sales data for the period scoped to user
        Sale.aggregate([
          {
            $match: {
              createdBy: authenticatedUserId,
              saleDate: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$totalAmount" },
              totalSalesOrders: { $sum: 1 },
            },
          },
        ]),

        // 3. Aggregate purchase data
        Purchase.aggregate([
          {
            $match: {
              createdBy: authenticatedUserId,
              orderDate: { $gte: start, $lte: end },
            },
          },
          {
            $group: {
              _id: null,
              totalPurchaseCosts: { $sum: "$totalAmount" },
              totalPurchaseOrders: { $sum: 1 },
            },
          },
        ]),

        // 4. Count active suppliers
        Supplier.countDocuments({
          createdBy: authenticatedUserId,
          isActive: true,
        }),
      ]);

    // Extract results and provide default values if no data exists
    const stockResults = stockMetrics[0] || {};
    const salesResults = salesOrders[0] || {};
    const purchaseResults = purchaseOrders[0] || {};

    // final response
    const overview = {
      totalStockItems: stockResults.totalStockItems || 0,
      inventoryPurchaseValue: stockResults.inventoryPurchaseValue || 0,
      inventorySellingValue: stockResults.inventorySellingValue || 0,
      activeProducts: stockResults.activeProducts || 0,
      lowStockCount: stockResults.lowStockCount || 0,
      outOfStockCount: stockResults.outOfStockCount || 0,
      totalSalesOrders: salesResults.totalSalesOrders || 0,
      totalRevenue: salesResults.totalRevenue || 0,
      totalPurchaseOrders: purchaseResults.totalPurchaseOrders || 0,
      totalPurchaseCosts: purchaseResults.totalPurchaseCosts || 0,
      activeSuppliers: activeSuppliers || 0,
    };

    return successResponse(
      res,
      "Dashboard overview retrieved successfully",
      overview
    );
  } catch (error) {
    console.error("Dashboard overview error:", error);
    next(error);
  }
};

module.exports = {
  getDashboardOverview,
};
