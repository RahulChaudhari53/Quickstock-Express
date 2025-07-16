const express = require("express");
const router = express.Router();

const {
  createSale,
  getAllSales,
  getSaleById,
  cancelSale,
} = require("../controllers/saleController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.post("/create", createSale);
router.get("/", getAllSales);
router.get("/sale/:saleId", getSaleById);
router.delete("/sale/cancel/:saleId", cancelSale); // this is if customer returns the product

module.exports = router;
