// utils/responseHandler.js
exports.successResponse = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

exports.errorResponse = (
  res,
  message = "Internal Server Error",
  statusCode = 500,
  error = null
) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (process.env.NODE_ENV === "development" && error) {
    response.error = error;
  }

  return res.status(statusCode).json(response);
};

exports.validationErrorResponse = (res, message, errors) => {
  return res.status(400).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

exports.paginatedResponse = (res, message, data, pagination) => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalItems: pagination.totalItems,
      totalPages: pagination.totalPages,
      hasNextPage: pagination.hasNextPage,
      hasPrevPage: pagination.hasPrevPage,
    },
  });
};

exports.notFoundResource = (res, resource = "Resource") => {
  return res.status(404).json({
    success: false,
    message: `${resource} not found`,
    timestamp: new Date().toISOString(),
  });
};

exports.unauthorizedResponse = (res, message = "Unauthorized access") => {
  return res.status(401).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};

exports.forbiddenResponse = (res, message = "Access forbidden") => {
  return res.status(403).json({
    success: false,
    message,
    timestamp: new Date().toISOString(),
  });
};
