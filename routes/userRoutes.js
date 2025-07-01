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
  deactivateUser,
} = require("../controllers/userController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

// Public routes
router.post("/signup", upload.single("profileImage"), registerUser);
router.post("/login", loginUser);

// Protected routes
router.use(authenticateUser);

router.get("/me", getCurrentUser);

router.patch("/:id/updateUserInfo", isOwner, updateUserInfo);
router.patch("/:id/updatePassword", isOwner, updatePassword);
router.patch("/:id/updateEmail", isOwner, updateEmail);
router.patch(
  "/:id/updateProfileImage",
  isOwner,
  upload.single("profileImage"),
  updateProfileImage
);
router.patch("/:id/addPhoneNumber", isOwner, addPhoneNumber);
router.patch("/:id/deletePhoneNumber", isOwner, deletePhoneNumber);
router.delete("/:id/deactivateUser", isOwner, deactivateUser);

module.exports = router;
