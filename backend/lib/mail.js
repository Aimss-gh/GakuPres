// Sends email (sign-up codes, password reset codes, feedback). Two ways, set in .env:
//
//   1) Brevo (free, 300 emails a day) - use this on Render's FREE plan, which blocks the email (SMTP) ports.
//      BREVO_API_KEY=<key from Brevo: SMTP & API > API keys>
//      MAIL_FROM="GakuPres <gakupres@gmail.com>"   (this address must be added + verified in Brevo > Senders)
//
//   2) Gmail directly (SMTP) - fine on your own computer or a paid host:
//      SMTP_HOST=smtp.gmail.com   SMTP_PORT=465   SMTP_USER=you@gmail.com   SMTP_PASS=<app password>
//      Gmail: turn on 2-Step Verification, then make an "App password" (Google Account > Security) for SMTP_PASS.
//
// Neither set + not production: the email is printed in the server terminal instead (for testing).
const nodemailer = require('nodemailer');
const log = require('./log');

const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
const useBrevo = () => !!process.env.BREVO_API_KEY;
const useSmtp = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const configured = () => useBrevo() || useSmtp();

let transport = null;
const getTransport = () => {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
};

// "GakuPres <gakupres@gmail.com>" -> { name: "GakuPres", email: "gakupres@gmail.com" }
function sender() {
  const from = (process.env.MAIL_FROM || process.env.SMTP_USER || '').trim();
  const m = /^(.*)<([^>]+)>$/.exec(from);
  return m ? { name: m[1].trim().replace(/^"|"$/g, '') || 'GakuPres', email: m[2].trim() } : { name: 'GakuPres', email: from };
}

// Brevo's email API: a normal https request (port 443), so free hosts allow it
async function sendWithBrevo({ to, subject, text }) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: sender(), to: [{ email: to }], subject, textContent: text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const why = await res.json().catch(() => ({}));
    throw new Error(`Brevo refused the email (${res.status}): ${why.message || why.code || 'unknown reason'}`);
  }
}

// true = sent (or printed in development), false = email isn't set up on a production server
async function sendMail({ to, subject, text }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') return false;
    log.warn(`Email not set up (BREVO_API_KEY or SMTP_* in .env) - would send to ${to}: "${subject}"\n${text}`);
    return true;
  }
  if (useBrevo()) await sendWithBrevo({ to, subject, text });
  else await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

module.exports = { sendMail, mailConfigured: configured };
