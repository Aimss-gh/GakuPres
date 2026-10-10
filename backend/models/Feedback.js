const mongoose = require('mongoose');

// A message a teacher sent from the app's Feedback screen.
// Deleted together with the account (routes/auth.js DELETE /me).
const FeedbackSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  kind: {
    type: String,
    enum: ['Bug', 'Idea', 'Other'],
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  app_version: {
    type: String,
    default: ''
    // Example: "1.0.0" - helps find which build a bug is in
  },
  platform: {
    type: String,
    default: ''
    // Example: "android 34" or "ios 18.1"
  }
}, { timestamps: true });

FeedbackSchema.index({ user_id: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
