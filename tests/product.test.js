const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const Stock = require("../models/Stock");

let authToken;
let testUserId;
let activeCategoryId;
let inactiveCategoryId;
let activeSupplierId;
let inactiveSupplierId;
let testProductId;

beforeAll(async () => {
  await User.deleteMany({ email: "producttester@gmail.com" });
  await Category.deleteMany({
    $or: [{ name: "Test Category Active" }, { name: "Test Category Inactive" }],
  });
  await Supplier.deleteMany({
    $or: [{ name: "Test Supplier Active" }, { name: "Test Supplier Inactive" }],
  });
  await Product.deleteMany({
    $or: [
      { name: "Test Product" },
      { name: "Updated Test Product" },
      { name: "Another Product" },
      { name: "Incomplete Product" },
      { sku: "SKU001" },
      { sku: "SKU002" },
      { sku: "INC001" },
    ],
  });
  await Stock.deleteMany({});

  const userRes = await request(app).post("/api/users/signup").send({
    firstName: "Product Test",
    lastName: "User",
    email: "producttester@gmail.com",
    primaryPhone: "9800000102",
    password: "Test@123",
    role: "shop_owner",
  });
  testUserId = userRes.body.data._id;

  const loginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800000102",
    password: "Test@123",
  });
  authToken = loginRes.body.data.token;

  const activeCategoryRes = await request(app)
    .post("/api/categories/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Test Category Active",
      description: "Active category for product tests",
      isActive: true,
    });
  activeCategoryId = activeCategoryRes.body.data._id;

  const inactiveCategoryRes = await request(app)
    .post("/api/categories/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Test Category Inactive",
      description: "Inactive category for product tests",
      isActive: false,
    });
  inactiveCategoryId = inactiveCategoryRes.body.data._id;

  const activeSupplierRes = await request(app)
    .post("/api/suppliers/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Test Supplier Active",
      email: "active.supplier@example.com",
      phone: "9876543210",
      isActive: true,
    });
  activeSupplierId = activeSupplierRes.body.data._id;

  const inactiveSupplierRes = await request(app)
    .post("/api/suppliers/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Test Supplier Inactive",
      email: "inactive.supplier@example.com",
      phone: "9876543211",
      isActive: false,
    });
  inactiveSupplierId = inactiveSupplierRes.body.data._id;
});

afterAll(async () => {
  await User.deleteMany({ email: "producttester@gmail.com" });
  await Category.deleteMany({
    $or: [{ name: "Test Category Active" }, { name: "Test Category Inactive" }],
  });
  await Supplier.deleteMany({
    $or: [{ name: "Test Supplier Active" }, { name: "Test Supplier Inactive" }],
  });
  await Product.deleteMany({
    $or: [
      { name: "Test Product" },
      { name: "Updated Test Product" },
      { name: "Another Product" },
      { name: "Incomplete Product" },
      { sku: "SKU001" },
      { sku: "SKU002" },
      { sku: "INC001" },
    ],
  });
  await Stock.deleteMany({});
  await mongoose.connection.close();
});

describe("Product APIs", () => {
  test("Should create a new product successfully with initial stock", async () => {
    const res = await request(app)
      .post("/api/products/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Test Product",
        sku: "SKU001",
        description: "A test product",
        category: activeCategoryId,
        supplier: activeSupplierId,
        unit: "kg",
        purchasePrice: 10.0,
        sellingPrice: 20.0,
        minStockLevel: 5,
        initialStock: 100,
        isActive: true,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product created successfully.");
    expect(res.body.data.product).toHaveProperty("_id");
    expect(res.body.data.product.name).toBe("Test Product");
    expect(res.body.data.stock.currentStock).toBe(100);
    testProductId = res.body.data.product._id;
  });

  test("Should fail to create a product with missing required fields", async () => {
    const res = await request(app)
      .post("/api/products/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Incomplete Product",
        sku: "INC001",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Please fill all required fields.");
  });

  test("Should retrieve all products successfully", async () => {
    const res = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  test("Should retrieve only inactive products when isActive is false", async () => {
    await request(app)
      .delete(`/api/products/product/deactivate/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/products?isActive=false")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(
      res.body.data.products.some((p) => p._id === testProductId.toString())
    ).toBe(true);
    expect(res.body.data.products.every((p) => p.isActive === false)).toBe(
      true
    );
  });

  test("Should retrieve a single product by ID successfully", async () => {
    await request(app)
      .patch(`/api/products/product/activate/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get(`/api/products/product/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(testProductId.toString());
    expect(res.body.data.name).toBe("Test Product");
    expect(res.body.data).toHaveProperty("currentStock");
  });

  test("Should update an existing product successfully", async () => {
    const res = await request(app)
      .patch(`/api/products/product/update/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Updated Test Product",
        sellingPrice: 25.5,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product updated successfully.");
    expect(res.body.data.name).toBe("Updated Test Product");
    expect(res.body.data.sellingPrice).toBe(25.5);
  });

  test("Should deactivate (soft delete) a product successfully", async () => {
    const res = await request(app)
      .delete(`/api/products/product/deactivate/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product deactivated successfully.");

    const product = await Product.findById(testProductId);
    expect(product.isActive).toBe(false);
  });

  test("Should activate a product successfully", async () => {
    const res = await request(app)
      .patch(`/api/products/product/activate/${testProductId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Product activated successfully.");

    const product = await Product.findById(testProductId);
    expect(product.isActive).toBe(true);
  });
});
