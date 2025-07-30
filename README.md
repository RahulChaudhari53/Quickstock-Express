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

Running Tests
To run the automated tests:

Bash

npm test
