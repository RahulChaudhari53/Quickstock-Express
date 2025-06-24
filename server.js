//server.js
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config();

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
