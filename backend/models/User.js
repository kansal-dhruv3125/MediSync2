const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Login identity shown in the existing UI ("Logged in as <username>")
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username must be at most 30 characters"],
      match: [/^[a-z0-9_]+$/, "Username may only contain letters, numbers and underscores"],
    },
    // Email is required for duplicate-email rejection and is normalized to lowercase
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address"],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned unless explicitly requested
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

userSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
