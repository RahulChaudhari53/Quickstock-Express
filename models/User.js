const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },    
    email: { type: String, required: true, lowercase: true, unique: true },
    phoneNumbers: { type: [String], default: [], required: true },         
    password: { type: String, required: true },
    profileUrl : {type:String}
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;