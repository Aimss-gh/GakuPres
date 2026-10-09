const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  class_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  student_id: {
    type: String,
    required: true,
    trim: true
    // Example: "2021-00123"
  },
  department: {
    type: String,
    required: true,
    trim: true
    // Example: "CCS"
  },
  course: {
    type: String,
    default: '',
    trim: true
    // Example: "BSIT" (read from the student's ID QR)
  },
  qr_code: {
    type: String,
    required: true,
    unique: true
    // Internal unique key generated when the student is added: "GAKU-<student_id>-<class id>".
    // Scanning does NOT use it - the app reads the student ID straight from the ID card QR.
  }
}, { timestamps: true });

// one student ID only once per class
StudentSchema.index({ class_id: 1, student_id: 1 }, { unique: true });

module.exports = mongoose.model('Student', StudentSchema);