// routes/productRoutes.js
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController"); // Import the product controller

// Import middleware
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser"); // For user authentication
const {
  validateRequest,
  commonSchemas,
} = require("../../middlewares/validateRequest"); // For Joi validation
const {
  createProductSchema,
  updateProductSchema,
  productQuerySchema, // Import the specific product query schema
} = require("../validators/productValidator"); // For specific product Joi schemas

// --- Multer for Image Uploads ---
// It's best to centralize Multer configuration in config/multer.js
// so we will import the 'upload' instance configured there.
const upload = require("../../config/multer"); // Import the configured Multer instance

// --- Product Routes ---

// POST /api/products - Create a new product
// Order of middleware: Authentication -> Authorization -> File Upload -> Body Validation -> Controller
router.post(
  "/",
  authenticateUser,
  isShopOwner,
  upload.array("images", 5), // Multer middleware to handle array of images (max 5)
  validateRequest(createProductSchema), // Joi schema for product creation, will validate req.body AND req.files (Multer's output)
  productController.createProduct
);

// GET /api/products - Get all products with pagination, filtering, and search
// Requires authentication and shop_owner role. All query parameters are validated by productQuerySchema.
router.get(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(productQuerySchema, "query"), // Use the specific productQuerySchema for comprehensive query validation
  productController.getAllProducts
);

// GET /api/products/:id - Get a single product by ID
// Requires authentication, shop_owner role, and validation of product ID in parameters
router.get(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"), // Validate that :id is a valid MongoDB ObjectId
  productController.getProductById
);

// PATCH /api/products/:id - Update a product by ID (using PATCH for partial updates)
// Requires authentication, shop_owner role, and validation of ID and request body
// If updating images via file upload: `upload.array('images', 5)` should be included here as well
router.patch(
  "/:id",
  authenticateUser,
  isShopOwner,
  // If you allow image re-upload on update, include Multer here:
  // upload.array("images", 5),
  validateRequest(commonSchemas.objectId, "params"), // Validate :id
  validateRequest(updateProductSchema), // Joi schema for product update
  productController.updateProduct
);

// DELETE /api/products/:id - Soft delete a product by ID
// Requires authentication, shop_owner role, and validation of product ID
router.delete(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"), // Validate :id
  productController.deleteProduct
);

// PATCH /api/products/:id/activate - Reactivate a soft-deleted product
// Requires authentication, shop_owner role, and validation of product ID
router.patch(
  "/:id/activate",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"), // Validate :id
  productController.activateProduct
);

// GET /api/products/category/:categoryId - Get products by a specific category
// (Note: This can be handled by `getAllProducts` with a category filter, but if you prefer a dedicated route, keep it)
router.get(
  "/category/:categoryId",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params", "categoryId"), // Validate :categoryId from path
  validateRequest(productQuerySchema, "query"), // Apply comprehensive product query schema for this endpoint too
  productController.getProductsByCategory
);

module.exports = router;
