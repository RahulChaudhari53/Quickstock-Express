const express = require("express");
const upload = require("../config/multer");
const router = express.Router();

const {
  registerUser,
  loginUser,
  forgotPassword,
  verifyOtp,
  resetPassword,
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
  isSelf,
} = require("../middlewares/authenticateUser");

const handleMulterError = require("../middlewares/multerErrorHandler");

// Public routes
router.post("/signup", registerUser);
router.post("/login", loginUser);
router.post("/forgotPassword", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/resetPassword", resetPassword);

// Protected routes
router.use(authenticateUser);

router.get("/me", getCurrentUser);

router.use(isOwner);
router.patch("/updateUserInfo/:userId", isSelf, updateUserInfo);
router.patch("/updatePassword/:userId", isSelf, updatePassword);
router.patch("/updateEmail/:userId", isSelf, updateEmail);
router.patch(
  "/updateProfileImage/:userId",
  isSelf,
  handleMulterError(upload, "profileImage"),
  updateProfileImage
);
router.patch("/addPhoneNumber/:userId", isSelf, addPhoneNumber);
router.patch("/deletePhoneNumber/:userId", isSelf, deletePhoneNumber);
router.delete("/deactivateUser/:userId", isSelf, deactivateUser);

module.exports = router;
