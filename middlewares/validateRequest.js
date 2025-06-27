// middlewares/validateRequest.js

const Joi = require("joi");
const { validationErrorResponse } = require("../utils/responseHandler");

const objectIdExtension = Joi.extend((joi) => ({
  type: "objectId",
  base: joi.string(),
  messages: {
    "objectId.invalid": "{{#label}} must be a valid ObjectId",
  },
  validate(value, helpers) {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    if (!objectIdPattern.test(value)) {
      return { value, errors: helpers.error("objectId.invalid") };
    }
    return { value };
  },
}));

const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    try {
      const dataToValidate = req[property];
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          value: detail.context?.value,
        }));

        return validationErrorResponse(
          res,
          `Validation failed for ${property}`,
          errors
        );
      }
      req[property] = value;
      next();
    } catch (err) {
      console.error("Validation middleware error:", err);
      return validationErrorResponse(res, "Validation processing error", {
        error: err.message,
      });
    }
  };
};

const commonSchemas = {
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .valid("createdAt", "updatedAt", "name", "price", "stock")
      .default("createdAt"),
    sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  }),

  search: Joi.object({
    search: Joi.string().trim().min(1).max(100),
    category: objectIdExtension.objectId(),
    supplier: objectIdExtension.objectId(),
    isActive: Joi.boolean(),
  }),

  objectId: Joi.object({
    id: objectIdExtension.objectId().required(),
  }),
};

module.exports = {
  validateRequest,
  objectIdExtension,
  commonSchemas,
};
