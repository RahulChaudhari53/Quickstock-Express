const request = require("supertest");
const app = require("../app");
const mongoose = require("mongoose");
const User = require("../models/User");
const Category = require("../models/Category");

let authToken;
let testCategoryId;

beforeAll(async () => {
  const userRes = await request(app).post("/api/users/signup").send({
    firstName: "Category Test",
    lastName: "User",
    email: "categorytester@gmail.com",
    primaryPhone: "9800000100",
    password: "Test@123",
    role: "shop_owner",
  });

  // Login
  const loginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800000100",
    password: "Test@123",
  });

  authToken = loginRes.body.data.token;
});

afterAll(async () => {
  await User.deleteMany({ email: "categorytester@gmail.com" });
  await Category.deleteMany({ name: "TestCategory" });
  await mongoose.connection.close();
});

describe("Category APIs", () => {
  test("should create a new category", async () => {
    const res = await request(app)
      .post("/api/categories/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "TestCategory",
        description: "Test Description",
        isActive: true,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("_id");
    expect(res.body.data.name).toBe("TestCategory");

    testCategoryId = res.body.data._id;
  });

  test("should fail to create duplicate category", async () => {
    const res = await request(app)
      .post("/api/categories/create")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        name: "TestCategory",
        description: "Duplicate Test",
        isActive: true,
      });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Category with this name already exists.");
  });

  test("should retrieve all categories", async () => {
    const res = await request(app)
      .get("/api/categories/")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.categories)).toBe(true);
  });

  test("should retrieve a single category by ID", async () => {
    const res = await request(app)
      .get(`/api/categories/category/${testCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(testCategoryId);
  });

  test("should deactivate (soft delete) the category", async () => {
    const res = await request(app)
      .delete(`/api/categories/category/deactivate/${testCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Category deactivated successfully.");

    const category = await Category.findById(testCategoryId);
    expect(category.isActive).toBe(false);
  });

  test("should activate the category", async () => {
    const res = await request(app)
      .patch(`/api/categories/category/activate/${testCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    const category = await Category.findById(testCategoryId);
    expect(category.isActive).toBe(true);
  });

  test("should return 400 when activating an already active category", async () => {
    const res = await request(app)
      .patch(`/api/categories/category/activate/${testCategoryId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Category is already active.");
  });

  test("should return 404 when retrieving non-existing category", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .get(`/api/categories/category/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Category not found.");
  });

  test("should return 404 when deleting non-existing category", async () => {
    const fakeId = "507f1f77bcf86cd799439011";
    const res = await request(app)
      .delete(`/api/categories/category/deactivate/${fakeId}`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Category not found.");
  });
});
