const mongoose = require('mongoose');

const AttendanceSessionSchema = new mongoose.Schema({
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  date: {
    type: String,
    required: true
    // Format: "YYYY-MM-DD", example: "2026-08-22"
  },
  start_time: {
    type: String,
    default: null
    // "13:20" when the teacher pressed "Start attendance" late that day.
    // Present / Late counts from this time instead of the class start_time. null = use the schedule.
  },
  started_at: {
    type: Date,
    default: null
  },
  closed_time: {
    type: String,
    default: null
    // "14:10" when the teacher pressed "Close attendance". Scans from this time on are refused.
  },
  reopened: {
    type: Boolean,
    default: false
    // true = the teacher reopened scanning, so it stays open even after the class end time
  },
  total_students: {
    type: Number,
    default: 0
  },
  present_count: {
    type: Number,
    default: 0
    // This updates every time a student is marked Present or Late
  }
}, { timestamps: true });

// one session per class per day
AttendanceSessionSchema.index({ class_id: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceSession', AttendanceSessionSchema);
