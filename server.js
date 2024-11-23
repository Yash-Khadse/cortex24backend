const express = require("express");
const app = express();
const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Registration = require("./models/Registration");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");
const session = require("express-session");
require("dotenv").config();

// MongoDB User model
const User = require("./models/Admin");

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret-key",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true, maxAge: 3600000 }, // Adjust maxAge for session expiry
  })
);
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Passport setup
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      console.log("Looking for user:", username);
      const user = await User.findOne({ username });

      if (!user) {
        console.log("User not found");
        return done(null, false, { message: "Incorrect username" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      console.log("Password comparison result:", isMatch);

      if (!isMatch) {
        return done(null, false, { message: "Incorrect password" });
      }

      console.log("Authentication successful");
      return done(null, user);
    } catch (err) {
      console.error("Error in LocalStrategy:", err);
      return done(err);
    }
  })
);

// Serialize and deserialize user for session management
passport.serializeUser((user, done) => {
  console.log("Serializing user:", user.id);
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    console.log("Deserializing user with ID:", id);
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    console.error("Error in deserialization:", err);
    done(err, null);
  }
});

// Admin registration route
app.post("/api/admin/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const existingAdmin = await User.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({ error: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newAdmin = new User({ username, password: hashedPassword });
    await newAdmin.save();

    res.status(201).json({ message: "Admin created successfully" });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ error: "Error creating admin" });
  }
});

// Admin login route
app.post("/api/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("Authentication error:", err);
      return res.status(500).json({ error: "Server error" });
    }

    if (!user) {
      console.log("Authentication failed:", info.message);
      return res.status(401).json({ error: info.message });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed" });
      }

      console.log("Login successful:", user.username);
      res.status(200).json({ message: "Login successful" });
    });
  })(req, res, next);
});

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized access" });
}

// Admin dashboard route
app.get("/admin/dashboard", isAuthenticated, async (req, res) => {
  try {
    const registrations = await Registration.find();
    res.json(registrations);
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({ error: "Error retrieving registrations" });
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.status(200).json({ message: "Logout successful" });
  });
});

// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Registration endpoint
app.post("/api/register", async (req, res) => {
  try {
    const registration = new Registration(req.body);
    await registration.save();

    const amount = 149900; // Amount in paise
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `receipt_${registration._id}`,
    });

    res.status(201).json({
      message: "Registration successful",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ error: "Error registering team" });
  }
});

// Payment verification
app.post("/api/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const generatedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (generatedSignature === razorpay_signature) {
    res
      .status(200)
      .json({ success: true, message: "Payment verified successfully" });
  } else {
    res
      .status(400)
      .json({ success: false, message: "Payment verification failed" });
  }
});

// Fetch all registrations
app.get("/api/registrations", async (req, res) => {
  try {
    const registrations = await Registration.find();
    res.json(registrations);
  } catch (error) {
    console.error("Error retrieving registrations:", error);
    res.status(500).json({ error: "Error retrieving registrations" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
