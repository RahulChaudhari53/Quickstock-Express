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
