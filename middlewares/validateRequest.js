// validateRequest.js
const { errorResponse } = require("../utils/responseHandler");

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      const message = error.details.map((detail) => detail.message);
      return errorResponse(res, message.join(", "), 400);
    }
    next();
  };
};

module.exports = validateRequest;
