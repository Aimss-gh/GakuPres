// App tests (no phone needed):  npm test
// The app's code is written for React Native, so this first copies the pure-logic files into a temp
// folder as Node modules, with stand-ins for phone-only parts (storage, secure store, network).
// Then it checks: the ID QR reader, CSV import/export, dates / IDs / late rules, the offline queue,
// and the whole fake-data mode (create class, scan, start late, close, import, past days, history).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The tests pretend it's 10:00 today, so the timing checks give the same result at any hour.
const RealDate = Date;
const ten = new RealDate(); ten.setHours(10, 0, 0, 0);
const SHIFT = ten.getTime() - RealDate.now();
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + SHIFT); }
  static now() { return RealDate.now() + SHIFT; }
};

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gakupres-test-'));

// ---------- copy the logic files ----------
const FILES = ['constants.js', 'utils.js', 'qr.js', 'csv.js', 'xlsx.js', 'api/adapter.js', 'api/offline.js', 'api/classApi.js', 'api/mockDb.js', 'api/authApi.js'];
const FFLATE = pathToFileURL(path.join(SRC, '..', 'node_modules', 'fflate', 'esm', 'index.mjs')).href;
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });
for (const f of FILES) {
  const s = fs.readFileSync(path.join(SRC, f), 'utf8')
    .replace(/from '(\.\.?\/[^']+)'/g, (m, p) => `from '${p}.mjs'`)
    .replace(/from 'fflate'/g, `from '${FFLATE}'`)
    .replace(/from '@react-native-async-storage\/async-storage'/g, `from '${pathToFileURL(path.join(OUT, 'storage.mjs')).href}'`)
    .replace(/wait = \(ms = 250\) => new Promise\(\(r\) => setTimeout\(r, ms\)\)/, 'wait = () => Promise.resolve()');
  fs.writeFileSync(path.join(OUT, f.replace(/\.js$/, '.mjs')), s);
}
// stand-ins
fs.writeFileSync(path.join(OUT, 'storage.mjs'), 'const m = new Map(); export const reset = () => m.clear();\nexport default { getItem: async (k) => (m.has(k) ? m.get(k) : null), setItem: async (k, v) => { m.set(k, v); } };\n');
fs.writeFileSync(path.join(OUT, 'api', 'session.mjs'), "let t = 'mock-u1'; export const getToken = async () => t; export const setToken = async (v) => { t = v; }; export const clearToken = async () => { t = null; };\n");
fs.writeFileSync(path.join(OUT, 'api', 'http.mjs'),
  "export let USE_MOCK = true; export const calls = []; let impl = async () => ({});\n" +
  'export const setImpl = (f) => { impl = f; };\nexport const http = (p, o) => { calls.push([p, o]); return impl(p, o); };\n');

const load = (f) => import(pathToFileURL(path.join(OUT, f)).href);
const { parseStudentQr, makeStudentQr } = await load('qr.mjs');
const csv = await load('csv.mjs');
const X = await load('xlsx.mjs');
const U = await load('utils.mjs');
const off = await load('api/offline.mjs');
const H = await load('api/http.mjs');
const A = await load('api/classApi.mjs');
const storage = await load('storage.mjs');
const auth = await load('api/authApi.mjs');

let n = 0;
const ok = (name, cond, extra) => { assert.ok(cond, `${name} ${JSON.stringify(extra ?? '')}`); n++; };
const section = (t) => console.log(`\n${t}`);
const done = (t) => console.log(`  ok - ${t}`);

// ================= QR reader =================
section('QR reader');
const QR = [
  ['00001111|Juan Dela Cruz|CCS|BSIT|01/01/2001', '00001111'],
  ['00001111\nJuan Dela Cruz\nCCS\nBSIT\n2001-01-01', '00001111'],
  ['00001111\r\nJuan Dela Cruz\r\nCCS\r\nBSIT\r\nJanuary 1, 2001', '00001111'],
  ['00001111,Dela Cruz, Juan,CCS,BSIT,01/01/2001', '00001111'],
  ['00001111;Juan;CCS;BSIT', '00001111'],
  ['ID: 00001111\nName: Juan Dela Cruz\nDepartment: CCS\nCourse: BSIT\nBirthday: 01/01/2001', '00001111'],
  ['Course: BSIT | Name: Juan | I.D. No.: 2021-0001 | Dept: CCS | DOB: 1/1/2001', '2021-0001'],
  ['{"id":"00001111","name":"Juan Dela Cruz","department":"CCS","course":"BSIT","dob":"2001-01-01"}', '00001111'],
  ['{"student_id":123,"full_name":"Ana","dept":"CCS","program":"BSCS"}', '123'],
  ['0000 1111|Juan|CCS|BSIT|01/01/2001', '00001111'],
  ['####1111|Juan|CCS|BSIT|01/01/2001', '####1111'],
  [makeStudentQr({ studentId: '2021-0001', name: 'Maria', dept: 'BSIT' }), '2021-0001'],
  ['https://example.com/some/link', null], ['00001111', null], ['GAKU-2021-0001-abc123', null], ['', null], ['a|b|c', null],
  ['<script>|Juan|CCS|BSIT|x', null], ['00001111|12345|CCS|BSIT|01/01/2001', null], ['{bad json', null], ['####|Juan|CCS|BSIT|01/01/2001', null],
];
for (const [q, id] of QR) ok(`qr ${JSON.stringify(q).slice(0, 40)}`, (parseStudentQr(q)?.studentId ?? null) === id, parseStudentQr(q));
ok('qr keeps name with comma', parseStudentQr('00001111,Dela Cruz, Juan,CCS,BSIT,01/01/2001').name === 'Dela Cruz, Juan');
done(`${QR.length + 1} QR layouts`);

// ================= dates, IDs, late rules =================
section('Dates, IDs, late rules');
const at = (h, m) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
const c = { startTime: '13:00', endTime: '16:00', session: { startTime: '13:00', adjusted: false, lateAfter: 15 } };
const CASES = [
  [U.maskId('00001111'), '#1111'], [U.maskId('2021-0001'), '#-0001'], [U.maskId('####1111'), '#1111'], [U.maskId('A12'), 'A#'], [U.maskId(''), ''],
  [U.lateAfterTime(c), '1:15 pm'], [U.lateAfterTime({ ...c, session: { startTime: '13:40', adjusted: true, lateAfter: 15 } }), '1:55 pm'],
  [U.runningLate(c, at(13, 10)), false], [U.runningLate(c, at(13, 20)), true], [U.runningLate(c, at(16, 0)), false],
  [U.runningLate({ ...c, session: { ...c.session, adjusted: true } }, at(13, 20)), false],
  [U.classEnded(c, at(16, 0)), true], [U.classEnded(c, at(15, 59)), false],
  [U.statusByTime('13:00', at(13, 15)), 'Present'], [U.statusByTime('13:00', at(13, 16)), 'Late'], [U.statusByTime('13:00', at(13, 6), 5), 'Late'],
  [U.addDays('2026-10-01', -1), '2026-09-30'], [U.addDays('2026-12-31', 1), '2027-01-01'], [U.fmtDay('2026-10-08'), 'Thu, Oct 8, 2026'],
  [U.closedAtMin(c, null, false, 959), false], [U.closedAtMin(c, null, false, 960), true], [U.closedAtMin(c, null, true, 1000), false], [U.closedAtMin(c, '14:00', true, 841), true],
  [U.fmtTime('13:05'), '1:05 pm'], [U.fmtTime('00:00'), '12:00 am'], [U.fmtDateMDY(new Date(2001, 0, 1)), '01/01/2001'],
];
CASES.forEach(([got, want], i) => ok(`helper #${i}`, got === want, { got, want }));
done(`${CASES.length} helper checks`);

// ================= CSV =================
section('CSV import / export');
let r = csv.rowsToStudents(csv.parseCsv('﻿Student ID,Name,Department,Course\r\n00001111,"Dela Cruz, Juan",CCS,BSIT\r\n00001112,Maria Santos,CCS,BSCS\r\n\r\n'));
ok('header + quotes + BOM', r.students.length === 2 && r.students[0].name === 'Dela Cruz, Juan' && r.students[0].course === 'BSIT', r);
r = csv.rowsToStudents(csv.parseCsv('00001111;Juan;CCS;BSIT\n00001112;Ana;CCS;BSIT'));
ok('semicolon, no header', r.students.length === 2 && r.students[1].name === 'Ana', r);
r = csv.rowsToStudents(csv.parseCsv('Course,Dept,Name,ID No.\nBSIT,CCS,Juan,1'));
ok('header in any order', r.students[0].studentId === '1' && r.students[0].course === 'BSIT', r);
r = csv.rowsToStudents(csv.parseCsv('ID,Last Name,First Name,M.I.,Department\n1,Dela Cruz,Juan,P.,CCS\n2,Santos,Maria,,CCS'));
ok('last / first name columns', r.students[0].name === 'Dela Cruz, Juan P.' && r.students[1].name === 'Santos, Maria', r.students);
r = csv.rowsToStudents(csv.parseCsv('ID,Name,Department\n1,Juan,CCS\n1,Juan again,CCS\n,NoId,CCS\nx/y,Bad,CCS\n3,,CCS'));
ok('skips duplicate / missing / bad rows', r.students.length === 1 && r.skipped.length === 4, r);
const out = csv.toCsv([['=HYPERLINK("x")', '+1', '-2', '@a', 'a,b']]);
ok('formula injection neutralized', out.includes(`"'=HYPERLINK(""x"")"`) && out.includes("'+1") && out.includes("'@a") && out.includes('"a,b"'), out);
const cls = { course: 'ITPE - 4', code: '4ITPE3', section: '1', students: [
  { studentId: '00001111', name: 'Dela Cruz, Juan', dept: 'CCS', course: 'BSIT' },
  { studentId: '####2222', name: 'Maria "Mia" Santos', dept: 'CCS', course: '' },
  { studentId: '00003333', name: '=SUM(A1)', dept: 'CCS', course: 'BSCS' }] };
const back = csv.rowsToStudents(csv.parseCsv(csv.classListCsv(cls))).students;
ok('class list export -> import round trip', back.length === 3 && back[1].name === 'Maria "Mia" Santos' && back[1].studentId === '####2222' && back[2].name === '=SUM(A1)', back);
const h = { from: '2026-10-01', to: '2026-10-08', dates: [{ date: '2026-10-07', startTime: '13:00', adjusted: false }, { date: '2026-10-08', startTime: '13:20', adjusted: true }],
  students: [{ studentId: '00001111', name: 'Juan', dept: 'CCS', course: 'BSIT', statuses: { '2026-10-07': 'Present', '2026-10-08': 'Late' } }] };
ok('class list file name', csv.classListName(cls) === 'GakuPres_4ITPE3_S1_class_list.csv');
done('8 CSV checks');

// ================= Excel (.xlsx) report =================
section('Excel report');
const { unzipSync, strFromU8 } = await import(FFLATE);
h.students.push({ studentId: '00002222', name: 'Ana <&> "Q"', dept: 'CCS', course: '', statuses: { '2026-10-08': 'Absent' } });
const bytes = X.attendanceXlsx(cls, h);
ok('xlsx is a zip file', bytes[0] === 0x50 && bytes[1] === 0x4b, bytes.slice(0, 4));
const parts = Object.fromEntries(Object.entries(unzipSync(bytes)).map(([k, v]) => [k, strFromU8(v)]));
ok('all required parts', ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].every((p) => parts[p]), Object.keys(parts));
const sheet1 = parts['xl/worksheets/sheet1.xml'];
ok('two sheets: Attendance + Days', /name="Attendance"/.test(parts['xl/workbook.xml']) && /name="Days"/.test(parts['xl/workbook.xml']));
ok('IDs kept as text (leading zeros)', sheet1.includes('t="inlineStr"><is><t xml:space="preserve">00001111</t>'));
ok('P / L / A colored', /s="4" t="inlineStr"><is><t xml:space="preserve">P</.test(sheet1) &&/s="5" t="inlineStr"><is><t xml:space="preserve">L</.test(sheet1) && /s="7" t="inlineStr"><is><t xml:space="preserve">A</.test(sheet1));
ok('totals are numbers', /<c r="G6" s="8"><v>1<\/v><\/c><c r="H6" s="8"><v>1<\/v><\/c>/.test(sheet1), sheet1.match(/<row r="6">.*?<\/row>/)?.[0]);
ok('late start shown', sheet1.includes('1:20 pm (late start)'));
ok('special characters escaped', sheet1.includes('Ana &lt;&amp;&gt; &quot;Q&quot;'));
ok('header frozen', sheet1.includes('state="frozen"') && sheet1.includes('ySplit="5"'));
ok('every part is well-formed XML', Object.values(parts).every((x) => x.startsWith('<?xml') && (x.match(/</g) || []).length === (x.match(/>/g) || []).length));
ok('safe file name', X.xlsxName({ code: '4/ITPE 3', section: '1' }, h) === 'GakuPres_4-ITPE-3_S1_2026-10-01_to_2026-10-08.xlsx');
fs.writeFileSync(path.join(os.tmpdir(), 'gakupres-test-report.xlsx'), bytes); // kept for a manual look in Excel
done('11 Excel checks');

// ================= offline queue =================
section('Offline scans');
const s1 = { studentId: '1', name: 'A', dept: 'CCS', course: 'BSIT' };
await off.queueScan('c1', s1, false);
await off.queueScan('c1', s1, false);
await off.queueScan('c1', { ...s1, studentId: '2' }, true);
await off.queueScan('c2', { ...s1, studentId: '3' }, false);
ok('same student / day saved once', (await off.pendingScans()).length === 3 && (await off.pendingScans('c1')).length === 2);
H.setImpl(async () => { throw Object.assign(new Error('offline'), { status: 0 }); });
let f = await off.flushScans();
ok('still offline: nothing lost', f.sent === 0 && (await off.pendingScans()).length === 3, f);
let k = 0;
H.setImpl(async () => { k++; if (k === 2) throw Object.assign(new Error('Attendance is closed for this class.'), { status: 409 }); return {}; });
H.calls.length = 0;
f = await off.flushScans();
ok('online: sends, drops what the server refuses', f.sent === 2 && f.dropped.length === 1 && (await off.pendingScans()).length === 0, f);
ok('sends the real scan time', H.calls[0][1].at && /^\d{2}:\d{2}$/.test(H.calls[0][1].at.time) && H.calls[1][1].body.add === true, H.calls);
ok('one upload at a time', off.flushScans() === off.flushScans());
await off.flushScans();
done('5 offline checks');

// ================= fake-data mode =================
section('Fake-data mode');
storage.reset();
const hh = (m) => U.minToTime(Math.max(0, Math.min(m, 1439)));
const now = U.nowMin();
{
  let k1 = await A.createClass({ course: 'ITPE', code: 'X1', section: '1', days: ['Monday'], startTime: hh(now - 30), endTime: hh(now + 120), lateAfter: 10 });
  ok('create class', k1.students.length === 5 && k1.lateAfter === 10 && k1.session.closed === false, k1);
  const st = k1.students[0];
  r = await A.scanStudent(k1._id, { studentId: st.studentId, name: st.name, dept: st.dept, course: st.course });
  ok('30 min after start, grace 10 = Late', r.student.status === 'Late' && !r.already, r.student);
  ok('again = already', (await A.scanStudent(k1._id, { studentId: st.studentId })).already === true);
  await assert.rejects(A.scanStudent(k1._id, { studentId: '999', name: 'N', dept: 'D', course: 'C' }), (e) => e.code === 'NOT_IN_CLASS');
  r = await A.startAttendance(k1._id);
  ok('start late moves start to now', r.session.adjusted === true && r.session.startTime === hh(now), r.session);
  r = await A.scanStudent(k1._id, { studentId: '999', name: 'New', dept: 'CCS', course: 'BSIT' }, { add: true });
  ok('add from scan after start = Present', r.student.status === 'Present' && r.class.students.length === 6, r.student);
  ok('change late-after', (await A.updateClass(k1._id, { lateAfter: 20 })).lateAfter === 20);
  ok('close', (await A.closeAttendance(k1._id)).session.closed === true);
  await assert.rejects(A.scanStudent(k1._id, { studentId: k1.students[1].studentId }), (e) => e.code === 'ATTENDANCE_CLOSED');
  ok('reopen', (await A.reopenAttendance(k1._id)).session.reopened === true);
  r = await A.importStudents(k1._id, [{ name: 'I1', studentId: '501', dept: 'CCS', course: 'BSIT' }, { name: 'dup', studentId: '999', dept: 'CCS' }]);
  ok('import skips IDs already in class', r.added === 1 && r.skipped.length === 1 && r.class.students.length === 7, r);
  const y = U.addDays(U.localDate(), -1);
  r = await A.getClass(k1._id, y);
  ok('past day: no record = null', r.date === y && r.students.every((s) => s.status === null) && r.session.closed === true, r);
  r = await A.setStatus(k1._id, st._id, 'Excuse', y);
  ok('correct a past day', r.students.find((s) => s._id === st._id).status === 'Excuse');
  await assert.rejects(A.getClass(k1._id, U.addDays(U.localDate(), 1)));
  r = await A.getHistory(k1._id, ...A.ranges().d30);
  ok('history has both days with counts', r.dates.length === 2 && r.dates[1].late === 1 && r.dates[1].present === 1 && r.dates[0].excuse === 1, r.dates);
  ok('back to schedule', (await A.resetStart(k1._id)).session.adjusted === false);
  // proxy-scan warning: the same sample student is in every fake class
  const k2 = await A.createClass({ course: 'OTHER', code: 'X2', section: '2', days: ['Monday'], startTime: hh(now - 10), endTime: hh(now + 60) });
  const twin = k2.students.find((x) => x.studentId === st.studentId);
  r = await A.scanStudent(k2._id, { studentId: twin.studentId, name: twin.name, dept: twin.dept, course: twin.course });
  ok('proxy warning on the 2nd overlapping class', r.student.conflict && r.student.conflict.label === 'X1 - Section 1' && /^\d{2}:\d{2}$/.test(r.student.conflict.time), r.student);
  r = await A.getClass(k1._id);
  ok('first class gets the warning too', r.students.find((x) => x._id === st._id).conflict?.label === 'X2 - Section 2', r.students);
  ok('other students not flagged', r.students.filter((x) => x.conflict).length === 1);
  done('19 fake-data checks');
}

// ================= non-uniform time (a different start/end per day) =================
section('Non-uniform time');
{
  const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const other = wd === 'Monday' ? 'Tuesday' : 'Monday';
  // today: the class runs now; the other day: much later
  const times = [{ day: other, startTime: hh(now + 300), endTime: hh(now + 360) }, { day: wd, startTime: hh(now - 30), endTime: hh(now + 60) }];
  const plan = { days: [wd, other], startTime: times[0].startTime, endTime: times[0].endTime, times };
  ok('timesOn picks the weekday', U.timesOn(plan, U.localDate()).startTime === hh(now - 30));
  ok('timesOn falls back to the class times', U.timesOn({ ...plan, times: [] }, U.localDate()).startTime === hh(now + 300));
  const week = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].filter((d) => plan.days.includes(d));
  const lines = U.schedule(plan).split('\n');
  ok('schedule shows one line per day, in week order', lines.length === 2 && lines[0].startsWith(week[0].slice(0, 3)) && lines[1].startsWith(week[1].slice(0, 3)), lines);
  const k = await A.createClass({ course: 'NU', code: 'N1', section: '1', lateAfter: 10, ...plan });
  ok('fake class shows today\'s times', k.startTime === hh(now - 30) && k.endTime === hh(now + 60) && k.times.length === 2);
  const s = k.students[0];
  const r = await A.scanStudent(k._id, { studentId: s.studentId, name: s.name, dept: s.dept });
  ok('scan uses today\'s start (30 min in, 10 min grace = Late)', r.student.status === 'Late', r.student);
  ok('scanning open until today\'s end', r.class.session.closed === false);
  // edit class: back to one time for every day; students and today's scan stay
  const e = await A.updateClass(k._id, { course: 'Edited', code: 'N2', section: '2', days: [wd], startTime: hh(now + 30), endTime: hh(now + 90), times: [], lateAfter: 5, ignored: 'x' });
  ok('edit class (fake mode)', e.course === 'Edited' && e.times.length === 0 && e.startTime === hh(now + 30) && e.lateAfter === 5 && e.ignored === undefined);
  ok('edit keeps students and today\'s scans', e.students.length === k.students.length && e.students.find((x) => x._id === s._id).status === 'Late');
  {
    // what the real server receives for an edit
    const ad = await load('api/adapter.mjs');
    let sent;
    await ad.handle('/classes/abc', { method: 'PATCH', body: { course: 'C', code: 'K', section: '1', days: ['Monday'], startTime: '08:00', endTime: '09:00', times: [{ day: 'Monday', startTime: '08:00', endTime: '09:00' }], lateAfter: 10 } },
      async (p, o) => { sent = o.body; return { class: {} }; });
    ok('edit sends snake_case fields', sent.course === 'C' && sent.start_time === '08:00' && sent.times[0].end_time === '09:00' && sent.late_after === 10);
  }
  done('9 non-uniform + edit checks');
}

// ================= accounts (fake-data mode) =================
section('Accounts');
const me1 = await auth.register({ name: 'Teach', email: 't@x.co', password: 'password1' });
ok('register = teacher', me1.role === 'Educator');
ok('new account must verify its email', me1.verified === false);
await assert.rejects(auth.verifyEmail('000000'));
ok('verify email (fake code 123456)', (await auth.verifyEmail('123456')).verified === true);
ok('change email before verifying', (await auth.changeEmail('t@x.co')).user.email === 't@x.co');
{
  // the real server's answers: email_verified false/true, or missing on older accounts (= verified)
  const ad = await load('api/adapter.mjs');
  const fake = (u) => async () => ({ token: 'x', user: u });
  const v = async (u) => (await ad.handle('/auth/login', { method: 'POST', body: {} }, fake(u))).user.verified;
  ok('server email_verified is read correctly', (await v({ email_verified: false })) === false && (await v({ email_verified: true })) === true && (await v({})) === true);
}
ok('forgot password (fake) tells the code', /123456/.test((await auth.forgotPassword('t@x.co')).message));
await assert.rejects(auth.resetPassword({ email: 't@x.co', code: '000000', password: 'newpass12' }));
ok('reset with the right code logs in', (await auth.resetPassword({ email: 't@x.co', code: '123456', password: 'newpass12' })).email === 't@x.co');
ok('feedback (fake) is accepted', /Thanks/.test((await auth.sendFeedback({ kind: 'Idea', message: 'Dark mode please', appVersion: '1.0.0', platform: 'android 34' })).message));
await auth.deleteAccount('newpass12');
await assert.rejects(auth.me());
ok('deleted account is logged out', true);
done('9 account checks');

fs.rmSync(OUT, { recursive: true, force: true });
console.log(`\nAll ${n} app checks passed`);
