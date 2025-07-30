// tests/sale.test.js
const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");
const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const Stock = require("../models/Stock");

let authToken;
let testUserId;
let activeCategoryId;
let activeSupplierId;
let activeProductId;

let saleId;
let saleToCancelId;

beforeAll(async () => {
  await User.deleteMany({ email: "saletester@gmail.com" });
  await Category.deleteMany({ name: "Sale Test Category" });
  await Supplier.deleteMany({ name: "Sale Test Supplier" });
  await Product.deleteMany({
    $or: [
      { name: "Sale Test Product Active" },
      { name: "Sale Test Product Inactive" },
    ],
  });
  await Sale.deleteMany({
    $or: [
      { invoiceNumber: "INV-001" },
      { invoiceNumber: "INV-002" },
      { invoiceNumber: "INV-003" },
      { invoiceNumber: "INV-005" },
      { invoiceNumber: "INV-006" },
      { invoiceNumber: "INV-007" },
    ],
  });

  const userRes = await request(app).post("/api/users/signup").send({
    firstName: "Sale Test",
    lastName: "User",
    email: "saletester@gmail.com",
    primaryPhone: "9800000104",
    password: "Test@123",
    role: "shop_owner",
  });
  testUserId = userRes.body.data._id;

  const loginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800000104",
    password: "Test@123",
  });
  authToken = loginRes.body.data.token;

  const categoryRes = await request(app)
    .post("/api/categories/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Sale Test Category",
      description: "Category for sale tests",
      isActive: true,
    });
  activeCategoryId = categoryRes.body.data._id;

  const supplierRes = await request(app)
    .post("/api/suppliers/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Sale Test Supplier",
      email: "sale.supplier@example.com",
      phone: "9876543214",
      isActive: true,
    });
  activeSupplierId = supplierRes.body.data._id;

  const activeProductRes = await request(app)
    .post("/api/products/create")
    .set("Authorization", `Bearer ${authToken}`)
    .send({
      name: "Sale Test Product Active",
      sku: "STP001",
      description: "Active product for sale tests",
      category: activeCategoryId,
      supplier: activeSupplierId,
      unit: "kg",
      purchasePrice: 10.0,
      sellingPrice: 20.0,
      minStockLevel: 5,
      initialStock: 100,
      isActive: true,
    });
  activeProductId = activeProductRes.body.data.product._id;
});

afterAll(async () => {
  const productNamesToCleanup = [
    "Sale Test Product Active",
    "Sale Test Product Inactive",
  ];
  const productsToCleanup = await Product.find({
    name: { $in: productNamesToCleanup },
  }).select("_id");
  const productIdsToCleanup = productsToCleanup.map((p) => p._id);

  if (productIdsToCleanup.length > 0) {
    await Stock.deleteMany({ product: { $in: productIdsToCleanup } });
  }

  await User.deleteMany({ email: "saletester@gmail.com" });
  await Category.deleteMany({ name: "Sale Test Category" });
  await Supplier.deleteMany({ name: "Sale Test Supplier" });
  await Product.deleteMany({
    $or: [
      { name: "Sale Test Product Active" },
      { name: "Sale Test Product Inactive" },
    ],
  });
  await Sale.deleteMany({
    $or: [
      { invoiceNumber: "INV-001" },
      { invoiceNumber: "INV-002" },
      { invoiceNumber: "INV-003" },
      { invoiceNumber: "INV-005" },
      { invoiceNumber: "INV-006" },
      { invoiceNumber: "INV-007" },
    ],
  });

  await mongoose.connection.close();
});

describe("Sale APIs", () => {
  test("Should create a new sale successfully and deduct stock", async () => {
    const initialStock = (await Stock.findOne({ product: activeProductId }))
      .currentStock;
    const quantitySold = 10;

    const res = await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        saleDate: new Date(),
        items: [
          {
            product: activeProductId,
            quantity: quantitySold,
            unitPrice: 20.0,
          },
        ],
        paymentMethod: "cash",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Sale created successfully.");
    expect(res.body.data).toHaveProperty("_id");
    saleId = res.body.data._id;
    invoiceNumber = res.body.data.invoiceNumber;

    const updatedStock = await Stock.findOne({ product: activeProductId });
    expect(updatedStock.currentStock).toBe(initialStock - quantitySold);
  });

  test("Should fail to create a sale with missing payment method", async () => {
    const res = await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        items: [
          {
            product: activeProductId,
            quantity: 5,
            unitPrice: 15.0,
          },
        ],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Payment method is required.");
  });

  test("Should fail to create a sale with no items", async () => {
    const res = await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        items: [],
        paymentMethod: "cash",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("A sale must include at least one item.");
  });

  test("Should fail to create a sale due to insufficient stock", async () => {
    const res = await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        items: [
          {
            product: activeProductId,
            quantity: 99999,
            unitPrice: 1.0,
          },
        ],
        paymentMethod: "cash",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      `Insufficient stock for product: Sale Test Product Active.`
    );
  });

  test("Should retrieve all sales successfully", async () => {
    const res = await request(app)
      .get("/api/sales")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.pagination).toBeDefined();
  });

  test("Should retrieve sales filtered by payment method", async () => {
    await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        items: [{ product: activeProductId, quantity: 1, unitPrice: 10.0 }],
        paymentMethod: "online",
      });

    const res = await request(app)
      .get("/api/sales?paymentMethod=Card")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.every((s) => s.paymentMethod === "online")).toBe(
      true
    );
  });

  test("Should retrieve a single sale by ID successfully", async () => {
    const res = await request(app)
      .get(`/api/sales/sale/${saleId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id.toString()).toBe(saleId.toString());
    expect(res.body.data.invoiceNumber).toBe(`${invoiceNumber}`);
  });

  test("Should cancel a sale, restore stock, and delete sale record", async () => {
    const initialStockBeforeCancel = (
      await Stock.findOne({ product: activeProductId })
    ).currentStock;
    const quantityToReturn = 5;

    const newSaleRes = await request(app)
      .post("/api/sales/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        items: [
          {
            product: activeProductId,
            quantity: quantityToReturn,
            unitPrice: 10.0,
          },
        ],
        paymentMethod: "cash",
      });
    saleToCancelId = newSaleRes.body.data._id;
    const stockAfterSale = (await Stock.findOne({ product: activeProductId }))
      .currentStock;
    expect(stockAfterSale).toBe(initialStockBeforeCancel - quantityToReturn);

    const res = await request(app)
      .delete(`/api/sales/sale/cancel/${saleToCancelId.toString()}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(
      "Sale cancelled, stock restored, and record deleted successfully."
    );

    const cancelledSale = await Sale.findById(saleToCancelId);
    expect(cancelledSale).toBeNull();

    const finalStock = await Stock.findOne({ product: activeProductId });
    expect(finalStock.currentStock).toBe(initialStockBeforeCancel);
  });
});
