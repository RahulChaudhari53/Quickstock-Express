const express = require("express");
const router = express.Router();

const {
  getAllUsers,
  getCurrentUser,
  createUser,
  updateUserInfo,
  updatePassword,
  updateEmail,
  addPhoneNumber,
  removePhoneNumber,
  deleteUser,
} = require("../controllers/userController");

router.get("/", getAllUsers);
router.get("/:id", getCurrentUser);
router.post("/", createUser);
router.patch("/:id/info", updateUserInfo);
router.patch("/:id/password", updatePassword);
router.patch("/:id/email", updateEmail);
router.patch("/:id/addPhoneNumber", addPhoneNumber);
router.patch("/:id/removePhoneNumber", removePhoneNumber);
router.delete("/:id", deleteUser);

module.exports = router;
