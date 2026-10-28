const mongoose = require("mongoose");

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const medicationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Fields below mirror the existing frontend medication object exactly
    name: {
      type: String,
      required: [true, "Medication name is required"],
      trim: true,
      maxlength: [100, "Medication name must be at most 100 characters"],
    },
    dose: {
      type: String,
      required: [true, "Dose is required"],
      trim: true,
      maxlength: [50, "Dose must be at most 50 characters"],
    },
    frequency: {
      type: Number,
      required: [true, "Frequency is required"],
      min: [1, "Frequency must be between 1 and 4"],
      max: [4, "Frequency must be between 1 and 4"],
    },
    // First dose time of the day, "HH:MM" (24h), same format as <input type="time">
    startTime: {
      type: String,
      required: [true, "First dose time is required"],
      match: [TIME_PATTERN, "Time must be in 24h HH:MM format"],
    },
    // Optional minimum gap from other medicines, in hours (0-12), from the frontend select
    customGapHours: {
      type: Number,
      min: [0, "Custom gap must be between 0 and 12"],
      max: [12, "Custom gap must be between 0 and 12"],
      default: 0,
    },
    // Derived dose times ("HH:MM"), computed by the backend so the stored
    // record stays authoritative even if the client sends a stale value
    doseTimes: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must be at most 500 characters"],
      default: "",
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

medicationSchema.set("toJSON", {
  transform(_doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model("Medication", medicationSchema);
