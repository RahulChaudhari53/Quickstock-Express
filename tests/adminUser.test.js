const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");
const bcrypt = require("bcrypt");

let adminToken;
let adminUserId;
let regularUserToken;
let regularUserId;
let testUserToPromoteId;
let testUserToPromotePhone;

beforeAll(async () => {
  const adminLoginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "1000000001",
    password: "QuickStock@1234",
  });

  adminUserId = adminLoginRes.body.data.user._id.toString();
  adminToken = adminLoginRes.body.data.token;

  let regularUser = await User.findOne({ primaryPhone: "9800444444" });
  if (!regularUser) {
    regularUser = await User.create({
      firstName: "Ram",
      lastName: "Bahadur",
      email: "ram-bahadur@quickstock.com",
      primaryPhone: "9800444444",
      password: "Ram@12345",
      isActive: true,
    });
  }
  regularUserId = regularUser._id.toString();

  // Login regular user
  const regularLoginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800444444",
    password: "Ram@12345",
  });

  regularUserToken = regularLoginRes.body.data.token;

  let userToPromote = await User.findOne({ primaryPhone: "9876543210" });
  if (!userToPromote) {
    userToPromote = await User.create({
      firstName: "Promote",
      lastName: "Me",
      email: "promoteme@quickstock.com",
      primaryPhone: "9876543210",
      password: "PromoteMe@123",
      isActive: true,
    });
  }
  testUserToPromoteId = userToPromote._id.toString();
  testUserToPromotePhone = userToPromote.primaryPhone;
});

afterAll(async () => {
  await User.deleteOne({ email: "ram-bahadur@quickstock.com" });
  await User.deleteOne({ email: "promoteme@quickstock.com" });
  await User.deleteOne({ email: "anotheruser@quickstock.com" });
  await User.deleteOne({ email: "searchtest@quickstock.com" });
  await User.deleteOne({ email: "filteruser@quickstock.com" });

  await mongoose.connection.close();
});

describe("Admin User Management API", () => {
  describe("Authorization Middleware", () => {
    test("should return 401 if no token is provided for admin routes", async () => {
      const res = await request(app).get("/api/admin/users");
      expect(res.statusCode).toBe(401);
      expect(res.body.message).toBe("Authentication required.");
    });

    test("should return 403 if user is not an admin", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${regularUserToken}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toBe("Admin privilege required.");
    });
  });

  describe("Get all users with filters", () => {
    beforeAll(async () => {
      await User.create([
        {
          firstName: "Search",
          lastName: "User",
          email: "searchtest@quickstock.com",
          primaryPhone: "9999990001",
          password: await bcrypt.hash("Password@123", 10),
          role: "shop_owner",
          isActive: true,
        },
        {
          firstName: "Another",
          lastName: "Person",
          email: "anotheruser@quickstock.com",
          primaryPhone: "9999990002",
          password: await bcrypt.hash("Password@123", 10),
          role: "shop_owner",
          isActive: true,
        },
        {
          firstName: "Filter",
          lastName: "Admin",
          email: "filteruser@quickstock.com",
          primaryPhone: "9999990003",
          password: await bcrypt.hash("Password@123", 10),
          role: "admin",
          isActive: true,
        },
      ]);
    });

    test("should fetch all users (default pagination)", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("users");
      expect(res.body.data.users[0]).not.toHaveProperty("password");
    });

    test("should fetch users with search by first name", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=Search")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users[0].firstName).toBe("Search");
    });

    test("should fetch users with search by primary phone", async () => {
      const res = await request(app)
        .get("/api/admin/users?search=9999990002")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.users[0].primaryPhone).toBe("9999990002");
    });

    test("should fetch users filtered by role 'admin'", async () => {
      const res = await request(app)
        .get("/api/admin/users?role=admin")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.every((user) => user.role === "admin")).toBe(
        true
      );
      expect(res.body.data.users.length).toBeGreaterThanOrEqual(2);
    });

    test("should fetch users with pagination and limit", async () => {
      const res = await request(app)
        .get("/api/admin/users?page=1&limit=2")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.length).toBe(2);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data).toHaveProperty("total");
      expect(res.body.data).toHaveProperty("pages");
    });

    test("should fetch users sorted by createdAt ascending", async () => {
      const res = await request(app)
        .get("/api/admin/users?sort=asc")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      for (let i = 0; i < res.body.data.users.length - 1; i++) {
        const date1 = new Date(res.body.data.users[i].createdAt);
        const date2 = new Date(res.body.data.users[i + 1].createdAt);
        expect(date1.getTime()).toBeLessThanOrEqual(date2.getTime());
      }
    });

    test("should fetch users sorted by createdAt descending", async () => {
      const res = await request(app)
        .get("/api/admin/users?sort=desc")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      for (let i = 0; i < res.body.data.users.length - 1; i++) {
        const date1 = new Date(res.body.data.users[i].createdAt);
        const date2 = new Date(res.body.data.users[i + 1].createdAt);
        expect(date1.getTime()).toBeGreaterThanOrEqual(date2.getTime());
      }
    });
  });

  describe("Get user by ID", () => {
    test("should fetch a user by valid ID", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${regularUserId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("_id", regularUserId);
      expect(res.body.data).not.toHaveProperty("password");
    });

    test("should return 400 for an invalid user ID format", async () => {
      const res = await request(app)
        .get(`/api/admin/users/${"trwtwtrrtwtw"}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid user ID");
    });

    test("should return 404 for a non-existent user ID", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .get(`/api/admin/users/${nonExistentId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });
  });

  describe("Make admin api", () => {
    test("should promote a regular user to admin", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${testUserToPromoteId}/make-admin`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("User promoted to admin successfully");
      expect(res.body.data.role).toBe("admin");

      const updatedUserInDb = await User.findById(testUserToPromoteId);
      expect(updatedUserInDb.role).toBe("admin");
    });

    test("should return an error if user is already an admin", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${adminUserId}/make-admin`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("User is already an admin");
    });

    test("should return 404 if trying to promote a non-existent user", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .patch(`/api/admin/users/${nonExistentId}/make-admin`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("User not found");
    });

    test("should return 400 for an invalid user ID format when promoting", async () => {
      const res = await request(app)
        .patch(`/api/admin/users/${"fafdafafaf2424"}/make-admin`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid user ID");
    });
  });
});
