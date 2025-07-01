const express = require("express");
const router = express.Router();
const saleController = require("../controllers/saleController");
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
const {
  validateRequest,
  objectIdSchema, // For validating route parameters as ObjectId
} = require("../../middlewares/validateRequest");
const {
  createSaleSchema,
  updateSaleSchema,
  saleQuerySchema, // For GET all sales and summary query parameters
} = require("../validators/saleValidator");

// Apply authentication and authorization middleware to all sale routes
// All sale operations typically require a shop owner.
router.use(authenticateUser);
router.use(isShopOwner);

// POST /api/sales - Create a new sale
router.post(
  "/",
  validateRequest(createSaleSchema, "body"), // Validate request body with createSaleSchema
  saleController.createSale
);

// GET /api/sales - Get all sales with pagination and filtering
router.get(
  "/",
  validateRequest(saleQuerySchema, "query"), // Validate query parameters with saleQuerySchema
  saleController.getAllSales
);

// GET /api/sales/summary - Get sales summary for dashboard
// This route should come before /api/sales/:id to avoid matching 'summary' as an ID
router.get(
  "/summary",
  validateRequest(saleQuerySchema, "query"), // Validate query parameters (e.g., startDate, endDate)
  saleController.getSalesSummary
);

// GET /api/sales/:id - Get sale by ID
router.get(
  "/:id",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter as ObjectId
  saleController.getSaleById
);

// PATCH /api/sales/:id - Update sale
router.patch(
  "/:id",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter
  validateRequest(updateSaleSchema, "body"), // Validate request body with updateSaleSchema
  saleController.updateSale
);

// PATCH /api/sales/:id/cancel - Cancel sale and restore stock
router.patch(
  "/:id/cancel",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter
  saleController.cancelSale
);

module.exports = router;
