const Joi = require("joi");
const { objectIdExtension } = require("../../middlewares/validateRequest"); // Assuming objectIdExtension is defined here

// Schema for common pagination and sorting queries
const paginationAndSortSchema = Joi.object({
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
  sortBy: Joi.string().optional().messages({
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
});

// Schema for GET /api/stock - Get all stock levels
const stockQuerySchema = paginationAndSortSchema
  .keys({
    search: Joi.string().trim().optional().messages({
      "string.base": "Search query must be a string.",
      "string.empty": "Search query cannot be empty.",
    }),
    lowStockThreshold: Joi.number().integer().min(0).optional().messages({
      "number.base": "Low stock threshold must be a number.",
      "number.integer": "Low stock threshold must be an integer.",
      "number.min": "Low stock threshold cannot be negative.",
    }),
  })
  .unknown(false); // Disallow unknown query parameters

// Schema for GET /api/stock/history/:productId - Get stock movement history
// This schema only includes pagination as productId is validated as a param
const stockMovementQuerySchema = paginationAndSortSchema
  .keys({
    // No additional fields specific to movement history queries,
    // as productId is a route parameter and will be validated by objectIdSchema.
  })
  .unknown(false); // Disallow unknown query parameters

module.exports = {
  stockQuerySchema,
  stockMovementQuerySchema,
};
