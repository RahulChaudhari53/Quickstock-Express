// validators/purchaseValidator.js
const Joi = require("joi");
const { objectIdExtension } = require("../../middlewares/validateRequest");

const purchaseItemSchema = Joi.object({
  product: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Product must be a valid product ID.",
    "any.required": "Product ID is required for each purchase item.",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number.",
    "number.min": "Quantity must be at least 1.",
    "number.integer": "Quantity must be an integer.",
    "any.required": "Quantity is required for each purchase item.",
  }),
  unitCost: Joi.number().min(0).precision(2).required().messages({
    // Added .precision(2)
    "number.base": "Unit cost must be a number.",
    "number.min": "Unit cost must be at least 0.",
    "number.precision": "Unit cost can have at most 2 decimal places.",
    "any.required": "Unit cost is required for each purchase item.",
  }),
  // totalCost is expected by your model's pre-save hook in sum, but it should be calculated
  // either by the client or internally if it's not being provided.
  // Given your model, it should be provided by the client, or the pre-save hook needs to calculate it.
  // For now, validator expects it as optional if model sums what's there.
  totalCost: Joi.number().min(0).precision(2).optional().messages({
    // Added totalCost as optional input
    "number.base": "Total cost must be a number.",
    "number.min": "Total cost must be at least 0.",
    "number.precision": "Total cost can have at most 2 decimal places.",
  }),
});

const createPurchaseSchema = Joi.object({
  purchaseNumber: Joi.string()
    .trim()
    .min(3)
    .max(20)
    .uppercase()
    .optional() // Optional, as model auto-generates if not provided
    .messages({
      "string.min": "Purchase number must be at least 3 characters long.",
      "string.max": "Purchase number cannot exceed 20 characters.",
      "string.uppercase": "Purchase number must be in uppercase.",
    }),
  supplier: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Supplier must be a valid supplier ID.",
    "any.required": "Supplier is required for a purchase.",
  }),
  items: Joi.array().items(purchaseItemSchema).min(1).required().messages({
    "array.base": "Items must be an array.",
    "array.min": "At least one item is required for a purchase.",
    "any.required": "Purchase items are required.",
  }),
  paymentMethod: Joi.string()
    .valid("cash", "online") // Adhering to your model's enum for paymentMethod
    .default("cash")
    .required() // Model has required: true
    .messages({
      "any.only":
        "Invalid payment method provided. Must be 'cash' or 'online'.",
      "any.required": "Payment method is required.",
    }),
  purchaseStatus: Joi.string()
    .valid("ordered", "received", "cancelled") // Adhering to your model's enum for purchaseStatus
    .default("ordered")
    .optional(),
  orderDate: Joi.date().default(Date.now).optional().messages({
    "date.base": "Order date must be a valid date.",
  }),
  paymentTerms: Joi.number()
    .integer()
    .min(0)
    .max(365)
    .default(30)
    .optional()
    .messages({
      "number.min": "Payment terms must be at least 0 days.",
      "number.max": "Payment terms cannot exceed 365 days.",
      "number.integer": "Payment terms must be an integer.",
    }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters.",
  }),
});

// Schema for updating a purchase (PATCH)
const updatePurchaseSchema = Joi.object({
  purchaseNumber: Joi.string()
    .trim()
    .min(3)
    .max(20)
    .uppercase()
    .optional()
    .messages({
      "string.min": "Purchase number must be at least 3 characters long.",
      "string.max": "Purchase number cannot exceed 20 characters.",
      "string.uppercase": "Purchase number must be in uppercase.",
    }),
  supplier: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Supplier must be a valid supplier ID.",
  }),
  // IMPORTANT: Controller allows items to be in updateData,
  // but warns that stock is NOT automatically adjusted.
  // If you need strict control over item updates with stock,
  // this field should be removed here and a specific endpoint
  // for item modifications with transactional stock logic be created.
  items: Joi.array().items(purchaseItemSchema).min(1).optional().messages({
    "array.base": "Items must be an array.",
    "array.min": "At least one item is required if providing items.",
  }),
  paymentMethod: Joi.string()
    .valid("cash", "online") // Adhering to your model's enum
    .optional()
    .messages({
      "any.only":
        "Invalid payment method provided. Must be 'cash' or 'online'.",
    }),
  purchaseStatus: Joi.string()
    .valid("ordered", "cancelled") // Only allow 'ordered' or 'cancelled' status updates via this route
    .optional()
    .messages({
      "any.only":
        "Invalid purchase status provided. Use the /receive endpoint for receiving items.",
    }),
  orderDate: Joi.date().optional().messages({
    "date.base": "Order date must be a valid date.",
  }),
  paymentTerms: Joi.number().integer().min(0).max(365).optional().messages({
    "number.min": "Payment terms must be at least 0 days.",
    "number.max": "Payment terms cannot exceed 365 days.",
    "number.integer": "Payment terms must be an integer.",
  }),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters.",
  }),
  // totalAmount is calculated by the model. Do not include in update schema from client.
  // totalAmount: Joi.number().min(0).precision(2).optional(),
}).min(1); // At least one field is required for an update operation

// Schema for purchase query parameters (for getAllPurchases)
const purchaseQuerySchema = Joi.object({
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
  sortBy: Joi.string().default("orderDate").optional().messages({
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
    // For general search (e.g., purchase number)
    "string.base": "Search must be a string.",
  }),
  supplier: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Supplier filter must be a valid supplier ID.",
  }),
  purchaseStatus: Joi.string()
    .valid("ordered", "received", "cancelled")
    .optional()
    .messages({
      // Adhering to model's enum
      "any.only": "Invalid purchase status filter provided.",
    }),
  // paymentStatus, startDate, endDate are not included as they are not in the provided model.
  // startDate: Joi.date().iso().optional(), // Removed due to model limitation
  // endDate: Joi.date().iso().optional(),   // Removed due to model limitation
}).unknown(false); // Set to false to strictly disallow unknown query parameters

module.exports = {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseQuerySchema,
};
