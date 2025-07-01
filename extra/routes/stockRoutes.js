const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stockController");
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
const {
  validateRequest,
  objectIdSchema, // For validating route parameters as ObjectId
} = require("../../middlewares/validateRequest");
const {
  stockQuerySchema, // For GET all stock query parameters
  stockMovementQuerySchema, // For GET stock movement history query parameters
} = require("../validators/stockValidator");

// Apply authentication and authorization middleware to all stock routes
// All stock operations typically require a shop owner.
router.use(authenticateUser);
router.use(isShopOwner);

// GET /api/stock - Get all stock levels with pagination, filtering, and searching
router.get(
  "/",
  validateRequest(stockQuerySchema, "query"), // Validate query parameters
  stockController.getAllStock
);

// GET /api/stock/summary - Get a summary of the stock (total value, distinct items, etc.)
// This route should come before /api/stock/product/:productId to avoid matching 'summary' as a productId
router.get(
  "/summary",
  // No specific query schema for summary needed unless filters are introduced later.
  stockController.getStockSummary
);

// GET /api/stock/product/:productId - Get stock level for a specific product
router.get(
  "/product/:productId",
  validateRequest(objectIdSchema, "params", "productId"), // Validate 'productId' parameter as ObjectId
  stockController.getStockByProductId
);

// GET /api/stock/history/:productId - Get stock movement history for a specific product
router.get(
  "/history/:productId",
  validateRequest(objectIdSchema, "params", "productId"), // Validate 'productId' parameter
  validateRequest(stockMovementQuerySchema, "query"), // Validate query parameters (page, limit)
  stockController.getStockMovement
);

module.exports = router;
