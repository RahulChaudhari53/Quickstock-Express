// controllers/customerController.js

const Customer = require("../../models/Customer");
const {
  successResponse,
  errorResponse,
  notFoundResource, // Corrected import from notFoundResponse
  paginatedResponse,
  forbiddenResponse, // Useful for general authorization messages
} = require("../../utils/responseHandler");

// POST /api/customers - Create a new customer
const createCustomer = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Input validation is handled by validateRequest middleware using createCustomerSchema
  const customerData = req.body;
  const authenticatedUserId = req.user._id; // User ID from authenticated JWT

  try {
    // Specific duplicate checks for clearer messages (Mongoose unique index also handles this via global error handler)
    if (customerData.email) {
      const existingEmail = await Customer.findOne({
        email: customerData.email,
      });
      if (existingEmail) {
        return errorResponse(
          res,
          "Customer with this email already exists.",
          409
        ); // 409 Conflict
      }
    }

    // Phone is required, so this check is always relevant
    const existingPhone = await Customer.findOne({
      phone: customerData.phone,
    });
    if (existingPhone) {
      return errorResponse(
        res,
        "Customer with this phone number already exists.",
        409
      ); // 409 Conflict
    }

    const newCustomer = new Customer({
      ...customerData, // Joi already ensured valid data structure here
      createdBy: authenticatedUserId, // Assign the authenticated user as the creator
      isActive: true, // New customers are active by default as per model
    });

    const savedCustomer = await newCustomer.save();

    return successResponse(
      res,
      "Customer created successfully.",
      savedCustomer,
      201
    );
  } catch (err) {
    console.error("Create customer error:", err); // Use 'err' consistently
    next(err); // Delegate to global error handler
  }
};

// GET /api/customers - Get all customers with pagination and filtering
const getAllCustomers = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Query parameters are validated by validateRequest middleware
  const { page, limit, sortBy, sortOrder, search, isActive } = req.query;

  const filter = {};

  if (search) {
    const searchRegex = new RegExp(search, "i"); // Case-insensitive search
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  // Ensure isActive filter is correctly parsed
  if (isActive !== undefined) {
    filter.isActive = isActive === "true"; // Convert string to boolean
  }

  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  try {
    const [customers, totalItems] = await Promise.all([
      Customer.find(filter).sort(sort).skip(skip).limit(parsedLimit).lean(), // Convert Mongoose documents to plain JavaScript objects
      Customer.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalItems / parsedLimit);
    const hasNextPage = parsedPage < totalPages; // Corrected pagination logic
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
      "Customers retrieved successfully.",
      customers,
      pagination
    );
  } catch (err) {
    // Use 'err' consistently
    console.error("Get all customers error:", err);
    next(err); // Delegate to global error handler
  }
};

// GET /api/customers/:id - Get a single customer by ID
const getCustomerById = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Validation for customerId is handled by validateRequest(commonSchemas.objectId, 'params')
  const { id } = req.params; // Use 'id' as per commonSchemas.objectId

  try {
    const customer = await Customer.findById(id).lean();

    if (!customer) {
      return notFoundResource(res, "Customer"); // Use specific notFoundResource helper
    }

    return successResponse(res, "Customer retrieved successfully.", customer);
  } catch (err) {
    // Use 'err' consistently
    console.error("Get customer by ID error:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/customers/:id - Update a customer by ID
const updateCustomer = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Validation for customerId in params and updateData in body is handled by validateRequest middleware
  const { id } = req.params;
  const updateData = req.body; // Joi validated this
  const authenticatedUserId = req.user._id; // For potential future auditing of who updated

  try {
    const existingCustomer = await Customer.findById(id);
    if (!existingCustomer) {
      return notFoundResource(res, "Customer");
    }

    // If email is being updated, check for duplicates (excluding the current customer)
    if (updateData.email) {
      const duplicateEmailCustomer = await Customer.findOne({
        email: updateData.email,
        _id: { $ne: id }, // Exclude the current customer
      });
      if (duplicateEmailCustomer) {
        return errorResponse(
          res,
          "Customer with this email already exists.",
          409
        );
      }
    }

    // If phone is being updated, check for duplicates (excluding the current customer)
    if (updateData.phone) {
      const duplicatePhoneCustomer = await Customer.findOne({
        phone: updateData.phone,
        _id: { $ne: id }, // Exclude the current customer
      });
      if (duplicatePhoneCustomer) {
        return errorResponse(
          res,
          "Customer with this phone number already exists.",
          409
        );
      }
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { ...updateData, updatedBy: authenticatedUserId }, // Optionally add who updated
      { new: true, runValidators: true } // Return the updated document, run Mongoose validators
    );

    return successResponse(
      res,
      "Customer updated successfully.",
      updatedCustomer
    );
  } catch (err) {
    // Use 'err' consistently
    console.error("Update customer error:", err);
    next(err); // Delegate to global error handler
  }
};

// DELETE /api/customers/:id - Soft delete a customer by ID
const deleteCustomer = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  const { id } = req.params; // Use 'id' as per commonSchemas.objectId

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return notFoundResource(res, "Customer");
    }

    // Check if customer is already inactive
    if (!customer.isActive) {
      return errorResponse(res, "Customer is already inactive.", 400);
    }

    // Soft delete: Set isActive to false
    await Customer.findByIdAndUpdate(id, { isActive: false }, { new: true });

    return successResponse(res, "Customer deactivated successfully.");
  } catch (err) {
    // Use 'err' consistently
    console.error("Delete customer error:", err);
    next(err); // Delegate to global error handler
  }
};

// PATCH /api/customers/:id/activate - Reactivate a customer
const activateCustomer = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    if (!customer) {
      return notFoundResource(res, "Customer");
    }

    // Check if customer is already active
    if (customer.isActive) {
      return errorResponse(res, "Customer is already active.", 400);
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true, runValidators: true }
    );

    return successResponse(
      res,
      "Customer activated successfully.",
      updatedCustomer
    );
  } catch (err) {
    console.error("Activate customer error:", err);
    next(err);
  }
};

module.exports = {
  createCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer, // Export the new update function
  deleteCustomer,
  activateCustomer, // Export the new activate function
};
