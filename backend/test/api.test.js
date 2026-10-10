// End-to-end API test: starts server.js against a throwaway in-memory MongoDB (your real database is never touched)
// and checks every route.   npm test
// The first run downloads a test MongoDB (~600 MB, once, into your user cache folder).
const { MongoMemoryServer } = require('mongodb-memory-server');
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..');
const { MongoClient } = require('mongodb');
const PORT = 5099;
const BASE = `http://127.0.0.1:${PORT}/api`;
let passed = 0;

async function req(method, p, body, token, headers = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
const ok = (name, cond, extra) => { assert.ok(cond, name + ' ' + JSON.stringify(extra ?? '')); passed++; console.log('  ok -', name); };

(async () => {
  const mongo = await MongoMemoryServer.create();
  const srv = spawn(process.execPath, [path.join(dir, 'server.js')], {
    cwd: dir,
    env: { ...process.env, MONGO_URI: mongo.getUri() + 'gp', JWT_SECRET: 'test-secret-that-is-long-enough-1234567890', PORT: String(PORT), LOG_REQUESTS: '0',
      // never send real email from tests, even when .env has Gmail set up (empty values win over .env)
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', BREVO_API_KEY: '', NODE_ENV: 'test' },
  });
  let log = '';
  srv.stdout.on('data', (d) => (log += d));
  srv.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 50 && !/running/.test(log); i++) await new Promise((r) => setTimeout(r, 200));
  if (!/running/.test(log)) throw new Error('server did not start:\n' + log);
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const codes = (email) => [...log.matchAll(new RegExp(`would send to ${esc(email)}: "Your GakuPres verification code"\\n[\\s\\S]*?verification code is: (\\d{6})`, 'g'))].map((m) => m[1]);
  // waits for code number n+1 (0 = the first one) to show up in the log
  const waitCode = async (email, n = 0) => {
    for (let i = 0; i < 50 && codes(email).length <= n; i++) await new Promise((r) => setTimeout(r, 40));
    return codes(email)[n];
  };
  const verify = async (email, token, n = 0) => req('POST', '/auth/verify', { code: await waitCode(email, n) }, token);

  try {
    const H = (date, time) => ({ 'X-Local-Date': date, 'X-Local-Time': time });
    // the server only believes a phone date within 1 day of the real one, so test dates follow the real date
    const D0 = new Date().toISOString().slice(0, 10), D1 = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    // auth
    let r = await req('POST', '/auth/register', { full_name: 'T One', email: 'One@Mail.com', password: 'short', user_type: 'Admin' });
    ok('register rejects short password', r.status === 400, r);
    r = await req('POST', '/auth/register', { full_name: 'T One', email: 'One@Mail.com', password: 'password1', user_type: 'Admin' });
    ok('register returns token', r.status === 201 && r.data.token && r.data.user.user_type === 'Educator', r.data);
    r = await req('POST', '/auth/register', { full_name: 'T One', email: 'one@mail.com', password: 'password1' });
    ok('duplicate email 409', r.status === 409, r);
    r = await req('POST', '/auth/login', { email: 'ONE@mail.com', password: 'password1' });
    ok('login case-insensitive', r.status === 200 && r.data.token, r);
    const t1 = r.data.token;
    r = await req('POST', '/auth/login', { email: 'one@mail.com', password: 'wrongpass' });
    ok('bad password 400', r.status === 400, r);
    const t2 = (await req('POST', '/auth/register', { full_name: 'T Two', email: 'two@mail.com', password: 'password2' })).data.token;

    // ---- email verification ----
    r = await req('GET', '/auth/me', null, t1);
    ok('new account starts unverified', r.data.user.email_verified === false, r.data);
    r = await req('GET', '/classes', null, t1);
    ok('classes locked until the email is verified', r.status === 403 && r.data.code === 'EMAIL_NOT_VERIFIED', r);
    r = await req('POST', '/feedback', { kind: 'Idea', message: 'unverified feedback' }, t1);
    ok('feedback locked until verified', r.status === 403 && r.data.code === 'EMAIL_NOT_VERIFIED', r);
    ok('sign-up "emailed" a verification code', /^\d{6}$/.test(await waitCode('one@mail.com') || ''), log.slice(-300));
    const c1 = await waitCode('one@mail.com');
    r = await req('POST', '/auth/verify', { code: c1 === '000000' ? '111111' : '000000' }, t1);
    ok('wrong verification code refused', r.status === 400 && r.data.code === 'BAD_CODE', r);
    r = await req('POST', '/auth/verify/resend', null, t1);
    ok('new code only after 15 seconds', r.status === 429 && r.data.code === 'WAIT', r);
    r = await req('POST', '/auth/verify', { code: c1 }, t1);
    ok('right code verifies the email', r.status === 200 && r.data.user.email_verified === true, r);
    r = await req('POST', '/auth/verify', { code: c1 }, t1);
    ok('verifying again is harmless', r.status === 200 && r.data.user.email_verified === true, r);
    r = await req('POST', '/auth/verify/resend', null, t1);
    ok('no new code once verified', r.status === 400 && r.data.code === 'ALREADY_VERIFIED', r);
    r = await req('GET', '/classes', null, t1);
    ok('classes open after verifying', r.status === 200, r);
    r = await verify('two@mail.com', t2);
    ok('second account verified', r.status === 200, r);
    r = await req('GET', '/auth/me', null, t1);
    ok('me', r.data.user.email === 'one@mail.com', r);

    // profile picture: must really be a JPEG/PNG
    const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString('base64');
    r = await req('PATCH', '/auth/me', { full_name: 'T One', avatar: jpeg }, t1);
    ok('real jpeg avatar saved', r.status === 200 && r.data.user.avatar === jpeg, r);
    const fake = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>'.repeat(10)).toString('base64');
    r = await req('PATCH', '/auth/me', { full_name: 'T One', avatar: fake }, t1);
    ok('text pretending to be a png rejected', r.status === 400, r);
    r = await req('PATCH', '/auth/me', { full_name: 'T One', avatar: jpeg.slice(0, -4) + '!!!!' }, t1);
    ok('broken base64 rejected', r.status === 400, r);
    r = await req('PATCH', '/auth/me', { full_name: 'T One', avatar: 'data:image/svg+xml;base64,PHN2Zz4=' }, t1);
    ok('svg avatar rejected', r.status === 400, r);
    r = await req('PATCH', '/auth/me', { full_name: 'T One', avatar: null }, t1);
    ok('avatar removed', r.status === 200 && r.data.user.avatar === null, r);
    r = await req('GET', '/classes', null, 'garbage');
    ok('bad token 401', r.status === 401, r);

    // classes
    r = await req('POST', '/classes', { course: 'ITPE', code: '4ITPE3', section: '1', days: ['Wednesday', 'Monday', 'Funday'], start_time: '13:00', end_time: '12:00' }, t1);
    ok('end before start 400', r.status === 400, r);
    r = await req('POST', '/classes', { course: 'ITPE', code: '4ITPE3', section: '1', days: ['Wednesday', 'Monday', 'Funday'], start_time: '13:00', end_time: '16:00' }, t1);
    ok('create class', r.status === 201 && r.data.class._id && r.data.class.days === 'Wednesday,Monday', r.data);
    const cid = r.data.class._id;
    r = await req('GET', '/classes/' + cid, null, t2);
    ok('other teacher cannot see class', r.status === 404, r);
    r = await req('GET', '/classes/not-an-id', null, t1);
    ok('invalid id 404', r.status === 404, r);

    // students
    r = await req('POST', `/classes/${cid}/students`, { full_name: 'Juan', student_id: '00001111', department: 'CCS', course: 'BSIT' }, t1, H(D0, '12:00'));
    ok('add student returns class with roster', r.status === 201 && r.data.class.students.length === 1 && r.data.class.students[0].status === 'Absent', r.data);
    const sid = r.data.class.students[0]._id;
    r = await req('POST', `/classes/${cid}/students`, { full_name: 'Juan', student_id: '00001111', department: 'CCS' }, t1);
    ok('duplicate student 409', r.status === 409, r);
    r = await req('POST', `/classes/${cid}/students`, { full_name: 'X', student_id: '00002222', department: 'CCS' }, t2);
    ok('other teacher cannot add student', r.status === 404, r);

    // scan: present (within 15 min)
    r = await req('POST', `/classes/${cid}/scan`, { student_id: '00001111' }, t1, H(D0, '13:15'));
    ok('scan on time = Present', r.status === 200 && r.data.student.status === 'Present' && !r.data.already, r.data);
    r = await req('POST', `/classes/${cid}/scan`, { student_id: '00001111' }, t1, H(D0, '13:40'));
    ok('second scan = already', r.data.already === true && r.data.student.status === 'Present', r.data);
    // next day: fresh session, late
    r = await req('POST', `/classes/${cid}/scan`, { student_id: '00001111' }, t1, H(D1, '13:16'));
    ok('next day after grace = Late', r.data.student.status === 'Late' && r.data.class.date === D1, r.data);
    r = await req('GET', '/classes/' + cid, null, t1, H(D0, '20:00'));
    ok('previous day kept Present', r.data.students[0].status === 'Present', r.data);

    // not in class -> add
    r = await req('POST', `/classes/${cid}/scan`, { student_id: '00003333' }, t1, H(D0, '14:00'));
    ok('unknown student NOT_IN_CLASS', r.status === 404 && r.data.code === 'NOT_IN_CLASS', r);
    r = await req('POST', `/classes/${cid}/scan`, { student_id: '00003333', add: true, full_name: 'Maria', department: 'CCS', course: 'BSCS' }, t1, H(D0, '14:00'));
    ok('add from scan = added + Late', r.status === 200 && r.data.student.status === 'Late' && r.data.class.students.length === 2 && r.data.student.course === 'BSCS', r.data);
    r = await req('POST', `/classes/${cid}/scan`, {}, t1);
    ok('empty scan 400', r.status === 400, r);

    // status change + remove
    r = await req('PATCH', `/classes/${cid}/students/${sid}`, { status: 'Excuse' }, t1, H(D0, '15:00'));
    ok('set status', r.data.class.students.find((s) => s._id === sid).status === 'Excuse', r.data);
    r = await req('PATCH', `/classes/${cid}/students/${sid}`, { status: 'Nope' }, t1);
    ok('invalid status 400', r.status === 400, r);
    r = await req('PATCH', `/classes/${cid}/pin`, { pinned: true }, t1);
    ok('pin', r.data.class.pinned === true, r.data);
    r = await req('GET', '/classes', null, t1, H(D0, '15:00'));
    ok('list with rosters', Array.isArray(r.data) && r.data[0].students.length === 2, r.data);
    r = await req('GET', '/classes', null, t2);
    ok('other teacher list empty', Array.isArray(r.data) && r.data.length === 0, r.data);
    r = await req('DELETE', `/classes/${cid}/students/${sid}`, null, t1);
    ok('remove student', r.data.class.students.length === 1, r.data);

    // old routes are gone
    r = await req('GET', `/attendance/session/${cid}`, null, t1);
    ok('old /attendance routes removed', r.status === 404, r);
    r = await req('GET', `/students/${cid}`, null, t1);
    ok('old /students routes removed', r.status === 404, r);

    // delete cascades
    r = await req('DELETE', `/classes/${cid}`, null, t1);
    ok('delete class', r.status === 200, r);
    r = await req('GET', '/classes/' + cid, null, t1);
    ok('deleted class gone', r.status === 404, r);

    r = await req('GET', '/nope');
    ok('unknown route 404 json', r.status === 404 && r.data.message, r);

    // ---- start attendance (teacher late) ----
    const c2 = (await req('POST', '/classes', { course: 'X', code: 'C2', section: '2', days: ['Monday'], start_time: '13:00', end_time: '16:00' }, t1)).data.class._id;
    await req('POST', `/classes/${c2}/students`, { full_name: 'A', student_id: '####1111', department: 'CCS' }, t1);
    ok('# allowed in student id', true);
    await req('POST', `/classes/${c2}/students`, { full_name: 'B', student_id: '00002222', department: 'CCS' }, t1);
    const today = new Date(); const pad = (n) => String(n).padStart(2, '0');
    const D = `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`;
    r = await req('GET', `/classes/${c2}`, null, t1, H(D, '13:30'));
    ok('session default = schedule', r.data.session.start_time === '13:00' && r.data.session.adjusted === false && r.data.session.late_after === 15, r.data.session);
    r = await req('POST', `/classes/${c2}/start`, null, t1, H(D, '13:40'));
    ok('start late moves start', r.status === 200 && r.data.class.session.start_time === '13:40' && r.data.class.session.adjusted === true && r.data.class.end_time === '16:00', r.data);
    r = await req('POST', `/classes/${c2}/scan`, { student_id: '####1111' }, t1, H(D, '13:50'));
    ok('scan within grace of new start = Present', r.data.student.status === 'Present', r.data);
    r = await req('POST', `/classes/${c2}/scan`, { student_id: '00002222' }, t1, H(D, '13:56'));
    ok('scan after new grace = Late', r.data.student.status === 'Late', r.data);
    r = await req('DELETE', `/classes/${c2}/start`, null, t1, H(D, '14:00'));
    ok('reset start', r.data.class.session.adjusted === false && r.data.class.session.start_time === '13:00', r.data);
    r = await req('POST', `/classes/${c2}/start`, null, t1, H(D, '12:00'));
    ok('start before schedule keeps schedule', r.data.class.session.adjusted === false, r.data);
    r = await req('POST', `/classes/${c2}/start`, null, t1, H(D, '16:00'));
    ok('start after end = CLASS_ENDED', r.status === 400 && r.data.code === 'CLASS_ENDED', r);
    r = await req('POST', `/classes/${c2}/start`, null, t2, H(D, '13:40'));
    ok('other teacher cannot start', r.status === 404, r);

    // ---- phone date too far from the real date is ignored ----
    r = await req('GET', `/classes/${c2}`, null, t1, H('2020-01-01', '13:00'));
    ok('far-away date ignored', r.data.date !== '2020-01-01', r.data.date);

    // ---- sign-up always makes a teacher; old Student accounts cannot manage classes ----
    r = await req('POST', '/auth/register', { full_name: 'Stu', email: 'stu@mail.com', password: 'password3', user_type: 'Student' });
    ok('sign-up ignores user_type', r.data.user.user_type === 'Educator', r.data);
    const ts = r.data.token;
    const db = await MongoClient.connect(mongo.getUri());
    await db.db('gp').collection('users').updateOne({ email: 'stu@mail.com' }, { $set: { user_type: 'Student', email_verified: true } }); // an account from before
    await db.close();
    r = await req('GET', '/classes', null, ts);
    ok('student account blocked from classes', r.status === 403 && r.data.code === 'NOT_EDUCATOR', r);
    r = await req('GET', '/auth/me', null, ts);
    ok('student can still see own profile', r.status === 200, r);

    // ---- tokens ----
    const payload = JSON.parse(Buffer.from(t1.split('.')[1], 'base64url').toString());
    ok('token holds only the id + login version', Object.keys(payload).sort().join() === 'exp,iat,id,v', payload);
    const forged = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + t1.split('.')[1] + '.';
    r = await req('GET', '/classes', null, forged);
    ok('alg:none token rejected', r.status === 401, r);
    r = await req('POST', '/auth/login', { email: { $gt: '' }, password: { $gt: '' } });
    ok('operator injection in login rejected', r.status === 400, r);

    // ---- headers ----
    const hr = await fetch(BASE + '/auth/me');
    ok('no x-powered-by, nosniff set', !hr.headers.get('x-powered-by') && hr.headers.get('x-content-type-options') === 'nosniff');

    // ================= new features =================
    const Y = (() => { const d = new Date(Date.parse(D + 'T00:00:00Z') - 86400000); return d.toISOString().slice(0, 10); })();
    // ---- non-uniform time: a different start/end per day ----
    {
      const wd = (d) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(d + 'T00:00:00Z').getUTCDay()];
      const base = { course: 'N', code: 'NU1', section: '1', days: [wd(Y), wd(D)] };
      r = await req('POST', '/classes', { ...base, times: [{ day: wd(D), start_time: '08:00', end_time: '09:00' }] }, t1, H(D, '07:00'));
      ok('non-uniform: every picked day needs a time', r.status === 400 && r.data.message.includes(wd(Y)), r);
      r = await req('POST', '/classes', { ...base, times: [{ day: wd(D), start_time: '08:00', end_time: '09:00' }, { day: wd(Y), start_time: '15:00', end_time: '13:00' }] }, t1, H(D, '07:00'));
      ok('non-uniform: end before start refused', r.status === 400 && r.data.message.startsWith(wd(Y)), r);
      r = await req('POST', '/classes', { ...base, times: [{ day: wd(D), start_time: '08:00', end_time: '09:00' }, { day: wd(Y), start_time: '13:00', end_time: '15:00' }] }, t1, H(D, '07:00'));
      const nu = r.data.class;
      ok('non-uniform class: today uses its own times', r.status === 201 && nu.times.length === 2 && nu.start_time === '08:00' && nu.end_time === '09:00' && nu.session.start_time === '08:00', nu);
      r = await req('GET', `/classes/${nu._id}`, null, t1, H(Y, '12:00'));
      ok('non-uniform class: the other day uses its times', r.data.start_time === '13:00' && r.data.end_time === '15:00' && r.data.session.start_time === '13:00', r.data);
      await req('POST', `/classes/${nu._id}/students`, { full_name: 'Nu One', student_id: 'NU-1', department: 'CCS' }, t1, H(D, '07:00'));
      await req('POST', `/classes/${nu._id}/students`, { full_name: 'Nu Two', student_id: 'NU-2', department: 'CCS' }, t1, H(D, '07:00'));
      r = await req('POST', `/classes/${nu._id}/scan`, { student_id: 'NU-1' }, t1, H(D, '08:30'));
      ok('non-uniform: Late counts from that day\'s start', r.status === 200 && r.data.student.status === 'Late', r.data);
      r = await req('POST', `/classes/${nu._id}/scan`, { student_id: 'NU-2' }, t1, H(D, '09:10'));
      ok('non-uniform: closes at that day\'s end', r.status === 409 && r.data.code === 'ATTENDANCE_CLOSED', r);
      r = await req('GET', `/classes/${c2}`, null, t1, H(D, '13:30'));
      ok('same-time classes have no times list', Array.isArray(r.data.times) && r.data.times.length === 0 && r.data.start_time === '13:00', r.data);

      // ---- edit class ----
      r = await req('PATCH', `/classes/${nu._id}`, { course: 'Renamed', code: 'NU2', section: '2', days: [wd(D)], start_time: '10:00', end_time: '09:00' }, t1, H(D, '07:00'));
      ok('edit: bad times refused', r.status === 400, r);
      r = await req('GET', `/classes/${nu._id}`, null, t1, H(D, '07:00'));
      ok('edit: refused edit changed nothing', r.data.course === 'N' && r.data.times.length === 2, r.data);
      r = await req('PATCH', `/classes/${nu._id}`, { course: 'Renamed', code: 'NU2', section: '2', days: [wd(D)], start_time: '07:30', end_time: '12:00' }, t2, H(D, '07:00'));
      ok('edit: another teacher\'s class 404', r.status === 404, r);
      r = await req('PATCH', `/classes/${nu._id}`, { course: 'Renamed', code: 'NU2', section: '2', days: [wd(D)], start_time: '07:30', end_time: '12:00' }, t1, H(D, '07:00'));
      const ed = r.data.class;
      ok('edit: same time every day now', r.status === 200 && ed.course === 'Renamed' && ed.code === 'NU2' && ed.days === wd(D) && ed.times.length === 0 && ed.start_time === '07:30' && ed.end_time === '12:00', ed);
      ok('edit: students and today\'s scans kept', ed.students.length === 2 && ed.students.find((x) => x.student_id === 'NU-1').status === 'Late', ed.students);
      r = await req('PATCH', `/classes/${nu._id}`, { late_after: 20 }, t1, H(D, '07:00'));
      ok('edit: late_after alone leaves the rest', r.status === 200 && r.data.class.late_after === 20 && r.data.class.course === 'Renamed', r.data.class);
    }

    // #8 grace per class
    r = await req('POST', '/classes', { course: 'G', code: 'G1', section: '1', days: ['Monday'], start_time: '08:00', end_time: '10:00', late_after: 500 }, t1);
    ok('late_after out of range 400', r.status === 400, r);
    r = await req('POST', '/classes', { course: 'G', code: 'G1', section: '1', days: ['Monday'], start_time: '08:00', end_time: '10:00', late_after: 5 }, t1, H(D, '07:00'));
    ok('create with late_after', r.status === 201 && r.data.class.late_after === 5 && r.data.class.session.late_after === 5, r.data);
    const g = r.data.class._id;
    // #5 import
    r = await req('POST', `/classes/${g}/students/import`, { students: [
      { full_name: 'Ana', student_id: '0001', department: 'CCS', course: 'BSIT' },
      { full_name: 'Ben', student_id: '0002', department: 'CCS' },
      { full_name: 'Dup', student_id: '0001', department: 'CCS' },
      { full_name: '', student_id: '0003', department: 'CCS' },
      { full_name: 'Bad', student_id: 'x y', department: 'CCS' },
      'garbage',
    ] }, t1, H(D, '07:00'));
    ok('import adds good rows, skips bad', r.status === 200 && r.data.added === 2 && r.data.skipped.length === 4 && r.data.class.students.length === 2, r.data);
    r = await req('POST', `/classes/${g}/students/import`, { students: [{ full_name: 'Ana', student_id: '0001', department: 'CCS' }] }, t1);
    ok('import skips IDs already in class', r.data.added === 0 && r.data.skipped[0].reason.includes('Already'), r.data);
    r = await req('POST', `/classes/${g}/students/import`, { students: [] }, t1);
    ok('empty import 400', r.status === 400, r);
    r = await req('POST', `/classes/${g}/students/import`, { students: Array(1001).fill({ full_name: 'a', student_id: '1', department: 'b' }) }, t1);
    ok('too many rows 400', r.status === 400, r);
    r = await req('POST', `/classes/${g}/students/import`, { students: [{ full_name: 'Cy\u0000\nra\u202e\tLee', student_id: '0009', department: 'C\rCS' }] }, t1);
    const cy = r.data.class?.students.find((s) => s.student_id === '0009');
    ok('hidden control characters become spaces', cy?.full_name === 'Cy ra Lee' && cy.department === 'C CS', cy);
    // a class is full at 1000 students: the rest of the file is skipped, adding one more is refused
    r = await req('POST', `/classes/${g}/students/import`, { students: Array.from({ length: 1000 }, (_, i) => ({ full_name: 'S' + i, student_id: 'F' + i, department: 'D' })) }, t1);
    ok('import stops when the class is full', r.status === 200 && r.data.added === 997 && r.data.skipped.length === 3 && /full/.test(r.data.skipped[0].reason), { added: r.data.added, skipped: r.data.skipped?.slice(0, 1) });
    r = await req('POST', `/classes/${g}/students`, { full_name: 'One more', student_id: 'X1', department: 'D' }, t1);
    ok('adding to a full class 400', r.status === 400 && r.data.code === 'CLASS_FULL', r);
    r = await req('POST', `/classes/${g}/scan`, { student_id: '0001' }, t1, H(D, '08:05'));
    ok('grace 5: 08:05 = Present', r.data.student.status === 'Present', r.data);
    r = await req('POST', `/classes/${g}/scan`, { student_id: '0002' }, t1, H(D, '08:06'));
    ok('grace 5: 08:06 = Late', r.data.student.status === 'Late', r.data);
    r = await req('PATCH', `/classes/${g}`, { late_after: 30 }, t1, H(D, '08:10'));
    ok('change late_after', r.data.class.late_after === 30, r.data);
    // #3 close / reopen / auto close
    r = await req('POST', `/classes/${g}/close`, null, t1, H(D, '08:20'));
    ok('close attendance', r.data.class.session.closed === true && r.data.class.session.closed_time === '08:20', r.data.class.session);
    r = await req('POST', `/classes/${g}/scan`, { student_id: '0001' }, t1, H(D, '08:25'));
    ok('scan when closed = 409', r.status === 409 && r.data.code === 'ATTENDANCE_CLOSED', r);
    r = await req('POST', `/classes/${g}/scan`, { student_id: '9999', add: true, full_name: 'Z', department: 'Z' }, t1, H(D, '08:25'));
    ok('closed class cannot add by scan', r.status === 409, r);
    r = await req('POST', `/classes/${g}/reopen`, null, t1, H(D, '10:30'));
    ok('reopen after end', r.data.class.session.closed === false && r.data.class.session.reopened === true, r.data.class.session);
    r = await req('GET', `/classes/${g}`, null, t1, H(D, '10:31'));
    ok('reopened stays open after end', r.data.session.closed === false, r.data.session);
    const c3 = (await req('POST', '/classes', { course: 'E', code: 'E', section: '1', days: ['Monday'], start_time: '08:00', end_time: '09:00' }, t1)).data.class._id;
    await req('POST', `/classes/${c3}/students`, { full_name: 'Q', student_id: '5', department: 'CCS' }, t1);
    r = await req('POST', `/classes/${c3}/scan`, { student_id: '5' }, t1, H(D, '09:00'));
    ok('auto-closed at end time', r.status === 409 && r.data.code === 'ATTENDANCE_CLOSED', r);
    r = await req('GET', `/classes/${c3}`, null, t1, H(D, '09:30'));
    ok('unscanned stays Absent after close', r.data.session.closed === true && r.data.students[0].status === 'Absent', r.data);
    // #6 offline scan with real time
    r = await req('POST', `/classes/${c3}/scan`, { student_id: '5', at: { date: D, time: '08:10' } }, t1, H(D, '09:30'));
    ok('offline scan from before end accepted', r.status === 200 && r.data.student.status === 'Present', r);
    r = await req('POST', `/classes/${c3}/scan`, { student_id: '5', at: { date: D, time: '23:59' } }, t1, H(D, '09:30'));
    ok('offline scan in the future rejected', r.status === 400, r);
    r = await req('POST', `/classes/${c3}/scan`, { student_id: '5', at: { date: '2020-01-01', time: '08:10' } }, t1, H(D, '09:30'));
    ok('offline scan too old rejected', r.status === 400 && r.data.code === 'SCAN_TOO_OLD', r);
    r = await req('POST', `/classes/${c3}/scan`, { student_id: '5', at: { date: Y, time: '08:20' } }, t1, H(D, '09:30'));
    ok('offline scan from yesterday goes to yesterday', r.status === 200 && r.data.student.status === 'Late' && r.data.class.date === D, r);
    // #2 history: past day view / edit
    r = await req('GET', `/classes/${c3}?date=${Y}`, null, t1, H(D, '09:30'));
    ok('view past day', r.status === 200 && r.data.date === Y && r.data.students[0].status === 'Late' && r.data.session.closed === true, r.data);
    r = await req('GET', `/classes/${g}?date=${Y}`, null, t1, H(D, '09:30'));
    ok('past day without session: status null, nothing created', r.data.students.every((s) => s.status === null) && r.data.session.exists === false, r.data);
    r = await req('GET', `/classes/${g}?date=2999-01-01`, null, t1, H(D, '09:30'));
    ok('future day 400', r.status === 400, r);
    r = await req('GET', `/classes/${g}?date=2026-02-31`, null, t1, H(D, '09:30'));
    ok('impossible date 400', r.status === 400, r);
    const sidQ = (await req('GET', `/classes/${c3}`, null, t1)).data.students[0]._id;
    r = await req('PATCH', `/classes/${c3}/students/${sidQ}`, { status: 'Excuse', date: Y }, t1, H(D, '09:30'));
    ok('edit past day', r.data.class.date === Y && r.data.class.students[0].status === 'Excuse', r.data);
    // #1 export data
    r = await req('GET', `/classes/${c3}/attendance?from=${Y}&to=${D}`, null, t1, H(D, '09:30'));
    ok('history range', r.status === 200 && r.data.dates.length === 2 && r.data.students[0].statuses[Y] === 'Excuse' && r.data.students[0].statuses[D] === 'Present', r.data);
    ok('history counts', r.data.dates.find((d) => d.date === D).present === 1 && r.data.dates.find((d) => d.date === Y).excuse === 1, r.data.dates);
    r = await req('GET', `/classes/${c3}/attendance`, null, t1, H(D, '09:30'));
    ok('history default 30 days', r.data.to === D && r.data.dates.length === 2, r.data);
    r = await req('GET', `/classes/${c3}/attendance?from=2020-01-01&to=${D}`, null, t1, H(D, '09:30'));
    ok('history range too long 400', r.status === 400, r);
    r = await req('GET', `/classes/${c3}/attendance`, null, t2);
    ok('history ownership', r.status === 404, r);

    // ---- proxy-scan warning (#7) ----
    const mk = async (tok, code, start, end) => (await req('POST', '/classes', { course: 'P', code, section: '1', days: ['Monday'], start_time: start, end_time: end }, tok)).data.class._id;
    const pA = await mk(t1, 'PA', '13:00', '16:00');   // teacher 1
    const pB = await mk(t2, 'PB', '14:00', '15:00');   // teacher 2, overlaps PA
    const pC = await mk(t1, 'PC', '17:00', '18:00');   // teacher 1, does NOT overlap
    const pD = await mk(t1, 'PD', '15:30', '16:30');   // teacher 1, overlaps PA
    for (const [tok, c] of [[t1, pA], [t2, pB], [t1, pC], [t1, pD]]) await req('POST', `/classes/${c}/students`, { full_name: 'Twin', student_id: '7777', department: 'CCS' }, tok);
    r = await req('POST', `/classes/${pA}/scan`, { student_id: '7777' }, t1, H(D, '14:10'));
    ok('first scan: no warning', r.data.student.conflict === null, r.data.student);
    r = await req('POST', `/classes/${pB}/scan`, { student_id: '7777' }, t2, H(D, '14:20'));
    ok('overlapping class of another teacher: warned, time only', r.data.student.conflict && r.data.student.conflict.time === '14:10' && r.data.student.conflict.same_teacher === false && r.data.student.conflict.other_label === null, r.data.student);
    r = await req('GET', `/classes/${pA}`, null, t1, H(D, '14:30'));
    ok('the first class gets the warning too', r.data.students.find((s) => s.student_id === '7777').conflict?.time === '14:20', r.data.students);
    r = await req('POST', `/classes/${pC}/scan`, { student_id: '7777' }, t1, H(D, '17:05'));
    ok('class that does not overlap: no warning', r.data.student.conflict === null, r.data.student);
    r = await req('POST', `/classes/${pD}/scan`, { student_id: '7777' }, t1, H(D, '15:40'));
    ok('own overlapping class: warned with class name', r.data.student.conflict?.same_teacher === true && r.data.student.conflict.other_label === 'PA - Section 1', r.data.student);

    // ---- email verification: change the email, old accounts, stale sign-ups, 5 tries ----
    {
      const tv = (await req('POST', '/auth/register', { full_name: 'Typo', email: 'typo@gmial.com', password: 'password5' })).data.token;
      await waitCode('typo@gmial.com');
      r = await req('POST', '/auth/verify/email', { email: 'typo@gmail.com' }, tv);
      ok('change email: must wait 15 seconds too', r.status === 429, r);
      const g3 = await MongoClient.connect(mongo.getUri());
      const users = g3.db('gp').collection('users');
      await users.updateOne({ email: 'typo@gmial.com' }, { $set: { verify_sent_at: new Date(Date.now() - 16000) } });
      r = await req('POST', '/auth/verify/email', { email: 'one@mail.com' }, tv);
      ok('change email: taken email refused', r.status === 409, r);
      r = await req('POST', '/auth/verify/email', { email: 'typo@gmail.com' }, tv);
      ok('change email: fixed, new code sent there', r.status === 200 && r.data.user.email === 'typo@gmail.com' && r.data.user.email_verified === false, r);
      const oldCode = await waitCode('typo@gmial.com');
      r = await req('POST', '/auth/verify', { code: oldCode }, tv);
      ok('code sent to the old email no longer works', r.status === 400 || oldCode === await waitCode('typo@gmail.com'), r);
      r = await verify('typo@gmail.com', tv);
      ok('code sent to the new email works', r.status === 200 && r.data.user.email_verified === true, r);
      r = await req('POST', '/auth/login', { email: 'typo@gmail.com', password: 'password5' });
      ok('log in with the fixed email', r.status === 200 && r.data.user.email_verified === true, r);

      // accounts made before verification existed have no email_verified value: they keep working
      await users.updateOne({ email: 'two@mail.com' }, { $unset: { email_verified: '' } });
      r = await req('GET', '/classes', null, t2);
      ok('older accounts count as verified', r.status === 200, r);

      // someone signed up with another person's email a day ago and never verified: the owner can sign up
      await users.insertOne({ full_name: 'Squatter', email: 'owner@mail.com', password: 'x', user_type: 'Educator', email_verified: false,
        token_version: 0, createdAt: new Date(Date.now() - 25 * 3600 * 1000), updatedAt: new Date() });
      r = await req('POST', '/auth/register', { full_name: 'Owner', email: 'owner@mail.com', password: 'password6' });
      ok('stale unverified sign-up is replaced', r.status === 201 && r.data.user.full_name === 'Owner', r);
      const to = r.data.token;
      await waitCode('owner@mail.com');
      for (let i = 0; i < 5; i++) await req('POST', '/auth/verify', { code: '00000' + i }, to);
      r = await verify('owner@mail.com', to);
      ok('5 wrong verification tries lock the code', r.status === 400 && r.data.code === 'BAD_CODE', r);
      await users.updateOne({ email: 'owner@mail.com' }, { $set: { verify_sent_at: new Date(Date.now() - 16000) } });
      r = await req('POST', '/auth/verify/resend', null, to);
      ok('a new code can be asked for', r.status === 200, r);
      r = await verify('owner@mail.com', to, 1);
      ok('the new code works', r.status === 200 && r.data.user.email_verified === true, r);
      await g3.close();
    }

    // ---- forgot password ----
    const tOld = (await req('POST', '/auth/register', { full_name: 'Forgetful', email: 'forget@mail.com', password: 'oldpassword' })).data.token;
    r = await req('POST', '/auth/forgot', { email: 'nobody@mail.com' });
    const generic = r.data.message;
    ok('forgot: unknown email gets the same answer', r.status === 200 && /If that email has an account/.test(generic), r);
    r = await req('POST', '/auth/forgot', { email: 'Forget@Mail.com' });
    ok('forgot: known email, same answer', r.status === 200 && r.data.message === generic, r);
    await new Promise((res) => setTimeout(res, 200));
    const code = (log.match(/reset code is: (\d{6})/g) || []).pop()?.slice(-6);
    ok('code was "emailed" (printed, email not set up)', /^\d{6}$/.test(code || ''), log.slice(-300));
    r = await req('POST', '/auth/reset', { email: 'forget@mail.com', code: code === '000000' ? '111111' : '000000', password: 'newpassword1' });
    ok('wrong code refused', r.status === 400 && r.data.code === 'BAD_CODE', r);
    r = await req('POST', '/auth/reset', { email: 'forget@mail.com', code, password: 'short' });
    ok('short new password refused', r.status === 400, r);
    r = await req('POST', '/auth/reset', { email: 'forget@mail.com', code, password: 'newpassword1' });
    ok('right code: password changed + logged in', r.status === 200 && r.data.token && r.data.user.email === 'forget@mail.com', r);
    const tNew = r.data.token;
    r = await req('GET', '/auth/me', null, tOld);
    ok('old logins stop working after the change', r.status === 401, r);
    r = await req('GET', '/auth/me', null, tNew);
    ok('new login works', r.status === 200, r);
    r = await req('POST', '/auth/reset', { email: 'forget@mail.com', code, password: 'another123' });
    ok('a code works only once', r.status === 400, r);
    r = await req('POST', '/auth/login', { email: 'forget@mail.com', password: 'newpassword1' });
    ok('log in with the new password', r.status === 200, r);
    await req('POST', '/auth/forgot', { email: 'forget@mail.com' });
    await new Promise((res) => setTimeout(res, 200));
    const code2 = (log.match(/reset code is: (\d{6})/g) || []).pop().slice(-6);
    for (let i = 0; i < 5; i++) await req('POST', '/auth/reset', { email: 'forget@mail.com', code: String((Number(code2) + 1 + i) % 1000000).padStart(6, '0'), password: 'another123' });
    r = await req('POST', '/auth/reset', { email: 'forget@mail.com', code: code2, password: 'another123' });
    ok('5 wrong tries lock the code', r.status === 400, r);
    r = await req('GET', '/auth/me', null, tNew);
    ok('resetting by email code also verifies the email', r.data.user.email_verified === true, r.data);

    // ---- feedback ----
    r = await req('POST', '/feedback', { kind: 'Bug', message: 'The scanner froze' });
    ok('feedback needs login', r.status === 401, r);
    r = await req('POST', '/feedback', { kind: 'Hack', message: 'The scanner froze' }, t1);
    ok('feedback kind must be Bug/Idea/Other', r.status === 400, r);
    r = await req('POST', '/feedback', { kind: 'Idea', message: '  hi ' }, t1);
    ok('feedback too short 400', r.status === 400, r);
    r = await req('POST', '/feedback', { kind: 'Bug', message: 'Line one\nline two'.padEnd(1500, '.'), app_version: '1.0.0', platform: 'android 34' }, t1);
    ok('feedback saved', r.status === 201, r);
    await new Promise((res) => setTimeout(res, 200));
    ok('feedback "emailed" to the team (printed, email not set up)', /GakuPres feedback: Bug/.test(log) && /From: T One <one@mail.com>/.test(log), log.slice(-300));
    for (let i = 0; i < 4; i++) await req('POST', '/feedback', { kind: 'Other', message: 'message number ' + i }, t1);
    r = await req('POST', '/feedback', { kind: 'Other', message: 'one too many' }, t1);
    ok('feedback limited to 5 per hour', r.status === 429, r);
    {
      const dbf = await MongoClient.connect(mongo.getUri());
      const f = await dbf.db('gp').collection('feedbacks').findOne({ kind: 'Bug' });
      await dbf.close();
      ok('feedback stored: 1000 chars max, line breaks kept', f.message.length === 1000 && f.message.startsWith('Line one\nline two') && f.platform === 'android 34', f);
    }

    // ---- delete account ----
    const t3 = (await req('POST', '/auth/register', { full_name: 'Del', email: 'del@mail.com', password: 'password4' })).data.token;
    await verify('del@mail.com', t3);
    await req('POST', '/feedback', { kind: 'Idea', message: 'feedback from Del' }, t3);
    const c4 = (await req('POST', '/classes', { course: 'D', code: 'D1', section: '1', days: ['Monday'], start_time: '08:00', end_time: '09:00' }, t3)).data.class._id;
    await req('POST', `/classes/${c4}/students`, { full_name: 'S', student_id: '42', department: 'CCS' }, t3);
    await req('GET', `/classes/${c4}`, null, t3); // creates today's session + record
    r = await req('DELETE', '/auth/me', { password: 'wrong-password' }, t3);
    ok('delete account needs the right password', r.status === 400 && r.data.code === 'WRONG_PASSWORD', r);
    r = await req('DELETE', '/auth/me', { password: 'password4' }, t3);
    ok('delete account', r.status === 200 && r.data.deleted_classes === 1, r);
    r = await req('GET', '/auth/me', null, t3);
    ok('deleted account token stops working', r.status === 401, r);
    const db2 = await MongoClient.connect(mongo.getUri());
    const g2 = db2.db('gp');
    const { ObjectId } = require('mongodb');
    const left = {
      users: await g2.collection('users').countDocuments({ email: 'del@mail.com' }),
      classes: await g2.collection('classes').countDocuments({ code: 'D1' }),
      students: await g2.collection('students').countDocuments({ student_id: '42' }),
      sessions: await g2.collection('attendancesessions').countDocuments({ class_id: new ObjectId(c4) }),
      feedback: await g2.collection('feedbacks').countDocuments({ message: 'feedback from Del' }),
    };
    await db2.close();
    ok('everything of the account is gone', Object.values(left).every((v) => v === 0), left);
    r = await req('POST', '/auth/login', { email: 'del@mail.com', password: 'password4' });
    ok('cannot log in after delete', r.status === 400, r);

    // ---- Brevo email (Render's free plan): checked against a fake Brevo on this computer, nothing is sent ----
    {
      const http = require('http');
      let got = null;
      const fake = http.createServer((q, s2) => {
        let b = '';
        q.on('data', (c) => (b += c));
        q.on('end', () => { got = { key: q.headers['api-key'], body: JSON.parse(b) }; s2.writeHead(201, { 'content-type': 'application/json' }); s2.end('{"messageId":"x"}'); });
      }).listen(0);
      await new Promise((r) => fake.once('listening', r));
      Object.assign(process.env, { BREVO_API_KEY: 'test-key', BREVO_API_URL: `http://127.0.0.1:${fake.address().port}`, MAIL_FROM: '"GakuPres <team@example.com>"' /* with quotes, as typed into Render */, NODE_ENV: 'production' });
      delete require.cache[require.resolve('../lib/mail')];
      const { sendMail } = require('../lib/mail');
      const sent = await sendMail({ to: 'teacher@example.com', subject: 'Your code', text: 'Code: 123456' });
      ok('Brevo: email sent through its web API', sent === true && got.key === 'test-key' && got.body.sender.email === 'team@example.com'
        && got.body.sender.name === 'GakuPres' && got.body.to[0].email === 'teacher@example.com' && got.body.textContent === 'Code: 123456', got);
      fake.close();
      for (const k of ['BREVO_API_KEY', 'BREVO_API_URL', 'MAIL_FROM', 'NODE_ENV']) delete process.env[k];
    }

    // ---- login rate limit (last: it blocks this IP) ----
    let last;
    for (let i = 0; i < 12; i++) last = await req('POST', '/auth/login', { email: 'one@mail.com', password: 'wrong-' + i });
    ok('login rate limited', last.status === 429 && last.data.code === 'RATE_LIMITED', last);
    console.log(`\n${passed} checks passed`);
  } finally {
    srv.kill();
    await mongo.stop();
    if (/ERROR/.test(log)) console.log('--- server log ---\n' + log); // only when the server itself crashed
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
