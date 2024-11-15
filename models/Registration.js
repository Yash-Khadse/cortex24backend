// models/Registration.js
const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  roll: String,
  college: String,
});

const registrationSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  members: [teamMemberSchema],
  registrationDate: { type: Date, default: Date.now },
  paymentStatus: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending",
  },
  amount: Number,
});

module.exports = mongoose.model("Registration", registrationSchema);
