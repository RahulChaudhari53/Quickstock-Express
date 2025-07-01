// validators/categoryValidator.js
const Joi = require("joi");

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Category name is required",
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name cannot exceed 50 characters",
  }),
  description: Joi.string().trim().max(200).optional().messages({
    "string.max": "Description cannot exceed 200 characters",
  }),
  isActive: Joi.boolean().default(true).optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).optional().messages({
    "string.min": "Category name must be at least 2 characters long",
    "string.max": "Category name cannot exceed 50 characters",
  }),
  description: Joi.string().trim().max(200).optional().messages({
    "string.max": "Description cannot exceed 200 characters",
  }),
  isActive: Joi.boolean().optional(),
});

module.exports = {
  createCategorySchema,
  updateCategorySchema,
};
