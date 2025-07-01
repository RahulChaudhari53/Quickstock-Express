const Joi = require("joi");
const { objectIdExtension } = require("../../middlewares/validateRequest"); // Assuming objectIdExtension is defined here

// Schema for supplier address
const addressSchema = Joi.object({
  street: Joi.string().trim().max(100).optional().messages({
    "string.base": "Street must be a string.",
    "string.max": "Street cannot exceed 100 characters.",
  }),
  city: Joi.string().trim().max(50).optional().messages({
    "string.base": "City must be a string.",
    "string.max": "City cannot exceed 50 characters.",
  }),
  state: Joi.string().trim().max(50).optional().messages({
    "string.base": "State must be a string.",
    "string.max": "State cannot exceed 50 characters.",
  }),
  zipCode: Joi.string()
    .trim()
    .pattern(/^\d{5}(-\d{4})?$/)
    .optional()
    .messages({
      "string.base": "Zip code must be a string.",
      "string.pattern":
        "Zip code must be a valid format (e.g., 12345 or 12345-6789).",
    }),
  country: Joi.string().trim().max(50).optional().messages({
    "string.base": "Country must be a string.",
    "string.max": "Country cannot exceed 50 characters.",
  }),
});

// Schema for creating a new supplier (POST /api/suppliers)
const createSupplierSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.base": "Supplier name must be a string.",
    "string.empty": "Supplier name cannot be empty.",
    "string.min": "Supplier name must be at least 2 characters long.",
    "string.max": "Supplier name cannot exceed 100 characters.",
    "any.required": "Supplier name is required.",
  }),
  contactPerson: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "Contact person name must be a string.",
    "string.min": "Contact person name must be at least 2 characters long.",
    "string.max": "Contact person name cannot exceed 100 characters.",
  }),
  email: Joi.string().trim().email().required().messages({
    // Email is unique and required
    "string.base": "Email must be a string.",
    "string.empty": "Email cannot be empty.",
    "string.email": "Email must be a valid email address.",
    "any.required": "Email is required.",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?\d{7,15}$/)
    .required()
    .messages({
      // Phone is unique and required
      "string.base": "Phone number must be a string.",
      "string.empty": "Phone number cannot be empty.",
      "string.pattern":
        "Phone number must be between 7 and 15 digits, optionally starting with '+'.",
      "any.required": "Phone number is required.",
    }),
  address: addressSchema.optional(), // Address is optional for creation
  website: Joi.string().trim().uri().max(200).optional().messages({
    "string.base": "Website must be a string.",
    "string.uri": "Website must be a valid URL.",
    "string.max": "Website cannot exceed 200 characters.",
  }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string.",
    "string.max": "Notes cannot exceed 500 characters.",
  }),
  // isActive is typically defaulted by the model or controller, not sent by client on creation
  // createdBy is set by the controller using req.user._id
});

// Schema for updating an existing supplier (PATCH /api/suppliers/:id)
const updateSupplierSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "Supplier name must be a string.",
    "string.empty": "Supplier name cannot be empty.",
    "string.min": "Supplier name must be at least 2 characters long.",
    "string.max": "Supplier name cannot exceed 100 characters.",
  }),
  contactPerson: Joi.string().trim().min(2).max(100).optional().messages({
    "string.base": "Contact person name must be a string.",
    "string.min": "Contact person name must be at least 2 characters long.",
    "string.max": "Contact person name cannot exceed 100 characters.",
  }),
  email: Joi.string().trim().email().optional().messages({
    // Email can be updated, uniqueness checked in controller
    "string.base": "Email must be a string.",
    "string.empty": "Email cannot be empty.",
    "string.email": "Email must be a valid email address.",
  }),
  phone: Joi.string()
    .trim()
    .pattern(/^\+?\d{7,15}$/)
    .optional()
    .messages({
      // Phone can be updated, uniqueness checked in controller
      "string.base": "Phone number must be a string.",
      "string.empty": "Phone number cannot be empty.",
      "string.pattern":
        "Phone number must be between 7 and 15 digits, optionally starting with '+'.",
    }),
  address: addressSchema.optional(),
  website: Joi.string().trim().uri().max(200).optional().messages({
    "string.base": "Website must be a string.",
    "string.uri": "Website must be a valid URL.",
    "string.max": "Website cannot exceed 200 characters.",
  }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string.",
    "string.max": "Notes cannot exceed 500 characters.",
  }),
  isActive: Joi.boolean().optional().messages({
    // Allows changing active status (though separate routes are preferred)
    "boolean.base": "isActive must be a boolean.",
  }),
}).min(1); // At least one field is required for an update operation

// Schema for GET /api/suppliers - Get all suppliers with pagination and filtering
const supplierQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional().messages({
    "number.base": "Page must be a number.",
    "number.integer": "Page must be an integer.",
    "number.min": "Page must be at least 1.",
  }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .optional()
    .messages({
      "number.base": "Limit must be a number.",
      "number.integer": "Limit must be an integer.",
      "number.min": "Limit must be at least 1.",
      "number.max": "Limit cannot exceed 100.",
    }),
  sortBy: Joi.string().default("createdAt").optional().messages({
    // Default handled in controller
    "string.base": "SortBy must be a string.",
  }),
  sortOrder: Joi.string()
    .valid("asc", "desc")
    .default("desc")
    .optional()
    .messages({
      "any.only": "SortOrder must be 'asc' or 'desc'.",
    }),
  search: Joi.string().trim().optional().messages({
    // For searching by name, contactPerson, email, phone
    "string.base": "Search query must be a string.",
  }),
  isActive: Joi.boolean().optional().messages({
    // Filter by active status
    "boolean.base": "isActive filter must be a boolean (true/false).",
  }),
  city: Joi.string().trim().optional().messages({
    // Filter by address.city
    "string.base": "City filter must be a string.",
  }),
  state: Joi.string().trim().optional().messages({
    // Filter by address.state
    "string.base": "State filter must be a string.",
  }),
}).unknown(false); // Disallow unknown query parameters

module.exports = {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
};
