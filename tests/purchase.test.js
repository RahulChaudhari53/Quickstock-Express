// tests/purchase.test.js
const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const Purchase = require("../models/Purchase");
const Stock = require("../models/Stock");

let authToken;
let testUserId;
let activeSupplierId;
let activeProductId;
let testPurchaseId;
let orderedPurchaseId;

beforeAll(async () => {
  await User.deleteMany({ email: "purchasetester@gmail.com" });
  await Supplier.deleteMany({
    $or: [
      { name: "Purchase Test Supplier Active" },
      { name: "Purchase Test Supplier Inactive" },
    ],
  });
  await Product.deleteMany({
    $or: [
      { name: "Purchase Test Product Active" },
      { name: "Purchase Test Product Inactive" },
    ],
  });
  await Category.deleteMany({ name: "Purchase Test Category" });
  await Purchase.deleteMany({
    $or: [
      { purchaseNumber: "PO-001" },
      { purchaseNumber: "PO-002" },
      { purchaseNumber: "PO-003" },
      { purchaseNumber: "PO-004" },
      { purchaseNumber: "PO-005" },
    ],
  });

  const userRes = await request(app).post("/api/users/signup").send({
    firstName: "Purchase Test",
    lastName: "User",
    email: "purchasetester@gmail.com",
    primaryPhone: "9800000103",
    password: "Test@123",
    role: "shop_owner",
  });
  testUserId = userRes.body.data._id;

  const loginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800000103",
    password: "Test@123",
  });
  authToken = loginRes.body.data.token;

  const categoryRes = await request(app)
    .post("/api/categories/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Purchase Test Category",
      description: "Category for purchase tests",
      isActive: true,
    });
  const categoryId = categoryRes.body.data._id;

  const activeSupplierRes = await request(app)
    .post("/api/suppliers/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Purchase Test Supplier Active",
      email: "purchase.active@example.com",
      phone: "9876543212",
      isActive: true,
    });
  activeSupplierId = activeSupplierRes.body.data._id;

  const activeProductRes = await request(app)
    .post("/api/products/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Purchase Test Product Active",
      sku: "PTP001",
      description: "Active product for purchase tests",
      category: categoryId,
      supplier: activeSupplierId,
      unit: "kg",
      purchasePrice: 10.0,
      sellingPrice: 20.0,
      minStockLevel: 5,
      initialStock: 0,
      isActive: true,
    });
  activeProductId = activeProductRes.body.data.product._id;
});

afterAll(async () => {
  const productNamesToCleanup = [
    "Purchase Test Product Active",

  ];
  const productsToCleanup = await Product.find({
    name: { $in: productNamesToCleanup },
  }).select("_id");
  const productIdsToCleanup = productsToCleanup.map((p) => p._id);

  if (productIdsToCleanup.length > 0) {
    await Stock.deleteMany({ product: { $in: productIdsToCleanup } });
  }

  await User.deleteMany({ email: "purchasetester@gmail.com" });
  await Supplier.deleteMany({
    $or: [{ name: "Purchase Test Supplier Active" }],
  });
  await Category.deleteMany({ name: "Purchase Test Category" });
  await Purchase.deleteMany({
    $or: [{ purchaseNumber: "PO-001" }, { purchaseNumber: "PO-005" }],
  });
  await Product.deleteMany({
    $or: [
      { name: "Purchase Test Product Active" },
    ],
  });

  await mongoose.connection.close();
});

describe("Purchase APIs", () => {
  test("Should create a new purchase successfully", async () => {
    const res = await request(app)
      .post("/api/purchases/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        purchaseNumber: "PO-001",
        supplier: activeSupplierId,
        orderDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 86400000),
        items: [
          {
            product: activeProductId,
            quantity: 10,
            unitCost: 5.0,
          },
        ],
        purchaseStatus: "ordered",
        paymentMethod: "cash",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Purchase created successfully.");
    expect(res.body.data).toHaveProperty("_id");
    expect(res.body.data.purchaseNumber).toBe("PO-001");
    expect(res.body.data.items[0].product._id.toString()).toBe(
      activeProductId.toString()
    );
    expect(res.body.data.items[0].quantity).toBe(10);
    expect(res.body.data.purchaseStatus).toBe("ordered");
    testPurchaseId = res.body.data._id;
    orderedPurchaseId = res.body.data._id;
  });

  test("Should retrieve all purchases successfully", async () => {
    const res = await request(app)
      .get("/api/purchases")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  test("Should retrieve a single purchase by ID successfully", async () => {
    const res = await request(app)
      .get(`/api/purchases/purchase/${testPurchaseId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id.toString()).toBe(testPurchaseId.toString());
    expect(res.body.data.purchaseNumber).toBe("PO-001");
  });

  test("Should cancel a purchase successfully", async () => {
    const newPurchaseRes = await request(app)
      .post("/api/purchases/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        purchaseNumber: "PO-005",
        supplier: activeSupplierId,
        items: [{ product: activeProductId, quantity: 5, unitCost: 2.0 }],
        purchaseStatus: "ordered",
        paymentMethod: "cash",
      });
    const purchaseToCancelId = newPurchaseRes.body.data._id;

    const res = await request(app)
      .patch(`/api/purchases/purchase/cancel/${purchaseToCancelId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Purchase cancelled successfully.");

    const cancelledPurchase = await Purchase.findById(purchaseToCancelId);
    expect(cancelledPurchase.purchaseStatus).toBe("cancelled");
  });
});
