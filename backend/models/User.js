const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  user_type: {
    type: String,
    enum: ['Educator', 'Student', 'Admin'],
    default: 'Educator',
  },
  bio: {
    type: String,
    default: '',
    maxlength: 150
  },
  avatar: {
    type: String,
    default: null
    // small base64 data URL of the profile picture
  },
  // "Forgot password": a 6-digit code (stored only as a hash), valid until reset_expires, 5 tries
  reset_code_hash: { type: String, default: null },
  reset_expires: { type: Date, default: null },
  reset_attempts: { type: Number, default: 0 },
  // goes up by 1 when the password changes: logins made with an older number stop working
  token_version: { type: Number, default: 0 },
  // Email check at sign-up: false until the 6-digit code from the email is entered.
  // No default on purpose: accounts made before this existed have no value and count as verified.
  email_verified: { type: Boolean },
  verify_code_hash: { type: String, default: null },
  verify_expires: { type: Date, default: null },
  verify_attempts: { type: Number, default: 0 },
  verify_sent_at: { type: Date, default: null } // for the 15-second wait between "send a new code"
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);