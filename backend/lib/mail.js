// Sends email (password reset codes). Fill these in .env to turn it on:
//   SMTP_HOST=smtp.gmail.com   SMTP_PORT=465   SMTP_USER=you@gmail.com   SMTP_PASS=<app password>
//   MAIL_FROM="GakuPres <you@gmail.com>"
// Gmail: turn on 2-Step Verification, then make an "App password" (Google Account > Security) for SMTP_PASS.
// Not set up + not production: the email is printed in the server terminal instead (for testing).
const nodemailer = require('nodemailer');
const log = require('./log');

const configured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

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

// true = sent (or printed in development), false = email isn't set up on a production server
async function sendMail({ to, subject, text }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') return false;
    log.warn(`Email not set up (SMTP_* in .env) - would send to ${to}: "${subject}"\n${text}`);
    return true;
  }
  await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text });
  return true;
}

module.exports = { sendMail, mailConfigured: configured };
