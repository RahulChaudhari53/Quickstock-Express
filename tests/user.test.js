const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../app");
const User = require("../models/User");

let testUserId;
let authToken;

afterAll(async () => {
  await User.deleteMany({
    $or: [
      { email: "sita@gmail.com" },
      { primaryPhone: "9800000000" },
      { email: "conflict@example.com" },
    ],
  });
  await mongoose.connection.close();
});

describe("User Register and Login", () => {
  test("should return 400 when required fields are missing during registration", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      email: "sita@gmail.com",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Please fill all required fields.");
  });

  test("should register a user successfully", async () => {
    const res = await request(app).post("/api/users/signup").send({
      firstName: "Sita",
      lastName: "Devi",
      email: "sita@gmail.com",
      primaryPhone: "9800000000",
      password: "Sita@123",
    });

    expect(res.statusCode).toBe(201);
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
    expect(res.body.message).toBe("An account with this email already exists.");
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
    expect(res.body.message).toBe(
      "An account with this phone number already exists."
    );
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

  test("should update email", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateEmail`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ email: "updatedemail@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe("updatedemail@example.com");
  });

  test("should fail to update email to an existing email", async () => {
    await request(app).post("/api/users/signup").send({
      firstName: "Another",
      lastName: "User",
      email: "conflict@example.com",
      primaryPhone: "9800001102",
      password: "Test@1234",
    });

    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateEmail`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ email: "conflict@example.com" });

    expect(res.statusCode).toBe(409);
    expect(res.body.message).toBe("An account with this email already exists.");
  });

  test("should update profile image", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/updateProfileImage`)
      .set("Authorization", `Bearer ${authToken}`)
      .attach("profileImage", "tests/image/confirm1.png");

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Profile image updated successfully.");
    expect(res.body.data).toHaveProperty("profileImage");
  });

  test("should add a secondary phone number", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/addPhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000003" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.secondaryPhone).toContain("9800000003");
  });

  test("should not add more than 2 phone numbers", async () => {
    await request(app)
      .patch(`/api/users/${testUserId}/addPhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000004" });

    const res = await request(app)
      .patch(`/api/users/${testUserId}/addPhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000005" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe("Cannot add more than two phone numbers.");
  });

  test("should delete secondary phone number", async () => {
    const res = await request(app)
      .patch(`/api/users/${testUserId}/deletePhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000003" });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Phone number removed successfully.");
  });

  test("should not delete the only phone number", async () => {
    await request(app)
      .patch(`/api/users/${testUserId}/deletePhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000004" });

    const res = await request(app)
      .patch(`/api/users/${testUserId}/deletePhoneNumber`)
      .set("Authorization", `Bearer ${authToken}`)
      .send({ phoneNumber: "9800000000" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe(
      "Cannot delete the only phone number for the account."
    );
  });

  test("should deactivate user", async () => {
    const res = await request(app)
      .delete(`/api/users/${testUserId}/deactivateUser`)
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("User account deactivated successfully.");
  });
});
