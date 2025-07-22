// stockRoutes.js
const express = require("express");
const router = express.Router();

const {
  getAllStock,
  getStockByProductId,
  getStockMovement,
} = require("../controllers/stockController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.get("/", getAllStock);
router.get("/product/:productId", getStockByProductId);
router.get("/history/:productId", getStockMovement);

module.exports = router;
