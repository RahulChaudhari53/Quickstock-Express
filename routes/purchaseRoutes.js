const express = require("express");
const router = express.Router();
const {
  createPurchase,
  getAllPurchases,
  getPurchaseById,
  updatePurchase,
  cancelPurchase,
  receivePurchase,
} = require("../controllers/purchaseController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.post("/create", createPurchase);
router.get("/", getAllPurchases);
router.get("/purchase/:purchaseId", getPurchaseById);
router.patch("/purchase/update/:purchaseId", updatePurchase);
router.patch("/purchase/cancel/:purchaseId", cancelPurchase);
router.patch("/purchase/receive/:purchaseId", receivePurchase);

module.exports = router;