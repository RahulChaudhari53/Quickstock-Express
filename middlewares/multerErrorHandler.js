// middlewares/multerErrorHandler.js
const multer = require("multer");
const { errorResponse } = require("../utils/responseHandler");

const handleMulterError = (uploadInstance, fieldName) => {
  return (req, res, next) => {
    uploadInstance.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return errorResponse(
            res,
            `File size too large. Max ${
              process.env.MAX_FILE_SIZE_MB || 5
            }MB allowed.`,
            400
          );
        }
        return errorResponse(res, `File upload error: ${err.message}`, 400);
      } else if (err) {
        return errorResponse(res, `Upload failed: ${err.message}`, 500);
      }
      next();
    });
  };
};

module.exports = handleMulterError;
