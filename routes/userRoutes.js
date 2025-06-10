// userRoutes.js
const express = require("express");
const upload = require("../middlewares/multer");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  addPhoneNumber,
  removePhoneNumber,
  deleteUser,
  getAllUsers,
} = require("../controllers/userController");

const { authenticateUser } = require("../middlewares/authenticateUser");

// Public routes
router.post("/signup", upload.single("profileImage"), registerUser);
// router.post("/signup", registerUser);
router.post("/login", loginUser);

// Protected routes - user actions
router.get("/:id/me", authenticateUser, getCurrentUser);
router.patch("/:id/updateUserInfo", authenticateUser, updateUserInfo);
router.patch("/:id/updatePassword", authenticateUser, updatePassword);
router.patch("/:id/updateEmail", authenticateUser, updateEmail);
router.patch("/:id/addPhoneNumber", authenticateUser, addPhoneNumber);
router.patch("/:id/removePhoneNumber", authenticateUser, removePhoneNumber);
router.delete("/:id/deleteUser", authenticateUser, deleteUser);

module.exports = router;

// for now getAll
router.get("/", getAllUsers);
