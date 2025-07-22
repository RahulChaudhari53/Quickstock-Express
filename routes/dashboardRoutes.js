// dashboardRoutes.js
const express = require("express");
const router = express.Router();
const { getDashboardOverview } = require("../controllers/dashboardController");

const {
  authenticateUser,
  isOwner,
} = require("../middlewares/authenticateUser");

router.use(authenticateUser, isOwner);

router.get("/overview", getDashboardOverview);

module.exports = router;
