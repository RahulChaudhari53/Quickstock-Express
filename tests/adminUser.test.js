// tests/adminUser.test.js
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
    phoneNumber: "9898981910",
    password: "Admin@123",
  });
  adminUserId = adminLoginRes.body.data.user._id.toString();
  adminToken = adminLoginRes.body.data.token;

  const hashedPasswordRegular = await bcrypt.hash("Ram@12345", 10);
  const regularUser = await User.create({
    firstName: "Ram",
    lastName: "Bahadur",
    email: "ram-bahadur@quickstock.com",
    primaryPhone: "9800444444",
    password: hashedPasswordRegular,
  });
  regularUserId = regularUser._id.toString();

  const regularLoginRes = await request(app).post("/api/users/login").send({
    phoneNumber: "9800444444",
    password: "Ram@12345",
  });
  regularUserToken = regularLoginRes.body.data.token;

  // Create a user specifically for the 'make admin' test
  const hashedPasswordPromote = await bcrypt.hash("PromoteMe@123", 10);
  const userToPromote = await User.create({
    firstName: "Promote",
    lastName: "Me",
    email: "promoteme@quickstock.com",
    primaryPhone: "9876543210",
    password: hashedPasswordPromote,
    role: "shop_owner",
  });
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
});
