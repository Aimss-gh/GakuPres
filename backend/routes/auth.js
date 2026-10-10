const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');
const Class = require('../models/Class');
const Feedback = require('../models/Feedback');
const { HttpError, wrap, str, deleteClassDeep } = require('../lib/attendance');

const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({
  id: u._id,
  full_name: u.full_name,
  email: u.email,
  user_type: u.user_type,
  bio: u.bio || '',
  avatar: u.avatar || null,
  email_verified: u.email_verified !== false // older accounts (no value) count as verified
});

// "Remember me" keeps the login for 30 days, otherwise 7.
// The token only holds the user id (a token can be read by anyone who has it, so no personal data in it).
const signToken = (user, remember) => jwt.sign(
  { id: String(user._id), v: user.token_version || 0 },
  process.env.JWT_SECRET,
  { algorithm: 'HS256', expiresIn: remember ? '30d' : '7d' }
);

// compared against when the email doesn't exist, so a wrong email takes as long as a wrong password
// (otherwise the response time tells an attacker which emails have accounts)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// password guessing protection: per IP address
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const registerLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many sign-ups from this network. Try again later.' });

// ─────────────────────────────────────────
// POST /api/auth/register
// body { full_name, email, password }  -> { token, user }   (always an Educator account)
// ─────────────────────────────────────────
router.post('/register', registerLimit, wrap(async (req, res) => {
  const full_name = str(req.body.full_name, 80);
  const email = str(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!full_name || !email || !password) throw new HttpError(400, 'Please fill in every field.');
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  if (password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters.`);
  if (password.length > 128) throw new HttpError(400, 'Password is too long.');
  await freeStaleEmail(email);
  if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered.');

  // the account starts unverified: a 6-digit code is emailed, and class routes stay locked until it's entered
  const user = await User.create({ full_name, email, password: await bcrypt.hash(password, 10), user_type: 'Educator', email_verified: false });
  // no email could be sent -> remove the account again, so signing up once more works
  let sent = false;
  try { sent = await sendVerifyCode(user); } catch (e) { await user.deleteOne(); throw e; }
  if (!sent) {
    await user.deleteOne();
    throw new HttpError(503, 'Sign-up needs email, which is not set up on this server yet.', 'MAIL_NOT_SET_UP');
  }
  res.status(201).json({ message: 'Account created. Check your email for the code.', token: signToken(user), user: publicUser(user) });
}));

// ─────────────────────────────────────────
// POST /api/auth/login
// body { email, password, remember }  -> { token, user }
// ─────────────────────────────────────────
router.post('/login', loginLimit, wrap(async (req, res) => {
  const email = str(req.body.email, 254).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) throw new HttpError(400, 'Enter your email and password.');

  const user = await User.findOne({ email });
  const match = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !match) {
    throw new HttpError(400, 'Invalid email or password.');
  }
  res.json({ message: 'Login successful.', token: signToken(user, !!req.body.remember), user: publicUser(user) });
}));

// ─────────────────────────────────────────
// GET /api/auth/me   (the app asks "who am I?" when it opens)
// ─────────────────────────────────────────
router.get('/me', authMiddleware, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: publicUser(user) });
}));

// A profile picture must be a real JPEG or PNG, not just text that says it is one:
// "data:image/jpeg;base64,<clean base64>" whose bytes start with the JPEG/PNG file signature.
// The app sends 256x256 JPEGs (~20 KB); 600 000 characters (~450 KB) leaves room for older ones.
const AVATAR_MAX = 600000;
const SIGNATURE = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] };
function isPicture(v) {
  if (typeof v !== 'string' || v.length > AVATAR_MAX) return false;
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v);
  if (!m || m[2].length % 4) return false;
  const bytes = Buffer.from(m[2], 'base64');
  return bytes.length > 100 && SIGNATURE[m[1]].every((b, i) => bytes[i] === b);
}

// ─────────────────────────────────────────
// PATCH /api/auth/me   body { full_name, bio, avatar }
// avatar = small "data:image/jpeg;base64,..." or null
// ─────────────────────────────────────────
router.patch('/me', authMiddleware, wrap(async (req, res) => {
  const { full_name, bio, avatar } = req.body;

  if (!str(full_name, 80)) throw new HttpError(400, 'Name cannot be empty.');
  if (avatar && !isPicture(avatar)) throw new HttpError(400, 'Profile picture is invalid or too big.');

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { full_name: str(full_name, 80), bio: str(bio, 150, true), avatar: avatar || null },
    { new: true, runValidators: true }
  );
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  res.json({ user: publicUser(user) });
}));

// ─────────────────────────────────────────
// "Forgot password"
// POST /api/auth/forgot   body { email }                  -> always the same answer (never tells if the email exists)
// POST /api/auth/reset    body { email, code, password }  -> { token, user }  (logged in with the new password)
// The 6-digit code is emailed, kept only as a hash, works for 15 minutes and allows 5 tries.
// ─────────────────────────────────────────
const crypto = require('crypto');
const { sendMail } = require('../lib/mail');
const CODE_MINUTES = 15;
const CODE_TRIES = 5;
const hashCode = (code) => crypto.createHash('sha256').update(`${process.env.JWT_SECRET}:${code}`).digest('hex');
const sameHash = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const forgotLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Too many reset requests. Try again in an hour.' });
const resetLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const SENT = 'If that email has an account, a 6-digit code was sent to it. Check your inbox (and spam).';

router.post('/forgot', forgotLimit, wrap(async (req, res) => {
  const email = str(req.body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.');

  const user = await User.findOne({ email });
  if (user) {
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    user.reset_code_hash = hashCode(code);
    user.reset_expires = new Date(Date.now() + CODE_MINUTES * 60 * 1000);
    user.reset_attempts = 0;
    await user.save();
    const sent = await sendMail({
      to: user.email,
      subject: 'Your GakuPres password reset code',
      text: `Hi ${user.full_name},\n\nYour GakuPres password reset code is: ${code}\n\nIt works for ${CODE_MINUTES} minutes. If you didn't ask for this, ignore this email - your password stays the same.\n`,
    });
    if (!sent) throw new HttpError(503, 'Password reset by email is not set up on this server yet.', 'MAIL_NOT_SET_UP');
  }
  res.json({ message: SENT });
}));

router.post('/reset', resetLimit, wrap(async (req, res) => {
  const email = str(req.body.email, 254).toLowerCase();
  const code = str(req.body.code, 6);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (password.length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters.`);
  if (password.length > 128) throw new HttpError(400, 'Password is too long.');

  const wrong = new HttpError(400, 'That code is wrong or has expired. Ask for a new one.', 'BAD_CODE');
  const user = await User.findOne({ email });
  if (!user || !user.reset_code_hash || !user.reset_expires || user.reset_expires < new Date() || user.reset_attempts >= CODE_TRIES) throw wrong;
  if (!/^\d{6}$/.test(code) || !sameHash(hashCode(code), user.reset_code_hash)) {
    user.reset_attempts += 1;
    await user.save();
    throw wrong;
  }

  user.password = await bcrypt.hash(password, 10);
  user.reset_code_hash = null;
  user.reset_expires = null;
  user.reset_attempts = 0;
  user.token_version = (user.token_version || 0) + 1; // every older login (other phones) stops working
  if (user.email_verified === false) clearVerify(user); // the emailed code proves the email is theirs
  await user.save();
  res.json({ message: 'Password changed.', token: signToken(user), user: publicUser(user) });
}));

// ─────────────────────────────────────────
// Email check at sign-up
// POST /api/auth/verify          body { code }   -> { user }   (logged in, not verified yet)
// POST /api/auth/verify/resend                   -> { message }  a new code (15 seconds between codes)
// POST /api/auth/verify/email    body { email }  -> { user, message }  typo in the email: change it, new code
// Same rules as the reset code: emailed, stored only as a hash, 15 minutes, 5 tries.
// Class and feedback routes answer 403 EMAIL_NOT_VERIFIED until this is done.
// ─────────────────────────────────────────
const RESEND_SECONDS = 15; // wait between codes (also in the app: VerifyEmail.js WAIT_S)
const STALE_HOURS = 24;
const verifyLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }); // per IP; each code also allows only 5 tries
const sendLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many codes asked for. Try again in an hour.' });
const verifyHash = (code) => hashCode(`verify:${code}`); // never the same hash as a reset code

function clearVerify(user) {
  user.email_verified = true;
  user.verify_code_hash = null;
  user.verify_expires = null;
  user.verify_attempts = 0;
}

// new code -> saved as a hash -> emailed. false = email isn't set up on a production server
async function sendVerifyCode(user) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  user.verify_code_hash = verifyHash(code);
  user.verify_expires = new Date(Date.now() + CODE_MINUTES * 60 * 1000);
  user.verify_attempts = 0;
  user.verify_sent_at = new Date();
  await user.save();
  return sendMail({
    to: user.email,
    subject: 'Your GakuPres verification code',
    text: `Hi ${user.full_name},\n\nYour GakuPres verification code is: ${code}\n\nEnter it in the app to finish signing up. It works for ${CODE_MINUTES} minutes.\nIf you didn't sign up for GakuPres, ignore this email.\n`,
  });
}

// Someone signed up with an email that isn't theirs and never verified it: after a day the real
// owner can sign up with it (the stale account had nothing - class routes were locked).
async function freeStaleEmail(email) {
  await User.deleteOne({ email, email_verified: false, createdAt: { $lt: new Date(Date.now() - STALE_HOURS * 3600 * 1000) } });
}

const waitLeft = (user) => Math.ceil(((user.verify_sent_at?.getTime() || 0) + RESEND_SECONDS * 1000 - Date.now()) / 1000);
const tooSoon = (s) => new HttpError(429, `Wait ${s} seconds before asking for a new code.`, 'WAIT');

router.post('/verify', authMiddleware, verifyLimit, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  if (user.email_verified === false) {
    const code = str(req.body.code, 6);
    const wrong = new HttpError(400, 'That code is wrong or has expired. Ask for a new one.', 'BAD_CODE');
    if (!user.verify_code_hash || !user.verify_expires || user.verify_expires < new Date() || user.verify_attempts >= CODE_TRIES) throw wrong;
    if (!/^\d{6}$/.test(code) || !sameHash(verifyHash(code), user.verify_code_hash)) {
      user.verify_attempts += 1;
      await user.save();
      throw wrong;
    }
    clearVerify(user);
    await user.save();
  }
  res.json({ message: 'Email verified.', user: publicUser(user) });
}));

router.post('/verify/resend', authMiddleware, sendLimit, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  if (user.email_verified !== false) throw new HttpError(400, 'Your email is already verified.', 'ALREADY_VERIFIED');
  const s = waitLeft(user);
  if (s > 0) throw tooSoon(s);
  if (!(await sendVerifyCode(user))) throw new HttpError(503, 'Email is not set up on this server yet.', 'MAIL_NOT_SET_UP');
  res.json({ message: `A new code was sent to ${user.email}.` });
}));

router.post('/verify/email', authMiddleware, sendLimit, wrap(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  if (user.email_verified !== false) throw new HttpError(400, 'Your email is already verified.', 'ALREADY_VERIFIED');
  const email = str(req.body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, 'Enter a valid email address.');
  const s = waitLeft(user);
  if (s > 0) throw tooSoon(s);
  if (email !== user.email) {
    await freeStaleEmail(email);
    if (await User.exists({ email })) throw new HttpError(409, 'Email is already registered.');
    user.email = email;
  }
  if (!(await sendVerifyCode(user))) throw new HttpError(503, 'Email is not set up on this server yet.', 'MAIL_NOT_SET_UP');
  res.json({ message: `A new code was sent to ${user.email}.`, user: publicUser(user) });
}));

// ─────────────────────────────────────────
// DELETE /api/auth/me   body { password }
// Deletes the account and EVERYTHING it owns: classes, their students, all attendance and its feedback.
// The password is asked again so a phone left unlocked can't wipe someone's records.
// ─────────────────────────────────────────
const deleteLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
router.delete('/me', authMiddleware, deleteLimit, wrap(async (req, res) => {
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await User.findById(req.user.id);
  if (!user) throw new HttpError(401, 'Account no longer exists.');
  if (!password || !(await bcrypt.compare(password, user.password))) throw new HttpError(400, 'Wrong password.', 'WRONG_PASSWORD');

  const classes = await Class.find({ teacher_id: user._id });
  for (const cls of classes) await deleteClassDeep(cls);
  await Feedback.deleteMany({ user_id: user._id });
  await user.deleteOne();
  res.json({ message: 'Account deleted.', deleted_classes: classes.length });
}));

module.exports = router;
