// utils/responseHandler.js
exports.successResponse = (res, message, data = {}) => {
  return res.status(200).json({
    success: true,
    message,
    data,
  });
};

exports.errorResponse = (
  res,
  message = "Internal Server Error",
  statusCode = 500
) => {
  return res.status(statusCode).json({
    success: false,
    message,
  });
};
