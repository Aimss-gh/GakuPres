// Tiny in-memory rate limiter (no extra package). Stops password guessing on login / sign-up.
//   router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }), handler)
// Counts per IP address. If the server runs behind a proxy (Render, Railway, nginx...),
// set TRUST_PROXY=1 in .env so the real client IP is used.
module.exports = function rateLimit({ windowMs, max, message = 'Too many attempts. Please wait a few minutes and try again.' }) {
  const hits = new Map(); // ip -> { count, reset }

  // forget old entries so the map never grows forever
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.reset <= now) hits.delete(ip);
  }, windowMs).unref();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    let h = hits.get(ip);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(ip, h);
    }
    h.count += 1;
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ message, code: 'RATE_LIMITED' });
    }
    next();
  };
};
