// controllers/supplierController.js

const Supplier = require("../models/Supplier");
const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /api/suppliers - Create a new supplier
const createSupplier = async (req, res, next) => {
  try {
    const supplierData = req.body;
    const authenticatedUserId = req.user._id;

    if (supplierData.email) {
      const existingEmail = await Supplier.findOne({
        email: supplierData.email,
        createdBy: authenticatedUserId,
      });

      if (existingEmail) {
        return errorResponse(
          res,
          "Supplier with this email already exists.",
          409
        );
      }
    }
    if (supplierData.phone) {
      const existingPhone = await Supplier.findOne({
        phone: supplierData.phone,
        createdBy: authenticatedUserId,
      });
      if (existingPhone) {
        return errorResponse(
          res,
          "Supplier with this phone number already exists.",
          409
        );
      }
    }

    const newSupplier = new Supplier({
      ...supplierData,
      createdBy: authenticatedUserId,
    });

    const savedSupplier = await newSupplier.save();

    return successResponse(
      res,
      "Supplier created successfully.",
      savedSupplier,
      201
    );
  } catch (err) {
    console.error("Create supplier error:", err);
    next(err);
  }
};

// GET /api/suppliers - Get all suppliers with pagination and filtering
const getAllSuppliers = async (req, res, next) => {
  try {
    const authenticatedUserId = req.user._id;

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      isActive,
    } = req.query;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { createdBy: authenticatedUserId };
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    }

    const [suppliers, totalItems] = await Promise.all([
      Supplier.find(filter).sort(sort).skip(skip).limit(parsedLimit).lean(),
      Supplier.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / parsedLimit);

    const responsePayload = {
      data: suppliers,
      pagination: {
        currentPage: parsedPage,
        limit: parsedLimit,
        totalItems,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1,
      },
    };

    return successResponse(
      res,
      "Suppliers retrieved successfully.",
      responsePayload
    );
  } catch (err) {
    console.error("Get all suppliers error:", err);
    next(err);
  }
};

// GET /api/suppliers/supplier/:supplierId - Get a single supplier by ID
const getSupplierById = async (req, res, next) => {
  const { supplierId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const supplier = await Supplier.findOne({
      _id: supplierId,
      createdBy: authenticatedUserId,
    }).lean();

    if (!supplier) {
      return errorResponse(res, "Supplier not found.", 404);
    }

    return successResponse(res, "Supplier retrieved successfully.", supplier);
  } catch (err) {
    console.error("Get supplier by ID error:", err);
    next(err);
  }
};

const updateSupplier = async (req, res, next) => {
  const { supplierId } = req.params;
  const updateData = req.body;
  const authenticatedUserId = req.user._id;

  try {
    const existingSupplier = await Supplier.findOne({
      _id: supplierId,
      createdBy: authenticatedUserId,
    });
    if (!existingSupplier) {
      return errorResponse(res, "Supplier not found.", 404);
    }

    // Check if data is actually changed
    const isSameData =
      (!updateData.name || updateData.name === existingSupplier.name) &&
      (!updateData.email || updateData.email === existingSupplier.email) &&
      (!updateData.phone || updateData.phone === existingSupplier.phone) &&
      (!updateData.notes || updateData.notes === existingSupplier.notes);

    if (isSameData) {
      return successResponse(res, "No changes detected.", existingSupplier);
    }

    if (updateData.email) {
      const duplicateEmail = await Supplier.findOne({
        email: updateData.email,
        createdBy: authenticatedUserId,
        _id: { $ne: supplierId },
      });
      if (duplicateEmail) {
        return errorResponse(
          res,
          "You already have a supplier with this email.",
          409
        );
      }
    }
    if (updateData.phone) {
      const duplicatePhone = await Supplier.findOne({
        phone: updateData.phone,
        createdBy: authenticatedUserId,
        _id: { $ne: supplierId },
      });
      if (duplicatePhone) {
        return errorResponse(
          res,
          "You already have a supplier with this phone number.",
          409
        );
      }
    }

    const updatedSupplier = await Supplier.findOneAndUpdate(
      { _id: supplierId, createdBy: authenticatedUserId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedSupplier) {
      return errorResponse(
        res,
        "Supplier not found or you lack permission.",
        404
      );
    }

    return successResponse(
      res,
      "Supplier updated successfully.",
      updatedSupplier
    );
  } catch (err) {
    console.error("Update supplier error:", err);
    next(err);
  }
};

const deactivateSupplier = async (req, res, next) => {
  const { supplierId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const supplier = await Supplier.findOne({
      _id: supplierId,
      createdBy: authenticatedUserId,
    });

    if (!supplier) {
      return errorResponse(res, "Supplier not found.", 404);
    }

    if (!supplier.isActive) {
      return errorResponse(res, "Supplier is already inactive.", 400);
    }

    supplier.isActive = false;
    await supplier.save();

    return successResponse(res, "Supplier deactivated successfully.", supplier);
  } catch (err) {
    console.error("Deactivate supplier error:", err);
    next(err);
  }
};

const activateSupplier = async (req, res, next) => {
  const { supplierId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const supplier = await Supplier.findOne({
      _id: supplierId,
      createdBy: authenticatedUserId,
    });

    if (!supplier) {
      return errorResponse(res, "Supplier not found.", 404);
    }

    if (supplier.isActive) {
      return errorResponse(res, "Supplier is already active.", 400);
    }

    supplier.isActive = true;
    await supplier.save();

    return successResponse(res, "Supplier activated successfully.", supplier);
  } catch (err) {
    console.error("Activate supplier error:", err);
    next(err);
  }
};

module.exports = {
  createSupplier,
  getAllSuppliers,
  getSupplierById,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
};
