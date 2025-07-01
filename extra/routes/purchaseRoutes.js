// routes/purchaseRoutes.js
const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");

// Import middleware
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
const {
  validateRequest,
  commonSchemas,
} = require("../../middlewares/validateRequest");
const {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseQuerySchema, // Import the new purchase query schema
} = require("../validators/purchaseValidator");

// --- Purchase Routes ---

// POST /api/purchases - Create a new purchase
router.post(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(createPurchaseSchema),
  purchaseController.createPurchase
);

// GET /api/purchases - Get all purchases with pagination and filtering
router.get(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(purchaseQuerySchema, "query"), // Use specific query schema
  purchaseController.getAllPurchases
);

// GET /api/purchases/:id - Get a single purchase by ID
router.get(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  purchaseController.getPurchaseById
);

// PATCH /api/purchases/:id - Update a purchase by ID
// NOTE: This endpoint allows item updates but DOES NOT automatically adjust stock.
// Stock adjustments are handled only by the `/receive` endpoint or manual adjustments.
router.patch(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  validateRequest(updatePurchaseSchema),
  purchaseController.updatePurchase
);

// PATCH /api/purchases/:id/cancel - Cancel a purchase (soft delete)
router.patch(
  "/:id/cancel",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  purchaseController.cancelPurchase
);

// PATCH /api/purchases/:id/receive - Mark a purchase as received and update stock
router.patch(
  "/:id/receive",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  // If partial receipts are allowed, you'd add a Joi schema here for req.body.receivedItems
  // For now, assuming full receipt as per controller logic:
  // validateRequest(receivePurchaseSchema, "body"), // if you create one
  purchaseController.receivePurchase
);

// NOTE: The `getOverduePurchases` endpoint is not included in the routes
// as the `Purchase` model lacks the necessary fields (`paidAmount`, `paymentStatus`, `dueDate`)
// to reliably determine overdue status.

module.exports = router;
