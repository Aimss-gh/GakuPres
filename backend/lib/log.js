// Tiny logger: every line starts with the time, so hosting logs can be searched by when things happened.
//   log.info('Server running')   log.warn('MongoDB disconnected')   log.error('Scan failed:', err)
const stamp = () => new Date().toISOString();

module.exports = {
  info: (...a) => console.log(stamp(), 'INFO ', ...a),
  warn: (...a) => console.warn(stamp(), 'WARN ', ...a),
  // errors print their stack, so you can see which line broke
  error: (...a) => console.error(stamp(), 'ERROR', ...a.map((x) => (x instanceof Error ? x.stack : x))),
};
