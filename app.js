// app.js
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

// API routes
app.use("/api/users", userRoutes);
app.use("/api/admin", adminUserRoutes);
// Mount other routes as you create them:
// app.use("/api/categories", categoryRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/suppliers", supplierRoutes);
// app.use("/api/customers", customerRoutes);
// app.use("/api/purchases", purchaseRoutes);
// app.use("/api/sales", saleRoutes);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.stack);

  if (err.name === "CastError" && err.kind === "ObjectId") {
    return errorResponse(res, "Invalid ID format.", 400);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue);
    const value = Object.values(err.keyValue);
    return errorResponse(
      res,
      `Duplicate field value: '${field}' - '${value}'. Please use another value.`,
      400
    );
  }

  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((el) => ({
      field: el.path,
      message: el.message,
      value: el.value,
    }));
    return errorResponse(res, "Validation failed.", 400, errors);
  }

  if (err.statusCode) {
    return errorResponse(res, err.message, err.statusCode);
  }

  return errorResponse(
    res,
    "Something went wrong! Please try again later.",
    500,
    err.message
  );
});

module.exports = app;
