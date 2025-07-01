const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplierController");
// CHANGE START: Import authenticateUser and isShopOwner from authenticateUser.js
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
// CHANGE END
const {
  validateRequest,
  objectIdSchema, // For validating route parameters as ObjectId
} = require("../../middlewares/validateRequest");
const {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} = require("../validators/supplierValidator");

// Apply authentication and authorization middleware to all supplier routes
// All supplier operations typically require a shop owner.
// CHANGE START: Use authenticateUser directly
router.use(authenticateUser);
// CHANGE END
// CHANGE START: Use isShopOwner directly
router.use(isShopOwner);
// CHANGE END

// POST /api/suppliers - Create a new supplier
router.post(
  "/",
  validateRequest(createSupplierSchema, "body"), // Validate request body with createSupplierSchema
  supplierController.createSupplier
);

// GET /api/suppliers - Get all suppliers with pagination, filtering, and searching
router.get(
  "/",
  validateRequest(supplierQuerySchema, "query"), // Validate query parameters with supplierQuerySchema
  supplierController.getAllSuppliers
);

// GET /api/suppliers/:id - Get a single supplier by ID
router.get(
  "/:id",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter as ObjectId
  supplierController.getSupplierById
);

// PATCH /api/suppliers/:id - Update a supplier by ID
router.patch(
  "/:id",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter
  validateRequest(updateSupplierSchema, "body"), // Validate request body with updateSupplierSchema
  supplierController.updateSupplier
);

// PATCH /api/suppliers/:id/deactivate - Deactivate a supplier (soft delete)
router.patch(
  "/:id/deactivate",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter
  supplierController.deactivateSupplier
);

// PATCH /api/suppliers/:id/activate - Activate a supplier
router.patch(
  "/:id/activate",
  validateRequest(objectIdSchema, "params"), // Validate 'id' parameter
  supplierController.activateSupplier
);

module.exports = router;
