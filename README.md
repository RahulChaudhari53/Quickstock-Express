# QuickStock Express Backend

## Project Overview

QuickStock Express is a robust backend API built with Node.js and Express.js, designed to manage inventory, sales, purchases, and user accounts efficiently. This system provides a comprehensive set of endpoints for handling product information, category management, supplier details, stock movements, and user authentication.

**Key Feature:** This backend leverages **MongoDB Transactions** to ensure data consistency and atomicity for complex operations, such as creating sales or purchases that involve multiple document updates (e.g., updating stock levels).

## Features

* **User Management:** Register, login, manage user profiles, and secure authentication with JWT.
* **Category Management:** Create, view, update, and manage product categories.
* **Product Management:** Add, retrieve, update, and manage product details.
* **Supplier Management:** Handle supplier information, including creation, retrieval, and updates.
* **Purchase Management:** Track incoming inventory with detailed purchase orders.
* **Sale Management:** Record sales transactions and manage returns/cancellations.
* **Stock Management:** Monitor stock levels and view stock movement history.
* **Dashboard Overview:** Get a quick summary of key business metrics.

## Technologies Used

* **Node.js:** JavaScript runtime environment.
* **Express.js:** Web application framework for Node.js.
* **MongoDB:** NoSQL database for flexible data storage (via Mongoose ODM).
* **Mongoose:** MongoDB object data modeling (ODM) for Node.js, including support for **transactions**.
* **JWT (JSON Web Tokens):** For secure user authentication.
* **Bcrypt:** For password hashing.
* **Joi:** For data validation.
* **Multer:** For handling `multipart/form-data`, primarily for file uploads (e.g., profile images).
* **Nodemailer:** For sending emails (e.g., for forgot password).
* **CORS:** For enabling Cross-Origin Resource Sharing.
* **Dotenv:** For managing environment variables.
* **Nodemon:** For automatically restarting the server during development.
* **Jest & Supertest:** For testing.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* Node.js (LTS version recommended)
* MongoDB (local installation or cloud service like MongoDB Atlas)

### MongoDB Setup (for Transactions)

This backend uses MongoDB transactions, which require a **replica set** configuration. Follow these steps to set up a local replica set:

1.  **Start MongoDB with Replica Set:**
    Open your command prompt or terminal and run the following command. Make sure to replace `D:\mongod\data` with your actual MongoDB data directory.

    ```bash
    mongod --port 27017 --dbpath D:\mongod\data --replSet rs0 --bind_ip 127.0.0.1
    ```

    * `--port 27017`: Specifies the port for MongoDB.
    * `--dbpath D:\mongod\data`: The path to your MongoDB data directory.
    * `--replSet rs0`: Initializes the replica set with the name `rs0`.
    * `--bind_ip 127.0.0.1`: Binds MongoDB to the localhost IP address.

2.  **Initialize the Replica Set:**
    Open a *new* command prompt or terminal window and connect to your MongoDB instance:

    ```bash
    mongosh --port 27017
    ```

    Once connected to the `mongosh` shell, initialize the replica set:

    ```javascript
    rs.initiate();
    ```

    You can verify the replica set status by running:

    ```javascript
    rs.status();
    ```
    You should see `quickstock` as the database name when the replica set is successfully initialized.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd quickstock-express
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create a `.env` file:**
    Create a file named `.env` in the root directory of the project. You can use the provided `.env.example` as a template.

    **`.env.example`:**
    ```env
    MONGO_URI = mongodb://localhost:27017/quickstock?replicaSet=rs0
    PORT = 5050
    JWT_SECRET = my_quickstock_express_backend_jwt_secret
    NODE_ENV = development

    # gmail smtp
    EMAIL_USER = "your_email@example.com"
    EMAIL_PASS = "your_email_app_password"
    CLIENT_URL = "http://localhost:5173"
    ```

    **Important:** Fill in your actual sensitive information in your `.env` file.
    * `MONGO_URI`: Must include `?replicaSet=rs0` for transactions to work with your local setup.
    * `JWT_SECRET`: A strong, random string used to sign your JWTs.
    * `EMAIL_USER` and `EMAIL_PASS`: Credentials for an email account that Nodemailer will use to send emails (e.g., for password resets). If using Gmail, you'll likely need to generate an "App password" for this (refer to Google's documentation on "App passwords").
    * `CLIENT_URL`: The URL of your frontend application.

### Running the Application

To start the development server:

```bash
npm start

The server will typically run on http://localhost:5050.
```


### Running Tests

To run the automated tests:

```bash
npm test
```

# API Endpoints

This section outlines the available API endpoints and their functionalities. All protected routes require a **valid JWT in the `Authorization` header** (e.g., `Bearer <token>`). Many routes also require the `isOwner` middleware, ensuring only authorized users (owners) can perform certain actions.

---

### User Management (`/api/users`)

* **`POST /api/users/signup`**
    * Register a new user.
    * **Body:** `username`, `email`, `password`, `role` (e.g., `owner`, `employee`)
* **`POST /api/users/login`**
    * Log in a user and receive a JWT.
    * **Body:** `email`, `password`
* **`POST /api/users/forgotPassword`**
    * Request a password reset.
    * **Body:** `email`
* **`POST /api/users/verify-otp`**
    * Verify OTP for password reset.
    * **Body:** `email`, `otp`
* **`POST /api/users/resetPassword`**
    * Reset user password after OTP verification.
    * **Body:** `email`, `newPassword`
* **`GET /api/users/me`** (Protected)
    * Get the currently authenticated user's information.
* **`POST /api/users/logout`** (Protected)
    * Log out the current user (invalidates JWT, typically server-side).
* **`PATCH /api/users/updateUserInfo/:userId`** (Protected, `isOwner`, `isSelf`)
    * Update user's general information.
    * **Body:** `username`, `address`, etc.
* **`PATCH /api/users/updatePassword/:userId`** (Protected, `isOwner`, `isSelf`)
    * Update user's password.
    * **Body:** `oldPassword`, `newPassword`
* **`PATCH /api/users/updateEmail/:userId`** (Protected, `isOwner`, `isSelf`)
    * Update user's email address.
    * **Body:** `newEmail`
* **`PATCH /api/users/updateProfileImage/:userId`** (Protected, `isOwner`, `isSelf`, `multipart/form-data`)
    * Upload/update user's profile image.
    * **Body:** `profileImage` (file)
* **`PATCH /api/users/addPhoneNumber/:userId`** (Protected, `isOwner`, `isSelf`)
    * Add a phone number to user's profile.
    * **Body:** `phoneNumber`
* **`PATCH /api/users/deletePhoneNumber/:userId`** (Protected, `isOwner`, `isSelf`)
    * Delete a phone number from user's profile.
    * **Body:** `phoneNumber`
* **`DELETE /api/users/deactivateUser/:userId`** (Protected, `isOwner`, `isSelf`)
    * Deactivate a user account.

---

### Category Management (`/api/categories`)

* **`POST /api/categories/create`** (Protected, `isOwner`)
    * Create a new product category.
    * **Body:** `name`, `description`
* **`GET /api/categories`** (Protected, `isOwner`)
    * Get all product categories.
* **`GET /api/categories/category/:categoryId`** (Protected, `isOwner`)
    * Get a single category by ID.
* **`DELETE /api/categories/category/deactivate/:categoryId`** (Protected, `isOwner`)
    * Deactivate a category (soft delete).
* **`PATCH /api/categories/category/activate/:categoryId`** (Protected, `isOwner`)
    * Activate a deactivated category.

---

### Dashboard (`/api/dashboard`)

* **`GET /api/dashboard/overview`** (Protected, `isOwner`)
    * Get an overview of key dashboard metrics (e.g., total sales, stock value).

---

### Product Management (`/api/products`)

* **`POST /api/products/create`** (Protected, `isOwner`)
    * Create a new product.
    * **Body:** `name`, `description`, `price`, `categoryId`, `supplierId`, `sku`, `initialStock`, etc.
* **`GET /api/products`** (Protected, `isOwner`)
    * Get all products.
* **`GET /api/products/product/:productId`** (Protected, `isOwner`)
    * Get a single product by ID.
* **`PATCH /api/products/product/update/:productId`** (Protected, `isOwner`)
    * Update product details.
    * **Body:** `name`, `description`, `price`, `categoryId`, `supplierId`, `sku`, etc.
* **`DELETE /api/products/product/deactivate/:productId`** (Protected, `isOwner`)
    * Deactivate a product (soft delete).
* **`PATCH /api/products/product/activate/:productId`** (Protected, `isOwner`)
    * Activate a deactivated product.

---

### Purchase Management (`/api/purchases`)

* **`POST /api/purchases/create`** (Protected, `isOwner`)
    * Create a new purchase order.
    * **Body:** `supplierId`, `products` (array of `productId`, `quantity`, `unitPrice`), `purchaseDate`, etc.
* **`GET /api/purchases`** (Protected, `isOwner`)
    * Get all purchase orders.
* **`GET /api/purchases/purchase/:purchaseId`** (Protected, `isOwner`)
    * Get a single purchase order by ID.
* **`PATCH /api/purchases/purchase/update/:purchaseId`** (Protected, `isOwner`)
    * Update details of a purchase order.
    * **Body:** `products`, `status`, etc.
* **`PATCH /api/purchases/purchase/cancel/:purchaseId`** (Protected, `isOwner`)
    * Cancel a purchase order.
* **`PATCH /api/purchases/purchase/receive/:purchaseId`** (Protected, `isOwner`)
    * Mark a purchase order as received (updates stock).

---

### Sale Management (`/api/sales`)

* **`POST /api/sales/create`** (Protected, `isOwner`)
    * Create a new sale.
    * **Body:** `customerId` (optional), `products` (array of `productId`, `quantity`, `unitPrice`), `saleDate`, `paymentMethod`, etc.
* **`GET /api/sales`** (Protected, `isOwner`)
    * Get all sales.
* **`GET /api/sales/sale/:saleId`** (Protected, `isOwner`)
    * Get a single sale by ID.
* **`DELETE /api/sales/sale/cancel/:saleId`** (Protected, `isOwner`)
    * Cancel a sale (e.g., for returns).

---

### Stock Management (`/api/stock`)

* **`GET /api/stock`** (Protected, `isOwner`)
    * Get current stock levels for all products.
* **`GET /api/stock/product/:productId`** (Protected, `isOwner`)
    * Get stock details for a specific product.
* **`GET /api/stock/history/:productId`** (Protected, `isOwner`)
    * Get stock movement history for a specific product.

---

### Supplier Management (`/api/suppliers`)

* **`POST /api/suppliers/create`** (Protected, `isOwner`)
    * Create a new supplier.
    * **Body:** `name`, `contactPerson`, `phoneNumber`, `email`, `address`
* **`GET /api/suppliers`** (Protected, `isOwner`)
    * Get all suppliers.
* **`GET /api/suppliers/supplier/:supplierId`** (Protected, `isOwner`)
    * Get a single supplier by ID.
* **`PATCH /api/suppliers/supplier/update/:supplierId`** (Protected, `isOwner`)
    * Update supplier details.
    * **Body:** `name`, `contactPerson`, `phoneNumber`, `email`, `address`, etc.
* **`PATCH /api/suppliers/supplier/deactivate/:supplierId`** (Protected, `isOwner`)
    * Deactivate a supplier.
* **`PATCH /api/suppliers/supplier/activate/:supplierId`** (Protected, `isOwner`)
    * Activate a deactivated supplier.

---

## Author
Rahul Chaudhari
