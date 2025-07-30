// tests/supplier.test.js
const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const Supplier = require("../models/Supplier");

let authToken;
let testSupplierId;
let anotherSupplierId;

beforeAll(async () => {
  await User.deleteMany({ email: "suppliertester@gmail.com" });
  await Supplier.deleteMany({
    $or: [
      { name: "Test Supplier" },
      { name: "Another Supplier" },
      { email: "test@example.com" },
      { email: "duplicate@example.com" },
      { phone: "1234567890" },
      { phone: "0987654321" },
    ],
  });

  await request(app).post("/api/users/signup").send({
    firstName: "Supplier Test",
    lastName: "User",
    email: "suppliertester@gmail.com",
    primaryPhone: "9800000101",
    password: "Test@123",
    role: "shop_owner",
  });

  const loginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800000101",
    password: "Test@123",
  });

  authToken = loginRes.body.data.token;
});

afterAll(async () => {
  await User.deleteMany({ email: "suppliertester@gmail.com" });
  await Supplier.deleteMany({
    $or: [
      { name: "Test Supplier" },
      { name: "Another Supplier" },
      { email: "test@example.com" },
      { email: "duplicate@example.com" },
      { email: "another.update@example.com" },
      { phone: "1234567890" },
      { phone: "0987654321" },
    ],
  });
  await mongoose.connection.close();
});

describe("Supplier APIs", () => {
  test("should create a new supplier", async () => {
    const res = await request(app)
      .post("/api/suppliers/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Test Supplier",
        email: "test@example.com",
        phone: "1234567890",
        address: "123 Test St",
        notes: "Some notes about the supplier",
        isActive: true,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("_id");
    expect(res.body.data.name).toBe("Test Supplier");
    expect(res.body.data.email).toBe("test@example.com");

    testSupplierId = res.body.data._id;
  });

  test("should fail to create supplier with duplicate email", async () => {
    const res = await request(app)
      .post("/api/suppliers/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Another Supplier",
        email: "test@example.com",
        phone: "0987654321",
        address: "456 Another St",
        isActive: true,
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Supplier with this email already exists.");
  });

  test("should fail to create supplier with duplicate phone", async () => {
    const res = await request(app)
      .post("/api/suppliers/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Yet Another Supplier",
        email: "yetanother@example.com",
        phone: "1234567890",
        address: "789 Yet Another St",
        isActive: true,
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe(
      "Supplier with this phone number already exists."
    );
  });

  test("should create another supplier for update tests", async () => {
    const res = await request(app)
      .post("/api/suppliers/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Another Supplier for Update",
        email: "another.update@example.com",
        phone: "9998887776",
        address: "Update Address",
        isActive: true,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    anotherSupplierId = res.body.data._id;
  });

  test("should retrieve all suppliers", async () => {
    const res = await request(app)
      .get("/api/suppliers")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.data)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
  });

  test("should retrieve only active suppliers when isActive is true", async () => {
    await request(app)
      .patch(`/api/suppliers/supplier/deactivate/${anotherSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/suppliers?isActive=true")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.every((s) => s.isActive)).toBe(true);
    expect(res.body.data.data.some((s) => s._id === testSupplierId)).toBe(true);
    expect(res.body.data.data.some((s) => s._id === anotherSupplierId)).toBe(
      false
    );
  });

  test("should retrieve only inactive suppliers when isActive is false", async () => {
    const res = await request(app)
      .get("/api/suppliers?isActive=false")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.every((s) => !s.isActive)).toBe(true);
    expect(res.body.data.data.some((s) => s._id === anotherSupplierId)).toBe(
      true
    );
  });

  test("should search suppliers by name", async () => {
    const res = await request(app)
      .get("/api/suppliers?search=Test")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.data[0].name).toContain("Test");
  });

  test("should search suppliers by email", async () => {
    const res = await request(app)
      .get("/api/suppliers?search=example")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.data[0].email).toContain("example");
  });

  test("should search suppliers by phone", async () => {
    const res = await request(app)
      .get("/api/suppliers?search=999")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.data[0].phone).toContain("999");
  });

  test("should retrieve suppliers with pagination", async () => {
    const res = await request(app)
      .get("/api/suppliers?page=1&limit=1")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data.length).toBe(1);
    expect(res.body.data.pagination.currentPage).toBe(1);
    expect(res.body.data.pagination.limit).toBe(1);
    expect(res.body.data.pagination.totalItems).toBeGreaterThanOrEqual(2);
  });

  test("should retrieve suppliers sorted by name ascending", async () => {
    const res = await request(app)
      .get("/api/suppliers?sortBy=name&sortOrder=asc")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    if (res.body.data.data.length >= 2) {
      expect(
        res.body.data.data[0].name.localeCompare(res.body.data.data[1].name)
      ).toBeLessThanOrEqual(0);
    }
  });

  test("should retrieve a single supplier by ID", async () => {
    const res = await request(app)
      .get(`/api/suppliers/supplier/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(testSupplierId.toString());
    expect(res.body.data.name).toBe("Test Supplier");
  });

  test("should return 404 when retrieving non-existent supplier", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .get(`/api/suppliers/supplier/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Supplier not found.");
  });

  test("should update an existing supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/update/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Updated Test Supplier",
        notes: "Updated notes for the supplier",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Updated Test Supplier");
    expect(res.body.data.notes).toBe("Updated notes for the supplier");
  });

  test("should return 'No changes detected' when updating with same data", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/update/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Updated Test Supplier",
        email: "test@example.com",
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("No changes detected.");
  });

  test("should fail to update supplier with duplicate email of another supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/update/${anotherSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        email: "test@example.com",
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe(
      "You already have a supplier with this email."
    );
  });

  test("should fail to update supplier with duplicate phone of another supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/update/${anotherSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        phone: "1234567890",
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe(
      "You already have a supplier with this phone number."
    );
  });

  test("should return 404 when updating non-existent supplier", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/suppliers/supplier/update/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "Non Existent Update",
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Supplier not found.");
  });

  test("should deactivate a supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/deactivate/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Supplier deactivated successfully.");

    const supplier = await Supplier.findById(testSupplierId);
    expect(supplier.isActive).toBe(false);
  });

  test("should return 400 when deactivating an already inactive supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/deactivate/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Supplier is already inactive.");
  });

  test("should return 404 when deactivating non-existent supplier", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/suppliers/supplier/deactivate/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Supplier not found.");
  });

  test("should activate a supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/activate/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Supplier activated successfully.");

    const supplier = await Supplier.findById(testSupplierId);
    expect(supplier.isActive).toBe(true);
  });

  test("should return 400 when activating an already active supplier", async () => {
    const res = await request(app)
      .patch(`/api/suppliers/supplier/activate/${testSupplierId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Supplier is already active.");
  });

  test("should return 404 when activating non-existent supplier", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .patch(`/api/suppliers/supplier/activate/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Supplier not found.");
  });
});
