const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema({
  teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: String,
    required: true,
    trim: true
    // Example: "ITPE - 4"
  },
  code: {
    type: String,
    required: true,
    trim: true
    // Example: "4ITPE3"
  },
  section: {
    type: String,
    required: true,
    trim: true
    // Example: "Section 1"
  },
  days: {
    type: String,
    required: true
    // Example: "Wednesday"
  },
  start_time: {
    type: String,
    required: true
    // Example: "13:00" (use 24hr format for easy comparison)
  },
  end_time: {
    type: String,
    required: true
    // Example: "16:00"
  },
  // "Non-uniform time": a different start/end per day, e.g. [{ day: "Monday", start_time: "08:00", end_time: "09:00" }, ...].
  // Empty = every day uses start_time / end_time. When filled, start_time / end_time hold the first day's times
  // (used on a day that isn't in the list).
  times: {
    type: [{ _id: false, day: String, start_time: String, end_time: String }],
    default: []
  },
  late_after: {
    type: Number,
    default: null,
    min: 0,
    max: 120
    // Minutes after the start a scan still counts as Present. null = LATE_AFTER_MINUTES from .env (15)
  },
  pinned: {
    type: Boolean,
    default: false
    // Teacher pins a class to the top of the dashboard
  }
}, { timestamps: true });

module.exports = mongoose.model('Class', ClassSchema);