const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware checks if the request has a valid token.
// Add it to any route that requires the user to be logged in.
// It also makes sure the account still exists and puts { id, role } on req.user.
async function auth(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();

  if (!token) {
    return res.status(401).json({ message: 'No token. Access denied.' });
  }

  let decoded;
  try {
    // only accept the algorithm we sign with (blocks "alg: none" and algorithm-swap tricks)
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }

  try {
    const user = await User.findById(decoded.id).select('user_type token_version email_verified').lean();
    if (!user) return res.status(401).json({ message: 'Account no longer exists.' });
    // the password was changed after this login was made (e.g. "forgot password") -> log in again
    if ((decoded.v || 0) !== (user.token_version || 0)) {
      return res.status(401).json({ message: 'Your password was changed. Please log in again.' });
    }
    req.user = { id: String(user._id), role: user.user_type, verified: user.email_verified !== false };
    next();
  } catch (err) {
    next(err);
  }
}

// Only these account types may use a route, e.g. router.use(auth, auth.only('Educator', 'Admin'))
auth.only = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Only teachers can manage classes and attendance.', code: 'NOT_EDUCATOR' });
  }
  next();
};

// The email must be verified first (the 6-digit code sent at sign-up), e.g. router.use(auth, auth.verified)
auth.verified = (req, res, next) => {
  if (!req.user?.verified) {
    return res.status(403).json({ message: 'Verify your email first. Enter the code we sent you.', code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
};

module.exports = auth;
