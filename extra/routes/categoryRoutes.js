// routes/categoryRoutes.js
const express = require("express");
const router = express.Router();
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  activateCategory,
} = require("../controllers/categoryController");
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
const {
  validateRequest,
  commonSchemas,
} = require("../../middlewares/validateRequest");
const {
  createCategorySchema,
  updateCategorySchema,
} = require("../validators/categoryValidator");

// Apply authenticateUser and isShopOwner to all relevant routes
router.post(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(createCategorySchema),
  createCategory
);
router.get(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.pagination, "query"),
  validateRequest(commonSchemas.search, "query"),
  getAllCategories
);
router.get(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  getCategoryById
);
router.patch(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  validateRequest(updateCategorySchema),
  updateCategory
);
router.delete(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  deleteCategory
);
router.patch(
  "/:id/activate",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  activateCategory
);

module.exports = router;
