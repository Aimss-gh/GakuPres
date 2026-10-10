import { USE_MOCK, http } from './http';
import { getToken, setToken, clearToken } from './session';
import { wait, load, save, uid } from './mockDb';
import { clearScans } from './offline';

// Real mode: server replies { token, user }. The token is kept in secure storage and http.js
// sends it on every request as "Authorization: Bearer <token>".
async function real(path, body) {
  const { token, user } = await http(path, { method: 'POST', body });
  await setToken(token);
  return user;
}

// POST /api/auth/login     body { email, password, remember }    -> { token, user }
export async function login({ email, password, remember }) {
  if (!USE_MOCK) return real('/auth/login', { email, password, remember });
  await wait();
  const db = await load();
  let user = db.users.find((u) => u.email === email);
  if (!user) {
    user = { _id: uid(), name: email.split('@')[0], email, role: 'Educator', bio: '', avatar: null };
    db.users.push(user);
    await save(db);
  }
  await setToken('mock-' + user._id);
  return user;
}

// POST /api/auth/register  body { name, email, password }  -> { token, user }   (always a teacher account)
export async function register(form) {
  if (!USE_MOCK) return real('/auth/register', form);
  await wait();
  const db = await load();
  if (db.users.some((u) => u.email === form.email)) throw new Error('Email is already registered.');
  const user = { _id: uid(), name: form.name, email: form.email, role: 'Educator', bio: '', avatar: null, verified: false }; // password is never stored
  db.users.push(user);
  await save(db);
  await setToken('mock-' + user._id);
  return user;
}

// POST /api/auth/forgot   body { email }   -> { message }   (the server emails a 6-digit code)
// Fake-data mode: no email is sent - the code is always 123456.
export async function forgotPassword(email) {
  if (!USE_MOCK) return http('/auth/forgot', { method: 'POST', body: { email } });
  await wait();
  return { message: 'Fake-data mode: no email is sent. Use the code 123456.' };
}

// POST /api/auth/reset   body { email, code, password }   -> { token, user }   (logged in with the new password)
export async function resetPassword({ email, code, password }) {
  if (!USE_MOCK) return real('/auth/reset', { email, code, password });
  await wait();
  const user = (await load()).users.find((u) => u.email === email);
  if (!user || code !== '123456') throw new Error('That code is wrong or has expired. Ask for a new one.');
  await setToken('mock-' + user._id);
  return user;
}

// GET /api/auth/me -> { user }   (app opens: "is my saved token still good?")
export async function me() {
  const token = await getToken();
  if (!token) throw new Error('Not logged in');
  if (!USE_MOCK) return (await http('/auth/me')).user;
  await wait(100);
  const user = (await load()).users.find((u) => 'mock-' + u._id === token);
  if (!user) throw new Error('Not logged in');
  return user;
}

// PATCH /api/auth/me   body { name?, bio?, avatar? }   -> { user }
export async function updateMe(patch) {
  if (!USE_MOCK) return (await http('/auth/me', { method: 'PATCH', body: patch })).user;
  await wait();
  const db = await load();
  const token = await getToken();
  const user = db.users.find((u) => 'mock-' + u._id === token);
  if (!user) throw new Error('Not logged in');
  if (typeof patch.name === 'string') user.name = patch.name;
  if (typeof patch.bio === 'string') user.bio = patch.bio;
  if (patch.avatar === null || typeof patch.avatar === 'string') user.avatar = patch.avatar;
  await save(db);
  return user;
}

// DELETE /api/auth/me   body { password }   -> deletes the account and all of its classes + attendance
export async function deleteAccount(password) {
  if (!USE_MOCK) {
    await http('/auth/me', { method: 'DELETE', body: { password } });
  } else {
    await wait();
    const db = await load();
    const token = await getToken();
    const user = db.users.find((u) => 'mock-' + u._id === token);
    if (!user) throw new Error('Not logged in');
    if (!password) throw new Error('Wrong password.');
    db.users = db.users.filter((u) => u !== user);
    db.classes = db.classes.filter((c) => c.owner !== user._id);
    await save(db);
  }
  await clearScans().catch(() => {});
  await clearToken();
}

// POST /api/auth/logout (optional on the server) - the token is always deleted from the phone
export async function logout() {
  try { if (!USE_MOCK) await http('/auth/logout', { method: 'POST' }); }
  finally { await clearToken(); }
}
// POST /api/feedback   body { kind: 'Bug'|'Idea'|'Other', message, appVersion, platform }  -> { message }
// Saved on the server and emailed to the GakuPres Team. Fake-data mode keeps it on this phone.
export async function sendFeedback(fb) {
  if (!USE_MOCK) return http('/feedback', { method: 'POST', body: fb });
  await wait();
  const db = await load();
  (db.feedback ||= []).push({ ...fb, at: new Date().toISOString() });
  await save(db);
  return { message: 'Thanks! Your feedback was sent.' };
}

// ---------- email check after sign-up (VerifyEmail screen) ----------
// Fake-data mode: no email is sent - the code is always 123456.
const mockMe = async (db) => {
  const token = await getToken();
  const user = db.users.find((u) => 'mock-' + u._id === token);
  if (!user) throw new Error('Not logged in');
  return user;
};

// POST /api/auth/verify   body { code }   -> { user }  (user.verified = true)
export async function verifyEmail(code) {
  if (!USE_MOCK) return (await http('/auth/verify', { method: 'POST', body: { code } })).user;
  await wait();
  const db = await load();
  const user = await mockMe(db);
  if (code !== '123456') throw new Error('That code is wrong or has expired. Ask for a new one. (Fake-data mode: the code is 123456)');
  user.verified = true;
  await save(db);
  return user;
}

// POST /api/auth/verify/resend   -> { message }
export async function resendCode() {
  if (!USE_MOCK) return http('/auth/verify/resend', { method: 'POST' });
  await wait();
  return { message: 'A new code was sent. (Fake-data mode: the code is 123456)' };
}

// POST /api/auth/verify/email   body { email }   -> { message, user }   (fix a typo in the email, new code goes there)
export async function changeEmail(email) {
  if (!USE_MOCK) return http('/auth/verify/email', { method: 'POST', body: { email } });
  await wait();
  const db = await load();
  const user = await mockMe(db);
  if (db.users.some((u) => u !== user && u.email === email)) throw new Error('Email is already registered.');
  user.email = email;
  await save(db);
  return { message: `A new code was sent to ${email}. (Fake-data mode: the code is 123456)`, user };
}
