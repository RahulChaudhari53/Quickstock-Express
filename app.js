// app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

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

module.exports = app;
