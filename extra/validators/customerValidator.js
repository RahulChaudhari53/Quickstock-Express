// validators/customerValidator.js
const Joi = require("joi");

const createCustomerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 2 characters long",
    "string.max": "First name cannot exceed 30 characters",
  }),
  lastName: Joi.string().trim().min(2).max(30).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 30 characters",
  }),
  email: Joi.string().email().lowercase().trim().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 10 digits",
      "string.empty": "Phone number is required",
    }),
  isActive: Joi.boolean().default(true).optional(),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
});

const updateCustomerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).optional().messages({
    "string.min": "First name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 30 characters",
  }),
  lastName: Joi.string().trim().min(2).max(30).optional().messages({
    "string.min": "Last name must be at least 2 characters long",
    "string.max": "Last name cannot exceed 30 characters",
  }),
  email: Joi.string().email().lowercase().trim().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .optional()
    .messages({
      "string.pattern.base": "Phone number must be exactly 10 digits",
    }),
  isActive: Joi.boolean().optional(),
  notes: Joi.string().trim().max(500).optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
};
