// controllers/productController.js

const Product = require("../../models/Product");
const Stock = require("../../models/Stock");
const Category = require("../../models/Category"); // Used for category validation
const Supplier = require("../../models/Supplier"); // Used for supplier validation
const {
  successResponse,
  errorResponse,
  notFoundResource, // Corrected from notFoundResponse
  paginatedResponse,
} = require("../../utils/responseHandler");

// For transactions
const mongoose = require("mongoose");

// POST /api/products - Create a new product
const createProduct = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Input validation (productData, initialStock) is handled by validateRequest middleware
  // Multer handles req.file if product has images
  const { initialStock, ...productData } = req.body; // initialStock is consumed here, not stored on Product model
  const authenticatedUserId = req.user._id;

  // Start a Mongoose session for transaction to ensure atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Check for existing SKU (case-insensitive)
    // Joi helps with format, this checks for uniqueness
    const existingProductWithSku = await Product.findOne({
      sku: productData.sku,
    }).session(session);
    if (existingProductWithSku) {
      // Abort transaction and respond if SKU exists
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Product with this SKU already exists.", 409);
    }

    // 2. Validate Category: Ensure the category exists and is active
    const category = await Category.findById(productData.category).session(
      session
    );
    if (!category || !category.isActive) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Invalid or inactive category provided.", 400);
    }

    // 3. Validate Supplier: Ensure the supplier exists and is active
    const supplier = await Supplier.findById(productData.supplier).session(
      session
    );
    if (!supplier || !supplier.isActive) {
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, "Invalid or inactive supplier provided.", 400);
    }

    // Assign createdBy from authenticated user
    productData.createdBy = authenticatedUserId;

    // 4. Create the Product document
    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save({ session }); // Pass session to save

    // 5. Create the Stock document for the new product
    const stock = new Stock({
      product: savedProduct._id,
      currentStock: initialStock || 0, // Set initial stock
    });

    // 6. Record initial stock as an adjustment movement
    if (initialStock && initialStock > 0) {
      stock.movementHistory.push({
        movementType: "adjustment",
        quantity: initialStock,
        notes: "Initial stock upon product creation",
        movedBy: authenticatedUserId, // Record who performed this initial adjustment
        sourceDocument: savedProduct._id, // Link to the product itself as the source
        sourceModel: "Product", // Indicate the source model
      });
    }

    await stock.save({ session }); // Pass session to save stock

    // If both product and stock creation succeed, commit the transaction
    await session.commitTransaction();
    session.endSession();

    // Populate necessary fields for the response
    await savedProduct.populate("supplier", "name contactPerson phone email"); // Updated supplier fields based on model

    return successResponse(
      res,
      "Product created successfully.",
      { product: savedProduct, stock }, // Return both product and its initial stock
      201
    );
  } catch (err) {
    // If any error occurs, abort the transaction to revert all changes
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating product:", err);
    // Delegate to global error handler for Mongoose errors or unexpected issues
    next(err);
  }
};

// GET /api/products - Get all products with pagination and filtering
const getAllProducts = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Query parameters are validated by validateRequest middleware (commonSchemas.pagination, commonSchemas.search)
  const {
    page,
    limit,
    sortBy,
    sortOrder,
    search,
    category,
    supplier,
    isActive,
    stockStatus,
  } = req.query;

  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;

  // Build the aggregation pipeline
  const pipeline = [];

  // Stage 1: Match products based on general filters
  const matchStage = {};
  if (search) {
    matchStage.$or = [
      { name: { $regex: search, $options: "i" } },
      { sku: { $regex: search, $options: "i" } },
    ];
  }
  if (category) {
    matchStage.category = new mongoose.Types.ObjectId(category); // Ensure ObjectId type
  }
  if (supplier) {
    matchStage.supplier = new mongoose.Types.ObjectId(supplier); // Ensure ObjectId type
  }
  if (isActive !== undefined) {
    matchStage.isActive = isActive === "true";
  }

  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }

  // Stage 2: Look up corresponding Stock information
  pipeline.push({
    $lookup: {
      from: "stocks", // The name of the collection for the Stock model (usually lowercase plural)
      localField: "_id", // Field from the Product document
      foreignField: "product", // Field from the Stock document
      as: "stockInfo", // Array field to add to the Product document
    },
  });

  // Stage 3: Unwind the stockInfo array (since product has 1 stock record, it will be 1 element array)
  pipeline.push({
    $unwind: {
      path: "$stockInfo",
      preserveNullAndEmptyArrays: true, // Keep products even if they have no stock record (though they should)
    },
  });

  // Stage 4: Add fields for filtering by stockStatus (using $addFields before $match for clarity)
  pipeline.push({
    $addFields: {
      currentStock: "$stockInfo.currentStock",
      minStockLevel: "$minStockLevel", // Min stock level is already on Product model
    },
  });

  // Stage 5: Filter by stockStatus
  if (stockStatus) {
    const stockStatusMatch = {};
    switch (stockStatus) {
      case "out_of_stock":
        stockStatusMatch.currentStock = 0;
        break;
      case "low_stock":
        // Corrected logic: currentStock <= minStockLevel AND currentStock > 0
        stockStatusMatch.$expr = {
          $and: [
            { $lte: ["$currentStock", "$minStockLevel"] },
            { $gt: ["$currentStock", 0] },
          ],
        };
        break;
      case "normal":
        stockStatusMatch.$expr = { $gt: ["$currentStock", "$minStockLevel"] };
        break;
      default:
        // Handle invalid stockStatus or do nothing
        break;
    }
    if (Object.keys(stockStatusMatch).length > 0) {
      pipeline.push({ $match: stockStatusMatch });
    }
  }

  // Stage 6: Sort results
  const sortOptions = {};
  // For stock related sorting, if you want to sort by currentStock directly, it's now available
  if (sortBy === "currentStock") {
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
  } else {
    // Default sorting for product fields (name, createdAt, etc.)
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;
  }
  pipeline.push({ $sort: sortOptions });

  // Stage 7: Handle pagination (skip and limit)
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: parsedLimit });

  // Stage 8: Project (select) fields and populate references for the final output
  // Also de-structure stockInfo to make currentStock directly accessible on product
  pipeline.push({
    $project: {
      _id: 1,
      name: 1,
      sku: 1,
      description: 1,
      category: 1,
      supplier: 1,
      unit: 1,
      purchasePrice: 1,
      sellingPrice: 1,
      images: 1, // Include images field
      minStockLevel: 1,
      isActive: 1,
      createdAt: 1,
      updatedAt: 1,
      createdBy: 1,
      currentStock: "$stockInfo.currentStock", // Project current stock from stockInfo
      // You can also project specific fields from supplier and category if you don't want full populate later
      // supplierName: "$supplierInfo.name" etc. (requires additional lookups if you need specific sub-fields from populates here)
    },
  });

  try {
    // Total count for pagination (run separate pipeline or adjust this one)
    // To get total count *with filters applied*, we need a separate aggregation pipeline or adjust this one.
    // Simpler for pagination: run a countDocuments on Product *after* applying top-level filters, then use a separate aggregation for filtering on stock.
    // Or, use a $facet pipeline for both data and count in one go (more advanced).
    // For now, let's keep it two separate calls.

    // First, get the total count *with all filters including stock status*
    const countPipeline = [...pipeline]; // Clone the pipeline
    // Remove skip, limit, and project stages for counting
    countPipeline.pop(); // remove $project
    countPipeline.pop(); // remove $limit
    countPipeline.pop(); // remove $skip

    countPipeline.push({ $count: "total" }); // Add a count stage

    const [productsResult, totalResult] = await Promise.all([
      Product.aggregate(pipeline),
      Product.aggregate(countPipeline),
    ]);

    const totalItems = totalResult.length > 0 ? totalResult[0].total : 0;

    // Populate references after aggregation for better performance in some cases
    // (though sometimes populate within aggregation is better for deeply nested, this is simpler)
    await Product.populate(productsResult, [
      { path: "supplier", select: "name contactPerson phone email" }, // Updated supplier fields
      { path: "category", select: "name description" }, // Populate category name/description
    ]);

    const totalPages = Math.ceil(totalItems / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    const pagination = {
      page: parsedPage,
      limit: parsedLimit,
      totalItems,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };

    return paginatedResponse(
      res,
      "Products retrieved successfully.",
      productsResult, // Use productsResult from aggregation
      pagination
    );
  } catch (err) {
    console.error("Error fetching products:", err);
    next(err);
  }
};

// GET /api/products/:id - Get product by ID
const getProductById = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Validation for productId is handled by validateRequest(commonSchemas.objectId, 'params')
  const { id } = req.params; // Use 'id' for consistency

  try {
    const product = await Product.findById(id) // Use 'id'
      .populate("supplier", "name contactPerson phone email") // Updated supplier fields
      .populate("category", "name description") // Populate category
      .lean();

    if (!product) {
      return notFoundResource(res, "Product"); // Use notFoundResource helper
    }

    // Also fetch and attach stock information for this single product
    const stock = await Stock.findOne({ product: product._id }).lean();
    if (stock) {
      product.currentStock = stock.currentStock;
      // Optionally attach full stock object if needed: product.stockInfo = stock;
    } else {
      // If no stock record exists (shouldn't happen with our create logic)
      product.currentStock = 0;
    }

    return successResponse(res, "Product retrieved successfully.", product);
  } catch (err) {
    console.error("Error fetching product by ID:", err);
    next(err);
  }
};

// PATCH /api/products/:id - Update product
const updateProduct = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Validation for product ID in params and updateData in body is handled by validateRequest middleware
  const { id } = req.params; // Use 'id' for consistency
  const updateData = req.body; // Joi validated this. Contains name, sku, description, category, supplier, unit, purchasePrice, sellingPrice, minStockLevel, isActive, images.

  try {
    const product = await Product.findById(id);
    if (!product) {
      return notFoundResource(res, "Product");
    }

    // Check if SKU is being updated and if the new SKU already exists
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProductWithSku = await Product.findOne({
        sku: updateData.sku,
      });
      if (existingProductWithSku) {
        return errorResponse(
          res,
          "SKU already exists for another product.",
          409
        );
      }
    }

    // Verify supplier exists and is active if supplier is being updated
    if (updateData.supplier) {
      const supplier = await Supplier.findById(updateData.supplier);
      if (!supplier || !supplier.isActive) {
        return errorResponse(
          res,
          "Invalid or inactive supplier provided.",
          400
        );
      }
    }

    // Verify category exists and is active if category is being updated
    if (updateData.category) {
      const category = await Category.findById(updateData.category);
      if (!category || !category.isActive) {
        return errorResponse(
          res,
          "Invalid or inactive category provided.",
          400
        );
      }
    }

    // Update the product document. `new: true` returns the updated document.
    // `runValidators: true` ensures Mongoose schema validators are applied.
    const updatedProduct = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("supplier", "name contactPerson phone email")
      .populate("category", "name description"); // Populate category on update response

    return successResponse(
      res,
      "Product updated successfully.",
      updatedProduct
    );
  } catch (err) {
    console.error("Error updating product:", err);
    next(err);
  }
};

// DELETE /api/products/:id - Soft delete product
const deleteProduct = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  const { id } = req.params; // Use 'id' for consistency

  try {
    const product = await Product.findById(id);
    if (!product) {
      return notFoundResource(res, "Product");
    }

    // Check if product is already inactive
    if (!product.isActive) {
      return errorResponse(res, "Product is already inactive.", 400);
    }

    // Soft delete: Set isActive to false
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    return successResponse(
      res,
      "Product deactivated successfully.",
      updatedProduct
    );
  } catch (err) {
    console.error("Error deleting product:", err);
    next(err);
  }
};

// PATCH /api/products/:id/activate - Reactivate a product
const activateProduct = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  const { id } = req.params;

  try {
    const product = await Product.findById(id);
    if (!product) {
      return notFoundResource(res, "Product");
    }

    // Check if product is already active
    if (product.isActive) {
      return errorResponse(res, "Product is already active.", 400);
    }

    const activatedProduct = await Product.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true, runValidators: true }
    );

    return successResponse(
      res,
      "Product activated successfully.",
      activatedProduct
    );
  } catch (err) {
    console.error("Activate product error:", err);
    next(err);
  }
};

// GET /api/products/category/:categoryId - Get products by category (might be merged with getAllProducts)
const getProductsByCategory = async (req, res, next) => {
  // Authorization: Assumed to be handled by 'isShopOwner' middleware on the route
  // Validation for categoryId is handled by validateRequest(commonSchemas.objectId, 'params')
  const { categoryId } = req.params; // Using categoryId for path parameter
  const {
    page = 1,
    limit = 10,
    sortBy = "name",
    sortOrder = "asc",
  } = req.query; // Added sort options

  const parsedPage = parseInt(page);
  const parsedLimit = parseInt(limit);
  const skip = (parsedPage - 1) * parsedLimit;
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  try {
    // Verify if the category actually exists and is active
    const existingCategory = await Category.findById(categoryId);
    if (!existingCategory || !existingCategory.isActive) {
      return notFoundResource(res, "Category not found or is inactive.");
    }

    // Find products belonging to the specified category and are active
    const filter = { category: categoryId, isActive: true };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("supplier", "name contactPerson phone email")
        .populate("category", "name description") // Populate category details too
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / parsedLimit);
    const hasNextPage = parsedPage < totalPages;
    const hasPrevPage = parsedPage > 1;

    const pagination = {
      page: parsedPage,
      limit: parsedLimit,
      totalItems: total,
      totalPages,
      hasNextPage,
      hasPrevPage,
    };

    return paginatedResponse(
      res,
      "Products retrieved successfully.",
      products,
      pagination
    );
  } catch (err) {
    console.error("Error fetching products by category:", err);
    next(err);
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  activateProduct,
  getProductsByCategory, // Still useful as a dedicated category endpoint
};
