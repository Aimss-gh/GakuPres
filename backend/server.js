const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Stop early with a clear message instead of failing on the first request
for (const key of ['MONGO_URI', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in .env (copy .env.example to .env and fill it in)`);
    process.exit(1);
  }
}
// a short secret can be guessed, and then anyone can make their own login tokens
if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'your_secret_key_here') {
  const msg = 'JWT_SECRET is too short or still the example value. Use 32+ random characters, e.g. run:\n' +
    `  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;
  if (process.env.NODE_ENV === 'production') {
    console.error(msg);
    process.exit(1);
  }
  console.warn(`WARNING: ${msg}\n(everyone has to log in again after you change it)`);
}

const app = express();
const log = require('./lib/log');

// Don't announce "Express" to the world, and basic safety headers for a JSON API
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // behind Render/nginx/etc: real client IPs for rate limits
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
  });
  next();
});

// One line per request: time, method, path, status, how long it took (never bodies, passwords or tokens).
// LOG_REQUESTS=0 in .env turns it off.
if (process.env.LOG_REQUESTS !== '0') {
  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => log.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - t}ms`));
    next();
  });
}

// Middleware to parse JSON
app.use(express.json({ limit: '1mb' })); // 1mb so profile pictures fit

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classes', require('./routes/classes'));
app.use('/api/feedback', require('./routes/feedback'));

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'GakuPres Backend is running.' });
});

// For hosting health checks: 200 when the database is connected, 503 when it isn't
app.get('/health', (req, res) => {
  const ok = mongoose.connection.readyState === 1;
  res.status(ok ? 200 : 503).json({ ok });
});

// Unknown URL
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// Every error ends here and is sent as { message, code }
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too big.' });
  if (err.status) return res.status(err.status).json({ message: err.message, code: err.code });
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors)[0]?.message || 'Invalid data.' });
  if (err.name === 'CastError') return res.status(404).json({ message: 'Not found.' });
  if (err.code === 11000) return res.status(409).json({ message: 'That already exists.' });
  log.error(`${req.method} ${req.path} failed:`, err);
  res.status(500).json({ message: 'Server error.' });
});

// Connect to MongoDB then start server
const PORT = process.env.PORT || 5000;

// crashes outside a request still get written to the log
process.on('unhandledRejection', (err) => log.error('Unhandled promise rejection:', err));
process.on('uncaughtException', (err) => { log.error('Uncaught exception:', err); process.exit(1); });
mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    log.info('Connected to MongoDB');
    const server = app.listen(PORT, () => log.info(`Server running on port ${PORT}`));
    // hosts stop the server with SIGTERM: finish open requests, then close the database
    const stop = () => server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
    process.on('SIGTERM', stop);
    process.on('SIGINT', stop);
  })
  .catch((err) => {
    log.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
