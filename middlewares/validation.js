const Joi = require("joi");

// User Registration Schema
const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(30).required(),
  lastName: Joi.string().trim().min(2).max(30).required(),
  email: Joi.string().email().required(),
  phoneNumbers: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

// User Login Schema
const loginSchema = Joi.object({
  phoneNumber: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

module.exports = {
  registerSchema,
  loginSchema,
};
