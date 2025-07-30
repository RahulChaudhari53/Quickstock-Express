// controllers/productController.js
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Stock = require("../models/Stock");
const Category = require("../models/Category");
const Supplier = require("../models/Supplier");

const { successResponse, errorResponse } = require("../utils/responseHandler");

// POST /api/products/create - Create a product
const createProduct = async (req, res, next) => {
  const { initialStock = 0, ...productData } = req.body;
  const authenticatedUserId = req.user._id;

  const requiredFields = [
    "name",
    "sku",
    "category",
    "supplier",
    "unit",
    "purchasePrice",
    "sellingPrice",
    "minStockLevel",
  ];

  const missingFields = requiredFields.filter((field) => !productData[field]);
  if (missingFields.length > 0) {
    console.log("Missing fields:", missingFields);
    return errorResponse(res, "Please fill all required fields.", 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const existingProduct = await Product.findOne({
      $or: [
        { sku: { $regex: `^${productData.sku}$`, $options: "i" } },
        { name: { $regex: `^${productData.name}$`, $options: "i" } },
      ],
    }).session(session);

    if (existingProduct) {
      const isSku = existingProduct.sku.toLowerCase() === sku.toLowerCase();
      const message = `Product with this ${
        isSku ? "SKU" : "name"
      } already exists.`;
      await session.abortTransaction();
      session.endSession();
      return errorResponse(res, message, 409);
    }

    const [categoryDoc, supplierDoc] = await Promise.all([
      Category.findById(productData.category).session(session),
      Supplier.findById(productData.supplier).session(session),
    ]);

    if (!categoryDoc || !categoryDoc.isActive) {
      throw new Error("Invalid or inactive category provided.");
    }

    if (!supplierDoc || !supplierDoc.isActive) {
      throw new Error("Invalid or inactive supplier provided.");
    }

    productData.createdBy = authenticatedUserId;

    const newProduct = new Product(productData);
    const savedProduct = await newProduct.save({ session });

    const stock = new Stock({
      product: savedProduct._id,
      currentStock: initialStock,
    });

    if (initialStock > 0) {
      stock.movementHistory.push({
        movementType: "adjustment",
        quantity: initialStock,
        notes: "Initial stock upon product creation",
        movedBy: authenticatedUserId,
        sourceDocument: savedProduct._id,
        sourceModel: "Product",
      });
    }

    await stock.save({ session });

    await session.commitTransaction();
    session.endSession();

    await savedProduct.populate("supplier", "name contactPerson phone email");

    return successResponse(
      res,
      "Product created successfully.",
      { product: savedProduct, stock },
      201
    );
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating product:", err.message);
    next(err);
  }
};

// GET /api/products - Get all products with pagination and filtering
const getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 1000,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      category,
      supplier,
      isActive,
      stockStatus,
      minPurchasePrice,
      maxPurchasePrice,
      minSellingPrice,
      maxSellingPrice,
      unit,
    } = req.query;

    const authenticatedUserId = req.user._id;

    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);

    const skip = (parsedPage - 1) * parsedLimit;
    const pipeline = [];
    const matchStage = {
      createdBy: new mongoose.Types.ObjectId(authenticatedUserId),
    };

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      matchStage.category = new mongoose.Types.ObjectId(category);
    }
    if (supplier && mongoose.Types.ObjectId.isValid(supplier)) {
      matchStage.supplier = new mongoose.Types.ObjectId(supplier);
    }

    if (isActive !== undefined) {
      matchStage.isActive = isActive === "true";
    }

    if (unit) {
      matchStage.unit = unit;
    }

    if (minPurchasePrice || maxPurchasePrice) {
      matchStage.purchasePrice = {};
      if (minPurchasePrice)
        matchStage.purchasePrice.$gte = parseFloat(minPurchasePrice);
      if (maxPurchasePrice)
        matchStage.purchasePrice.$lte = parseFloat(maxPurchasePrice);
    }

    if (minSellingPrice || maxSellingPrice) {
      matchStage.sellingPrice = {};
      if (minSellingPrice)
        matchStage.sellingPrice.$gte = parseFloat(minSellingPrice);
      if (maxSellingPrice)
        matchStage.sellingPrice.$lte = parseFloat(maxSellingPrice);
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push({
      $lookup: {
        from: "stocks",
        localField: "_id",
        foreignField: "product",
        as: "stockInfo",
      },
    });

    pipeline.push({
      $unwind: { path: "$stockInfo", preserveNullAndEmptyArrays: true },
    });

    pipeline.push({
      $addFields: {
        currentStock: { $ifNull: ["$stockInfo.currentStock", 0] },
        minStockLevel: "$minStockLevel",
      },
    });

    if (stockStatus) {
      const stockStatusMatch = {};
      switch (stockStatus) {
        case "out_of_stock":
          stockStatusMatch.currentStock = 0;
          break;
        case "low_stock":
          stockStatusMatch.$expr = {
            $and: [
              { $lte: ["$currentStock", "$minStockLevel"] },
              { $gt: ["$currentStock", 0] },
            ],
          };
          break;
        case "normal":
          stockStatusMatch.$expr = {
            $gt: ["$currentStock", "$minStockLevel"],
          };
          break;
      }
      if (Object.keys(stockStatusMatch).length > 0) {
        pipeline.push({ $match: stockStatusMatch });
      }
    }

    const countPipeline = [...pipeline, { $count: "total" }];

    pipeline.push({ $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parsedLimit });

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
        images: 1,
        minStockLevel: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        createdBy: 1,
        currentStock: 1,
      },
    });

    const [productsResult, totalResult] = await Promise.all([
      Product.aggregate(pipeline),
      Product.aggregate(countPipeline),
    ]);

    const totalItems = totalResult.length > 0 ? totalResult[0].total : 0;
    const totalPages = Math.ceil(totalItems / parsedLimit);

    await Product.populate(productsResult, [
      { path: "supplier", select: "name contactPerson phone email" },
      { path: "category", select: "name description" },
    ]);

    const pagination = {
      currentPage: parsedPage, // currentpage in fronend but here was page
      limit: parsedLimit,
      totalItems,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPrevPage: parsedPage > 1,
    };

    return successResponse(res, "Products retrieved successfully.", {
      products: productsResult,
      pagination,
    });
  } catch (err) {
    console.error("Error fetching products:", err);
    next(err);
  }
};

// GET /api/products/product/:productId - Get product by ID
const getProductById = async (req, res, next) => {
  const { productId } = req.params;
  const authenticatedUserId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return errorResponse(res, "Invalid product ID format.", 400);
  }

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    })
      .populate("supplier", "name contactPerson phone email")
      .populate("category", "name description")
      .lean();

    if (!product) {
      return errorResponse(res, "Product not found.", 404);
    }

    const stock = await Stock.findOne({ product: product._id }).lean();
    product.currentStock = stock ? stock.currentStock : 0;

    return successResponse(res, "Product retrieved successfully.", product);
  } catch (err) {
    console.error("Error fetching product by ID:", err);
    next(err);
  }
};

// PATCH /api/products/:productId/update - Update product
const updateProduct = async (req, res, next) => {
  const { productId } = req.params;
  const updateData = req.body;
  const authenticatedUserId = req.user._id;

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    });
    if (!product) {
      return errorResponse(res, "Product not found.", 404);
    }

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

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, createdBy: authenticatedUserId },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    )
      .populate("supplier", "name contactPerson phone email")
      .populate("category", "name description");

    if (!updatedProduct) {
      return errorResponse(
        res,
        "Product not found or you do not have permission to update it.",
        404
      );
    }

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

// DELETE /api/products/product/deactivate/:productId - Soft delete (deactivate) product
const deleteProduct = async (req, res, next) => {
  const { productId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    });
    if (!product) {
      return errorResponse(res, "Product not found.", 404);
    }
    if (!product.isActive) {
      return errorResponse(res, "Product is already inactive.", 400);
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, createdBy: authenticatedUserId, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!updatedProduct) {
      return errorResponse(
        res,
        "Product not found, is already inactive, or you lack permissions.",
        404
      );
    }

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

// PATCH /api/products/product/activate/:productId - Reactivate a product
const activateProduct = async (req, res, next) => {
  const { productId } = req.params;
  const authenticatedUserId = req.user._id;

  try {
    const product = await Product.findOne({
      _id: productId,
      createdBy: authenticatedUserId,
    });
    if (!product) {
      return errorResponse(res, "Product not found.", 404);
    }
    if (product.isActive) {
      return errorResponse(res, "Product is already active.", 400);
    }

    const activatedProduct = await Product.findOneAndUpdate(
      { _id: productId, createdBy: authenticatedUserId, isActive: false },
      { isActive: true },
      { new: true, runValidators: true }
    );

    if (!activatedProduct) {
      return errorResponse(
        res,
        "Product not found, is already active, or you lack permissions.",
        404
      );
    }

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

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  activateProduct,
};
