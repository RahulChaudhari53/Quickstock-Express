require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { errorResponse } = require("./utils/responseHandler");

const userRoutes = require("./routes/userRoutes");
const adminUserRoutes = require("./routes/admin/adminUserRoutes");

const app = express();
connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  })
);

app.use("/uploads", express.static("uploads"));

app.use("/api/users", userRoutes);
app.use("/api/admin", adminUserRoutes);

app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);

  if (err.name === "CastError" && err.kind === "ObjectId") {
    return errorResponse(res, "Invalid ID format.", 400);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return errorResponse(
      res,
      `An account with this ${field} already exists.`,
      409
    );
  }
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    return errorResponse(res, message, 400);
  }
  return errorResponse(res);
});

module.exports = app;
