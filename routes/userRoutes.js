// routes/userRoutes.js
const express = require("express");
const upload = require("../config/multer");
const router = express.Router();

const {
  registerUser,
  loginUser,
  getCurrentUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  updateProfileImage,
  addPhoneNumber,
  deletePhoneNumber,
  deleteUser,
} = require("../controllers/userController");

const { authenticateUser } = require("../middlewares/authenticateUser");
const {
  userValidationSchema,
  loginSchema,
} = require("../middlewares/validation");
const validateRequest = require("../middlewares/validateRequest");

// Public routes
router.post(
  "/signup",
  upload.single("profileImage"),
  validateRequest(userValidationSchema),
  registerUser
);
router.post("/login", validateRequest(loginSchema), loginUser);

// Protected routes - user actions
router.get("/:id/me", authenticateUser, getCurrentUser);
router.patch("/:id/updateUserInfo", authenticateUser, updateUserInfo);
router.patch("/:id/updatePassword", authenticateUser, updatePassword);
router.patch("/:id/updateEmail", authenticateUser, updateEmail);
router.patch(
  "/:id/updateProfileImage",
  authenticateUser,
  upload.single("profileImage"),
  updateProfileImage
);
router.patch("/:id/addPhoneNumber", authenticateUser, addPhoneNumber);
router.patch("/:id/deletePhoneNumber", authenticateUser, deletePhoneNumber);

router.delete("/:id/deleteUser", authenticateUser, deleteUser);

module.exports = router;
