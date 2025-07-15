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
  isSelf,
} = require("../middlewares/authenticateUser");

// Public routes
router.post("/signup", registerUser);
router.post("/login", loginUser);

// Protected routes
router.use(authenticateUser);

router.get("/me", getCurrentUser);

router.use(isSelf, isOwner);
router.patch("/updateUserInfo/:userId", updateUserInfo);
router.patch("/updatePassword/:userId", updatePassword);
router.patch("/updateEmail/:userId", updateEmail);
router.patch(
  "/updateProfileImage/:userId",
  upload.single("profileImage"),
  updateProfileImage
);
router.patch("/addPhoneNumber/:userId", addPhoneNumber);
router.patch("/deletePhoneNumber/:userId", deletePhoneNumber);
router.delete("/deactivateUser/:userId", deactivateUser);

module.exports = router;
