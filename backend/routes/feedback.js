const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const { HttpError, wrap, str } = require('../lib/attendance');
const { sendMail } = require('../lib/mail');
const log = require('../lib/log');

const KINDS = ['Bug', 'Idea', 'Other'];
const MAX_MESSAGE = 1000;
const PER_HOUR = 5; // per teacher

// ─────────────────────────────────────────
// POST /api/feedback   body { kind: "Bug" | "Idea" | "Other", message, app_version?, platform? }
// Saved in the database and, when email is set up, sent to FEEDBACK_TO (default: SMTP_USER, the team inbox).
// ─────────────────────────────────────────
router.post('/', authMiddleware, authMiddleware.verified, wrap(async (req, res) => {
  const kind = KINDS.includes(req.body.kind) ? req.body.kind : null;
  const message = str(req.body.message, MAX_MESSAGE, true);
  if (!kind) throw new HttpError(400, 'Pick Bug, Idea or Other.');
  if (message.length < 5) throw new HttpError(400, 'Write a little more so we know what you mean.');

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  if (await Feedback.countDocuments({ user_id: req.user.id, createdAt: { $gt: hourAgo } }) >= PER_HOUR) {
    throw new HttpError(429, 'You sent a lot of feedback this hour. Please try again later.', 'RATE_LIMITED');
  }

  const fb = await Feedback.create({
    user_id: req.user.id,
    kind,
    message,
    app_version: str(req.body.app_version, 20),
    platform: str(req.body.platform, 30),
  });

  // email the team; the feedback is already saved, so a mail problem never fails the request
  // (email not set up: printed in the server terminal while testing, skipped on a production server)
  const user = await User.findById(req.user.id, 'full_name email');
  sendMail({
    to: process.env.FEEDBACK_TO || process.env.SMTP_USER || 'the team',
    subject: `GakuPres feedback: ${kind}`, // only fixed text in the subject (never what the user typed)
    text: `From: ${user?.full_name} <${user?.email}>\nApp: ${fb.app_version || '?'} on ${fb.platform || '?'}\n\n${message}\n`,
  }).catch((e) => log.error('Feedback email failed:', e.message));

  res.status(201).json({ message: 'Thanks! Your feedback was sent.' });
}));

module.exports = router;
