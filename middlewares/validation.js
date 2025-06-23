// middlewares/validation
const Joi = require("joi");
const passwordComplexity = require("joi-password-complexity");

const phoneNumberSchema = Joi.string()
  .pattern(/^\d{10}$/)
  .message("Phone number must contain exactly 10 digits.");

const userValidationSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).required().messages({
    "string.base": "First name must be a string.",
    "string.empty": "First name is required.",
    "string.min": "First name must be at least {#limit} characters long.",
    "string.max": "First name must be at most {#limit} characters long.",
    "any.required": "First name is required.",
  }),

  lastName: Joi.string().trim().min(2).max(30).required().messages({
    "string.base": "Last name must be a string.",
    "string.empty": "Last name is required.",
    "string.min": "Last name must be at least {#limit} characters long.",
    "string.max": "Last name must be at most {#limit} characters long.",
    "any.required": "Last name is required.",
  }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: ["com"] } })
    .required()
    .messages({
      "string.base": "Email must be a string.",
      "string.email": "Email must be a valid email address.",
      "string.empty": "Email is required.",
      "any.required": "Email is required.",
    }),

  primaryPhone: phoneNumberSchema.required().messages({
    "string.empty": "Phone number is required.",
    "any.required": "Phone number is required.",
  }),

  secondaryPhone: phoneNumberSchema.optional().allow(null, "").messages({
    "string.pattern.base": "Phone number must contain exactly 10 digits.",
  }),

  password: passwordComplexity({
    min: 8,
    max: 30,
    lowerCase: 1,
    upperCase: 1,
    numeric: 1,
    symbol: 1,
    requirementCount: 4,
  })
    .required()
    .messages({
      "string.empty": "Password is required.",
      "passwordComplexity.tooShort":
        "Password must be at least {#min} characters long.",
      "passwordComplexity.tooLong":
        "Password must be at most {#max} characters long.",
      "passwordComplexity.lowercase":
        "Password must include at least one lowercase letter.",
      "passwordComplexity.uppercase":
        "Password must include at least one uppercase letter.",
      "passwordComplexity.numeric":
        "Password must include at least one number.",
      "passwordComplexity.symbol":
        "Password must include at least one special character.",
    }),

  profileImage: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "Profile image must be a valid URL.",
  }),

  role: Joi.string().valid("shop_owner", "admin").optional().messages({
    "any.only": 'Role must be either "shop_owner" or "admin".',
  }),
});

const loginSchema = Joi.object({
  phoneNumber: phoneNumberSchema.required().messages({
    "string.empty": "Phone number is required.",
    "any.required": "Phone number is required.",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required.",
    "any.required": "Password is required.",
  }),
});

module.exports = {
  userValidationSchema,
  loginSchema,
};
