// controllers/categoryController.js
const Category = require("../../models/Category");
const {
  successResponse,
  errorResponse,
  notFoundResource,
  paginatedResponse,
} = require("../../utils/responseHandler");

// POST /api/categories - Create a new category
const createCategory = async (req, res, next) => {
  const { name, description, isActive } = req.body;
  const authenticatedUserId = req.user._id;

  try {
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
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
  const { page, limit, sortBy, sortOrder, search, isActive } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  if (isActive !== undefined) {
    filter.isActive = isActive === "true";
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  try {
    const [categories, totalItems] = await Promise.all([
      Category.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      Category.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      totalItems,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };

    return paginatedResponse(
      res,
      "Categories retrieved successfully.",
      categories,
      pagination
    );
  } catch (err) {
    console.error("Get all categories error:", err);
    next(err);
  }
};

// GET /api/categories/:id - Get a single category by ID
const getCategoryById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const category = await Category.findById(id).lean();

    if (!category) {
      return notFoundResource(res, "Category");
    }

    return successResponse(res, "Category retrieved successfully.", category);
  } catch (err) {
    console.error("Get category by ID error:", err);
    next(err);
  }
};

// PATCH /api/categories/:id - Update a category by ID
const updateCategory = async (req, res, next) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const existingCategory = await Category.findById(id);
    if (!existingCategory) {
      return notFoundResource(res, "Category");
    }

    if (updateData.name) {
      const duplicateCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${updateData.name}$`, "i") },
        _id: { $ne: id },
      });

      if (duplicateCategory) {
        return errorResponse(
          res,
          "Category with this name already exists.",
          409
        );
      }
    }

    const updatedCategory = await Category.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    return successResponse(
      res,
      "Category updated successfully.",
      updatedCategory
    );
  } catch (err) {
    console.error("Update category error:", err);
    next(err);
  }
};

// DELETE /api/categories/:id - Soft delete a category by ID
const deleteCategory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const category = await Category.findById(id);
    if (!category) {
      return notFoundResource(res, "Category");
    }

    await Category.findByIdAndUpdate(id, { isActive: false }, { new: true });

    return successResponse(res, "Category deactivated successfully.");
  } catch (err) {
    console.error("Delete category error:", err);
    next(err);
  }
};

// PATCH /api/categories/:id/activate - Reactivate a category
const activateCategory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const category = await Category.findById(id);
    if (!category) {
      return notFoundResource(res, "Category");
    }

    if (category.isActive) {
      return errorResponse(res, "Category is already active.", 400);
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
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
  getCategoryById,
  updateCategory,
  deleteCategory,
  activateCategory,
};
