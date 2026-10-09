const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema({
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true
  },
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Excuse', 'Absent'],
    default: 'Absent'
  },
  scanned_at: {
    type: Date,
    default: null
    // Set when the student scans their QR code
  },
  scan_time: {
    type: String,
    default: null
    // "13:05" = the teacher's local time of the scan (null = never scanned, set by hand)
  },
  conflict: {
    // Proxy-scan warning: the same school ID was scanned the same day in another class whose time
    // overlaps this one. Both records get it. other_label is only kept when it's the same teacher.
    type: new mongoose.Schema({
      time: String,                                  // the other scan's local time
      other_class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      same_teacher: Boolean,
      other_label: String,                           // "4ITPE3 - Section 1" (same teacher only)
    }, { _id: false }),
    default: null
  },
  manually_overridden: {
    type: Boolean,
    default: false
    // Set to true when teacher manually changes the status
  }
}, { timestamps: true });

// one record per student per session
AttendanceRecordSchema.index({ session_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
