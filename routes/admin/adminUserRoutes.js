// routes/admin
const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getUserById,
  makeAdmin,
} = require("../../controllers/admin/adminUserController");

const {
  authenticateUser,
  isAdmin,
} = require("../../middlewares/authenticateUser");

router.use(authenticateUser, isAdmin);

router.get("/users", getAllUsers);
router.get("/users/:id", getUserById);
router.patch("/users/:id/make-admin", makeAdmin);

module.exports = router;
