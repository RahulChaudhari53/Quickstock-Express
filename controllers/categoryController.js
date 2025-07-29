// controllers/categoryController.js
const mongoose = require("mongoose");
const Category = require("../models/Category");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /api/categories/create - Create a new category
const createCategory = async (req, res, next) => {
  const { name, description, isActive } = req.body;
  const authenticatedUserId = req.user._id;

  try {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      createdBy: authenticatedUserId,
    });

    if (existingCategory) {
      return errorResponse(res, "Category with this name already exists.", 409);
    }

    const newCategory = new Category({
      name,
      description,
      isActive,
      createdBy: authenticatedUserId,
    });

    const savedCategory = await newCategory.save();

    return successResponse(
      res,
      "Category created successfully.",
      savedCategory,
      201
    );
  } catch (err) {
    next(err);
  }
};

// GET /api/categories - Get all categories with pagination and filtering
const getAllCategories = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const { search, nameExact, isActive } = req.query;

    const filter = { createdBy: authenticatedUserId };

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (nameExact) {
      filter.name = { $regex: `^${nameExact}$`, $options: "i" };
    }

    const skip = (page - 1) * limit;

    const [categories, totalItems] = await Promise.all([
      Category.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    return successResponse(res, "Categories retrieved successfully.", {
      categories,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        limit,
        hasNextPage: page * limit < totalItems,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Get all categories error:", err);
    next(err);
  }
};

// GET /api/categories/category/:categoryId - Get a single category by ID
const getCategoryById = async (req, res, next) => {
  const { categoryId } = req.params;
  const authenticatedUserId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return errorResponse(res, "Invalid category ID format.", 400);
  }

  try {
    const category = await Category.findOne({
      _id: categoryId,
      createdBy: authenticatedUserId,
    }).lean();

    if (!category) {
      return errorResponse(res, "Category not found.", 404);
    }

    return successResponse(res, "Category retrieved successfully.", category);
  } catch (err) {
    console.error("Get category by ID error:", err);
    next(err);
  }
};

// DELETE /api/categories/category/deactivate:categoryId - Soft delete a category by ID
const deleteCategory = async (req, res, next) => {
  const { categoryId } = req.params;
  const authenticatedUserId = req.user._id;
  console.log("Starting deactivate process");
  console.log(`For category Id: ${categoryId}`);

  try {
    const category = await Category.findOne({
      _id: categoryId,
      createdBy: authenticatedUserId,
    });

    if (!category) {
      return errorResponse(res, "Category not found.", 404);
    }

    await Category.findOneAndUpdate(
      { _id: categoryId, createdBy: authenticatedUserId, isActive: true },
      { isActive: false },
      { new: true }
    );

    return successResponse(res, "Category deactivated successfully.");
  } catch (err) {
    console.error("Delete category error:", err);
    next(err);
  }
};

// PATCH /api/categories/category/activate/:categoryId - Reactivate a category
const activateCategory = async (req, res, next) => {
  const { categoryId } = req.params;
  const authenticatedUserId = req.user._id;
  console.error("Starting re-activate process");
  console.log(`For category Id: ${categoryId}`);

  try {
    const category = await Category.findOne({
      _id: categoryId,
      createdBy: authenticatedUserId,
    });

    if (!category) {
      return errorResponse(res, "Category not found.", 404);
    }

    if (category.isActive) {
      return errorResponse(res, "Category is already active.", 400);
    }

    const updatedCategory = await Category.findOneAndUpdate(
      { _id: categoryId, createdBy: authenticatedUserId },
      { isActive: true },
      { new: true, runValidators: true }
    );

    return successResponse(
      res,
      "Category activated successfully.",
      updatedCategory
    );
  } catch (err) {
    console.error("Activate category error:", err);
    next(err);
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById, // not usin
  deleteCategory,
  activateCategory,
};

// will add get all products of that category
