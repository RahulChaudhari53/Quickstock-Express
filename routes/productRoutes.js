// routes/productRoutes.js
const express = require("express");
const router = express.Router();

const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  activateProduct,
  // getProductsByCategory,
} = require("../controllers/productController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);
router.post("/create", createProduct);
router.get("/", getAllProducts);
router.get("/product/:productId", getProductById);
router.patch("/product/update/:productId", updateProduct);
router.delete("/product/deactivate/:productId", deleteProduct);
router.patch("/product/activate/:productId", activateProduct);
// router.get("/category/:categoryId", getProductsByCategory);

module.exports = router;
