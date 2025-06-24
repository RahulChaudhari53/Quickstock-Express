// tests/user.test.js
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");

let testUserId;
let authToken;
beforeAll(async () => {
  await User.deleteOne({ email: "sita@gmail.com" });
  await User.deleteOne({ email: "conflict@example.com" });
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("User Register and Login", () => {
  test("should return 400 when required fields are missing during registration", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      email: "sita@gmail.com",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("Last name is required.");
  });

  test("should register a user successfully", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      lastName: "Devi",
      email: "sita@gmail.com",
      primaryPhone: "9800000000",
      password: "Sita@123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("_id");
    expect(res.body.data).not.toHaveProperty("password");

    testUserId = res.body.data._id;
  });

  test("should not register a user with duplicate email", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      lastName: "Devi",
      email: "sita@gmail.com",
      primaryPhone: "9800000061",
      password: "Sita@123",
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Email is already registered");
  });

  test("should not register a user with duplicate phone number", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      lastName: "Devi",
      email: "sita56@gmail.com",
      primaryPhone: "9800000000",
      password: "Sita@123",
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("Phone number is already registered");
  });

  test("should login user with valid phone and password", async () => {
    const res = await request(app).post("/api/users/login").send({
      phoneNumber: "9800000000",
      password: "Sita@123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty("user");
    expect(res.body.data).toHaveProperty("token");

    authToken = res.body.data.token;
  });

  test("should return 401 for invalid login credentials", async () => {
    const res = await request(app).post("/api/users/login").send({
      phoneNumber: "9800000000",
      password: "sita@123",
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid credentials.");
  });
});

describe("Protected User Apis", () => {
  test("should fail to update user info when no auth authToken is provided", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateUserInfo`)
      .send({ firstName: "Updated", lastName: "User" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Authentication required.");
  });

    test("should update user info (firstName and lastName)", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateUserInfo`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ firstName: "Updated", lastName: "User" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.firstName).toBe("Updated");
    expect(res.body.data.lastName).toBe("User");
  });

  test("should fail to update user info when missing fields", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateUserInfo`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ firstName: "Updated" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Both firstName and lastName are required.");
  });

    test("should update password", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updatePassword`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ oldPassword: "Sita@123", newPassword: "NewPass@123" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Password updated successfully.");
  });

  test("should fail update password with wrong old password", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updatePassword`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ oldPassword: "WrongOld", newPassword: "NewPass@123" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Incorrect old password.");
  });

});
