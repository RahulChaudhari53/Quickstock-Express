// routes/customerRoutes.js
const express = require("express");
const router = express.Router();
const {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  activateCustomer,
} = require("../controllers/customerController");
const {
  authenticateUser,
  isShopOwner,
} = require("../../middlewares/authenticateUser");
const {
  validateRequest,
  commonSchemas,
} = require("../../middlewares/validateRequest");
const {
  createCustomerSchema,
  updateCustomerSchema,
} = require("../validators/customerValidator"); // Make sure these are updated

router.post(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(createCustomerSchema),
  createCustomer
);
router.get(
  "/",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.pagination, "query"),
  validateRequest(commonSchemas.search, "query"),
  getAllCustomers
);
router.get(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  getCustomerById
);
router.patch(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  validateRequest(updateCustomerSchema),
  updateCustomer
);
router.delete(
  "/:id",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  deleteCustomer
); // Soft delete
router.patch(
  "/:id/activate",
  authenticateUser,
  isShopOwner,
  validateRequest(commonSchemas.objectId, "params"),
  activateCustomer
); // Reactivate

module.exports = router;
