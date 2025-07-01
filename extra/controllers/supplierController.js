// controllers/supplierController.js

const Supplier = require("../../models/Supplier");
const {
  successResponse,
  errorResponse,
  notFoundResource, // Corrected from notFoundResponse
  paginatedResponse,
} = require("../../utils/responseHandler");

// POST /api/suppliers - Create a new supplier
const createSupplier = async (req, res, next) => {
  // Added 'next'
  // Authorization (isShopOwner) and input validation (createSupplierSchema) are handled by middleware.
  try {
    const supplierData = req.body;
    const authenticatedUserId = req.user._id; // Use req.user._id for consistency

    // Check if supplier with same email already exists
    if (supplierData.email) {
      const existingEmail = await Supplier.findOne({
        email: supplierData.email,
      });
      if (existingEmail) {
        return errorResponse(
          res,
          "Supplier with this email already exists.",
          409
        ); // 409 Conflict
      }
    }
    // Check if supplier with same phone already exists
    if (supplierData.phone) {
      const existingPhone = await Supplier.findOne({
        phone: supplierData.phone,
      });
      if (existingPhone) {
        return errorResponse(
          res,
          "Supplier with this phone number already exists.",
          409 // 409 Conflict
        );
      }
    }

    // Create new supplier
    const newSupplier = new Supplier({
      ...supplierData,
      createdBy: authenticatedUserId, // Assign the authenticated user as the creator
      isActive: true, // New suppliers are active by default (assuming model default)
    });

    // Save supplier to database
    const savedSupplier = await newSupplier.save();

    return successResponse(
      res,
      "Supplier created successfully.",
      savedSupplier,
      201
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Create supplier error:", err);
    next(err); // Delegate to global error handler
  }
};

// GET /api/suppliers - Get all suppliers with pagination and filtering
const getAllSuppliers = async (req, res, next) => {
  // Added 'next'
  // Authorization (isShopOwner) and query validation (supplierQuerySchema) are handled by middleware.
  try {
    const { page, limit, sortBy, sortOrder, search, isActive, city, state } =
      req.query;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const skip = (parsedPage - 1) * parsedLimit;

    // Build filter object
    const filter = {};

    // Add search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search
      filter.$or = [
        { name: searchRegex },
        { contactPerson: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    // Add active status filter if provided
    if (isActive !== undefined) {
      filter.isActive = isActive === "true"; // Convert string to boolean
    }

    // Add city filter if provided
    if (city) {
      filter["address.city"] = { $regex: city, $options: "i" };
    }

    // Add state filter if provided
    if (state) {
      filter["address.state"] = { $regex: state, $options: "i" };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute queries
    const [suppliers, totalItems] = await Promise.all([
      Supplier.find(filter).sort(sort).skip(skip).limit(parsedLimit).lean(), // Use .lean() for read operations
      Supplier.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    const pagination = {
      page: parsedPage,
      limit: parsedLimit,
      totalItems,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };

    return paginatedResponse(
      res,
      "Suppliers retrieved successfully.",
      suppliers,
      pagination
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Get all suppliers error:", err);
    next(err); // Delegate to global error handler
  }
};

// GET /api/suppliers/:id - Get a single supplier by ID
const getSupplierById = async (req, res, next) => {
  // Added 'next'
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const { id } = req.params;

  try {
    // Find supplier by ID
    const supplier = await Supplier.findById(id).lean(); // Use .lean()

    if (!supplier) {
      return notFoundResource(res, "Supplier"); // Corrected helper
    }

    return successResponse(res, "Supplier retrieved successfully.", supplier);
  } catch (err) {
    // Consistent 'err' variable
    console.error("Get supplier by ID error:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/suppliers/:id - Update a supplier by ID (using PATCH for partial updates)
const updateSupplier = async (req, res, next) => {
  // Added 'next'
  // Authorization (isShopOwner) and validation (updateSupplierSchema) are handled by middleware.
  const { id } = req.params;
  const updateData = req.body;

  try {
    // Check if supplier exists
    const existingSupplier = await Supplier.findById(id);
    if (!existingSupplier) {
      return notFoundResource(res, "Supplier");
    }

    // If email is being updated, check for duplicates (excluding the current supplier)
    if (updateData.email && updateData.email !== existingSupplier.email) {
      const duplicateEmail = await Supplier.findOne({
        email: updateData.email,
        _id: { $ne: id }, // Exclude the current supplier
      });
      if (duplicateEmail) {
        return errorResponse(
          res,
          "Supplier with this email already exists.",
          409 // 409 Conflict
        );
      }
    }

    // If phone is being updated, check for duplicates (excluding the current supplier)
    if (updateData.phone && updateData.phone !== existingSupplier.phone) {
      const duplicatePhone = await Supplier.findOne({
        phone: updateData.phone,
        _id: { $ne: id }, // Exclude the current supplier
      });
      if (duplicatePhone) {
        return errorResponse(
          res,
          "Supplier with this phone number already exists.",
          409 // 409 Conflict
        );
      }
    }

    // Update supplier
    const updatedSupplier = await Supplier.findByIdAndUpdate(id, updateData, {
      new: true, // Return the modified document
      runValidators: true, // Run Mongoose schema validators on the update
    });

    return successResponse(
      res,
      "Supplier updated successfully.",
      updatedSupplier
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Update supplier error:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/suppliers/:id/deactivate - Deactivate a supplier by ID (soft delete)
const deactivateSupplier = async (req, res, next) => {
  // Renamed from deleteSupplier, Added 'next'
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const { id } = req.params;

  try {
    // Check if supplier exists
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return notFoundResource(res, "Supplier");
    }

    // Check if supplier is already inactive
    if (!supplier.isActive) {
      return errorResponse(res, "Supplier is already inactive.", 400);
    }

    // Soft delete by setting isActive to false
    const updatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    return successResponse(
      res,
      "Supplier deactivated successfully.",
      updatedSupplier
    );
  } catch (err) {
    // Consistent 'err' variable
    console.error("Deactivate supplier error:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/suppliers/:id/activate - Activate a supplier by ID
const activateSupplier = async (req, res, next) => {
  // New function, Added 'next'
  // Authorization (isShopOwner) and ID validation handled by middleware.
  const { id } = req.params;

  try {
    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return notFoundResource(res, "Supplier");
    }

    // Check if supplier is already active
    if (supplier.isActive) {
      return errorResponse(res, "Supplier is already active.", 400);
    }

    const activatedSupplier = await Supplier.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true, runValidators: true }
    );

    return successResponse(
      res,
      "Supplier activated successfully.",
      activatedSupplier
    );
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
  deactivateSupplier, // Export renamed function
  activateSupplier, // Export new function
};
