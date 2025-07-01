// validators/productValidator.js
const Joi = require("joi");
const { objectIdExtension } = require("../../middlewares/validateRequest");

// Define a common image validation schema for reuse
const imageSchema = Joi.object({
  fieldname: Joi.string().required(),
  originalname: Joi.string().required(),
  encoding: Joi.string().required(),
  mimetype: Joi.string()
    .valid("image/jpeg", "image/png", "image/gif", "image/webp") // Added webp for modern formats
    .required()
    .messages({
      "any.only": "Image must be a JPEG, PNG, GIF, or WEBP file.",
    }),
  size: Joi.number()
    .max(5 * 1024 * 1024) // 5MB max size
    .required()
    .messages({
      "number.max": "Image size cannot exceed 5MB.",
    }),
  filename: Joi.string().required(),
  path: Joi.string().required(),
  // Add other properties that Multer might attach if needed for validation
}).unknown(true); // Allow other properties Multer might add, like `destination` or `buffer`

// --- Create Product Schema ---
const createProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Product name is required.",
    "string.min": "Product name must be at least 2 characters long.",
    "string.max": "Product name cannot exceed 100 characters.",
    "any.required": "Product name is required.",
  }),
  sku: Joi.string().trim().min(3).max(20).uppercase().required().messages({
    "string.empty": "SKU is required.",
    "string.min": "SKU must be at least 3 characters long.",
    "string.max": "SKU cannot exceed 20 characters.",
    "string.uppercase": "SKU must be in uppercase.",
    "any.required": "SKU is required.",
  }),
  description: Joi.string().trim().max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters.",
  }),
  category: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Category must be a valid category ID.",
    "any.required": "Category is required.",
  }),
  supplier: objectIdExtension.objectId().required().messages({
    "objectId.invalid": "Supplier must be a valid supplier ID.",
    "any.required": "Supplier is required.",
  }),
  unit: Joi.string()
    .valid(
      "piece",
      "kg",
      "gram",
      "liter",
      "ml",
      "meter",
      "cm",
      "box",
      "pack",
      "dozen",
      "pair", // Added 'pair' for consistency
      "set" // Added 'set' for consistency
    )
    .default("piece")
    .optional()
    .messages({
      "any.only": "Invalid unit provided.",
    }),
  purchasePrice: Joi.number().min(0).precision(2).required().messages({
    // Added .precision(2)
    "number.base": "Purchase price must be a number.",
    "number.min": "Purchase price must be at least 0.",
    "number.precision": "Purchase price can have at most 2 decimal places.",
    "any.required": "Purchase price is required.",
  }),
  sellingPrice: Joi.number().min(0).precision(2).required().messages({
    // Added .precision(2)
    "number.base": "Selling price must be a number.",
    "number.min": "Selling price must be at least 0.",
    "number.precision": "Selling price can have at most 2 decimal places.",
    "any.required": "Selling price is required.",
  }),
  minStockLevel: Joi.number().integer().min(0).default(10).optional().messages({
    // Added .integer()
    "number.base": "Minimum stock level must be a number.",
    "number.integer": "Minimum stock level must be an integer.",
    "number.min": "Minimum stock level must be at least 0.",
  }),
  isActive: Joi.boolean().default(true).optional().messages({
    "boolean.base": "isActive must be a boolean value.",
  }),
  // This initialStock field is specific to the create endpoint
  // and is consumed by the controller to create the Stock document.
  // It's not part of the Product model itself.
  initialStock: Joi.number().integer().min(0).default(0).optional().messages({
    "number.base": "Initial stock must be a number.",
    "number.integer": "Initial stock must be an integer.",
    "number.min": "Initial stock cannot be negative.",
  }),
  images: Joi.array()
    .items(imageSchema) // Reusing the defined imageSchema
    .min(1)
    .max(5)
    .required()
    .messages({
      "array.base": "Images must be an array.",
      "array.min": "At least one image is required.",
      "array.max": "Cannot upload more than 5 images.",
      "any.required": "Product images are required.",
    }),
});

// --- Update Product Schema ---
const updateProductSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional().messages({
    "string.min": "Product name must be at least 2 characters long.",
    "string.max": "Product name cannot exceed 100 characters.",
  }),
  sku: Joi.string().trim().min(3).max(20).uppercase().optional().messages({
    "string.min": "SKU must be at least 3 characters long.",
    "string.max": "SKU cannot exceed 20 characters.",
    "string.uppercase": "SKU must be in uppercase.",
  }),
  description: Joi.string().trim().max(500).optional().messages({
    "string.max": "Description cannot exceed 500 characters.",
  }),
  category: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Category must be a valid category ID.",
  }),
  supplier: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Supplier must be a valid supplier ID.",
  }),
  unit: Joi.string()
    .valid(
      "piece",
      "kg",
      "gram",
      "liter",
      "ml",
      "meter",
      "cm",
      "box",
      "pack",
      "dozen",
      "pair", // Added 'pair' for consistency
      "set" // Added 'set' for consistency
    )
    .optional()
    .messages({
      "any.only": "Invalid unit provided.",
    }),
  purchasePrice: Joi.number().min(0).precision(2).optional().messages({
    "number.base": "Purchase price must be a number.",
    "number.min": "Purchase price must be at least 0.",
    "number.precision": "Purchase price can have at most 2 decimal places.",
  }),
  sellingPrice: Joi.number().min(0).precision(2).optional().messages({
    "number.base": "Selling price must be a number.",
    "number.min": "Selling price must be at least 0.",
    "number.precision": "Selling price can have at most 2 decimal places.",
  }),
  minStockLevel: Joi.number().integer().min(0).optional().messages({
    "number.base": "Minimum stock level must be a number.",
    "number.integer": "Minimum stock level must be an integer.",
    "number.min": "Minimum stock level must be at least 0.",
  }),
  isActive: Joi.boolean().optional().messages({
    "boolean.base": "isActive must be a boolean value.",
  }),
  // For updates, 'images' can be handled in two main ways:
  // 1. Array of new file objects (if re-uploading all images):
  images: Joi.array()
    .items(imageSchema) // Reusing the defined imageSchema
    .min(1)
    .max(5)
    .optional() // Images are optional for updates
    .messages({
      "array.base": "Images must be an array.",
      "array.min": "At least one image is required if providing images.",
      "array.max": "Cannot upload more than 5 images.",
    }),
  // OR 2. Array of strings (if frontend sends back existing image URLs and/or new URLs after CDN upload):
  // images: Joi.array().items(Joi.string().uri()).optional(), // Use this if `images` in update body are always URLs
}).min(1); // At least one field is required for an update operation

// Schema for product query parameters (for getAllProducts)
const productQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(10).optional(),
  sortBy: Joi.string().default("createdAt").optional(), // Match common sortBy fields
  sortOrder: Joi.string().valid("asc", "desc").default("desc").optional(),
  search: Joi.string().trim().optional(),
  category: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Category filter must be a valid category ID.",
  }),
  supplier: objectIdExtension.objectId().optional().messages({
    "objectId.invalid": "Supplier filter must be a valid supplier ID.",
  }),
  isActive: Joi.boolean().optional(),
  stockStatus: Joi.string()
    .valid("out_of_stock", "low_stock", "normal")
    .optional()
    .messages({
      "any.only":
        "Invalid stock status. Must be 'out_of_stock', 'low_stock', or 'normal'.",
    }),
}).unknown(true); // Allow other unknown query parameters for flexibility, or set to false to be strict.

module.exports = {
  createProductSchema,
  updateProductSchema,
  productQuerySchema, // Export the new query schema
};
