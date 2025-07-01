const Joi = require("joi");
const { objectIdExtension } = require("../../middlewares/validateRequest");

// Schema for individual items within a sale
const saleItemSchema = Joi.object({
  product: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Product must be a valid product ID.",
    "any.required": "Product ID is required for each sale item.",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number.",
    "number.min": "Quantity must be at least 1.",
    "number.integer": "Quantity must be an integer.",
    "any.required": "Quantity is required for each sale item.",
  }),
  unitPrice: Joi.number().min(0).precision(2).required().messages({
    "number.base": "Unit price must be a number.",
    "number.min": "Unit price must be at least 0.",
    "number.precision": "Unit price can have at most 2 decimal places.",
    "any.required": "Unit price is required for each sale item.",
  }),
  // totalPrice is typically calculated server-side or by the client.
  // It's included here as optional if the client might send it, but the model's pre-save
  // or controller should ensure the overall totalAmount is correct.
  totalPrice: Joi.number().min(0).precision(2).optional().messages({
    "number.base": "Total price for item must be a number.",
    "number.min": "Total price for item must be at least 0.",
    "number.precision": "Total price can have at most 2 decimal places.",
  }),
});

// Schema for creating a new sale (POST /api/sales)
const createSaleSchema = Joi.object({
  invoiceNumber: Joi.string()
    .trim()
    .min(3)
    .max(20)
    .uppercase()
    .required() // Invoice number is explicitly checked for uniqueness in controller
    .messages({
      "string.base": "Invoice number must be a string.",
      "string.empty": "Invoice number cannot be empty.",
      "string.min": "Invoice number must be at least 3 characters long.",
      "string.max": "Invoice number cannot exceed 20 characters.",
      "string.uppercase": "Invoice number must be in uppercase.",
      "any.required": "Invoice number is required.",
    }),
  customer: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Customer must be a valid customer ID.",
    "any.required": "Customer is required for a sale.",
  }),
  items: Joi.array().items(saleItemSchema).min(1).required().messages({
    "array.base": "Items must be an array.",
    "array.min": "At least one item is required for a sale.",
    "any.required": "Sale items are required.",
  }),
  paymentMethod: Joi.string()
    .valid("cash", "online") // Assuming these are the valid payment methods
    .default("cash")
    .required() // Model implies this is required
    .messages({
      "any.only":
        "Invalid payment method provided. Must be 'cash' or 'online'.",
      "any.required": "Payment method is required.",
    }),
  saleStatus: Joi.string()
    .valid("pending", "completed", "cancelled") // Based on common sale statuses
    .default("pending")
    .optional()
    .messages({
      "any.only":
        "Invalid sale status provided. Must be 'pending', 'completed', or 'cancelled'.",
    }),
  paymentStatus: Joi.string()
    .valid("paid", "pending", "partially_paid", "refunded") // Based on common payment statuses
    .default("pending")
    .optional()
    .messages({
      "any.only":
        "Invalid payment status provided. Must be 'paid', 'pending', 'partially_paid', or 'refunded'.",
    }),
  saleDate: Joi.date().default(Date.now).optional().messages({
    "date.base": "Sale date must be a valid date.",
  }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string.",
    "string.max": "Notes cannot exceed 500 characters.",
  }),
  // totalAmount is calculated by the model's pre-save hook. It should not be sent by the client.
  // totalAmount: Joi.number().min(0).precision(2).optional(),
});

// Schema for updating an existing sale (PATCH /api/sales/:id)
const updateSaleSchema = Joi.object({
  invoiceNumber: Joi.string()
    .trim()
    .min(3)
    .max(20)
    .uppercase()
    .optional()
    .messages({
      "string.base": "Invoice number must be a string.",
      "string.empty": "Invoice number cannot be empty.",
      "string.min": "Invoice number must be at least 3 characters long.",
      "string.max": "Invoice number cannot exceed 20 characters.",
      "string.uppercase": "Invoice number must be in uppercase.",
    }),
  customer: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Customer must be a valid customer ID.",
  }),
  // IMPORTANT: The controller limits item updates on 'completed' sales.
  // If items are modified for non-completed sales, ensure your business logic
  // and possibly additional transactional stock adjustments are handled.
  items: Joi.array().items(saleItemSchema).min(1).optional().messages({
    "array.base": "Items must be an array.",
    "array.min": "At least one item is required if providing items.",
  }),
  paymentMethod: Joi.string().valid("cash", "online").optional().messages({
    "any.only": "Invalid payment method provided. Must be 'cash' or 'online'.",
  }),
  saleStatus: Joi.string()
    .valid("pending", "completed", "cancelled")
    .optional()
    .messages({
      "any.only":
        "Invalid sale status provided. Must be 'pending', 'completed', or 'cancelled'.",
    }),
  paymentStatus: Joi.string()
    .valid("paid", "pending", "partially_paid", "refunded")
    .optional()
    .messages({
      "any.only":
        "Invalid payment status provided. Must be 'paid', 'pending', 'partially_paid', or 'refunded'.",
    }),
  saleDate: Joi.date().optional().messages({
    "date.base": "Sale date must be a valid date.",
  }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.base": "Notes must be a string.",
    "string.max": "Notes cannot exceed 500 characters.",
  }),
}).min(1); // At least one field is required for an update operation

// Schema for validating query parameters (GET /api/sales)
const saleQuerySchema = Joi.object({
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
  sortBy: Joi.string().default("saleDate").optional().messages({
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
    // For searching by invoice number
    "string.base": "Search query must be a string.",
  }),
  customer: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Customer filter must be a valid customer ID.",
  }),
  saleStatus: Joi.string()
    .valid("pending", "completed", "cancelled")
    .optional()
    .messages({
      "any.only": "Invalid sale status filter provided.",
    }),
  paymentStatus: Joi.string()
    .valid("paid", "pending", "partially_paid", "refunded")
    .optional()
    .messages({
      "any.only": "Invalid payment status filter provided.",
    }),
  paymentMethod: Joi.string().valid("cash", "online").optional().messages({
    "any.only": "Invalid payment method filter provided.",
  }),
  startDate: Joi.date().iso().optional().messages({
    // ISO format for date strings
    "date.base": "Start date must be a valid date.",
    "date.iso": "Start date must be in ISO format (YYYY-MM-DD).",
  }),
  endDate: Joi.date().iso().optional().messages({
    // ISO format for date strings
    "date.base": "End date must be a valid date.",
    "date.iso": "End date must be in ISO format (YYYY-MM-DD).",
  }),
}).unknown(false); // Disallow unknown query parameters

module.exports = {
  createSaleSchema,
  updateSaleSchema,
  saleQuerySchema,
};
