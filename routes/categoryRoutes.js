// routes/categoryRoutes.js
const express = require("express");
const router = express.Router();

const {
createCategory,
  getAllCategories,
  getCategoryById,
  deleteCategory,
  activateCategory,
} = require("../controllers/categoryController");

const {
  authenticateUser,
  isOwner,
  isSelf,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.post("/create", createCategory);
router.get("/", getAllCategories);
router.get("/category/:categoryId", getCategoryById); // not using in mobile
router.delete("/category/deactivate/:categoryId", deleteCategory);
router.patch("/category/activate/:categoryId", activateCategory);

module.exports = router;
