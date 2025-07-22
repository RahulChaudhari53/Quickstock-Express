// routes/supplierRoutes.js
const express = require("express");
const router = express.Router();
const {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
} = require("../controllers/supplierController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.post("/create", createSupplier);
router.get("/", getAllSuppliers);
router.get("/supplier/:supplierId", getSupplierById);
router.patch("/supplier/update/:supplierId", updateSupplier);
router.patch("/supplier/deactivate/:supplierId", deactivateSupplier);
router.patch("/supplier/activate/:supplierId", activateSupplier);

module.exports = router;
