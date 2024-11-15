// db.js
const mongoose = require("mongoose");

mongoose
  .connect(
    "mongodb+srv://khadseyash4:Mnharo24Cortex@cluster0.xmldz.mongodb.net/"
  )
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

module.exports = mongoose;
