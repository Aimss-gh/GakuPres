import AsyncStorage from '@react-native-async-storage/async-storage';
import { USE_MOCK, http } from './http';
import { getToken } from './session';
import { queueScan, flushScans } from './offline';
import { wait, load, save, uid, SAMPLE_STUDENTS } from './mockDb';
import { LATE_AFTER_MIN, STATUSES } from '../constants';
import { addDays, classEnded, closedAtMin, localDate, minToTime, nowMin, statusByTime, timesOn } from '../utils';

// Every function that CHANGES a class returns the UPDATED class, so screens never need a second request.
// Every class comes with `students`, each carrying that day's status (today unless a date is asked for).

const enc = encodeURIComponent; // ids can come from outside - never paste them into a url raw
const url = (id, sid) => `/classes/${enc(id)}${sid ? '/students/' + enc(sid) : ''}`;
const q = (date) => (date ? `?date=${enc(date)}` : '');
const fail = (message, code, status = 400) => Object.assign(new Error(message), { code, status });
const notInClass = () => fail('Student not in class.', 'NOT_IN_CLASS', 404);
const closedErr = () => fail('Attendance is closed for this class.', 'ATTENDANCE_CLOSED', 409);
const here = (st) => st === 'Present' || st === 'Late';

// ---- last copy of each class, so the scanner still knows the roster when the server can't be reached ----
const CACHE = 'gp_class_';
const cacheClass = (c) => { if (c?._id && c.date === c.today) AsyncStorage.setItem(CACHE + c._id, JSON.stringify(c)).catch(() => {}); return c; };
const cachedClass = async (id) => {
  try { return JSON.parse(await AsyncStorage.getItem(CACHE + id)); } catch { return null; }
};

// ================= mock helpers (deleted together with mockDb when the backend is real) =================
// A mock class stores its students once and per day: att[date][studentDbId] = status,
// starts[date] = "Start attendance" time, closed[date] = "Close attendance" time, reopened[date] = true.
const me = async () => (await getToken())?.replace(/^mock-/, '') || null;
const graceOf = (c) => (Number.isInteger(c.lateAfter) ? c.lateAfter : LATE_AFTER_MIN);
const view = (c, date = localDate()) => {
  const today = localDate();
  const isToday = date === today;
  const day = c.att?.[date];
  const moved = c.starts?.[date];
  const { att, starts, closed, reopened, owner, scanAt, flags, ...rest } = c;
  const t = timesOn(c, date); // that day's start/end (a class can have a different time each day)
  return {
    ...rest,
    startTime: t.startTime,
    endTime: t.endTime,
    lateAfter: graceOf(c),
    date,
    today,
    session: {
      startTime: moved || t.startTime,
      adjusted: !!moved,
      lateAfter: graceOf(c),
      closed: isToday ? closedAtMin(t, c.closed?.[date], c.reopened?.[date]) : true,
      closedTime: c.closed?.[date] || null,
      reopened: !!c.reopened?.[date],
      exists: !!day,
    },
    students: [...c.students]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ status, ...s }) => ({ ...s, course: s.course || '', status: day?.[s._id] || (isToday ? 'Absent' : null), conflict: c.flags?.[date]?.[s._id] || null })),
  };
};
const mine = async (db) => {
  const owner = await me();
  return db.classes.filter((c) => !c.owner || c.owner === owner);
};
const need = async (db, id) => {
  const c = (await mine(db)).find((x) => x._id === id);
  if (!c) throw new Error('Class not found');
  return c;
};
const setDay = (c, sid, status, d = localDate()) => {
  c.att = { ...c.att, [d]: { ...c.att?.[d], [sid]: status } };
};
const setFor = (c, key, value, d = localDate()) => { c[key] = { ...c[key], [d]: value }; };
async function mutate(id, fn, ms = 80, date) {
  await wait(ms);
  const db = await load();
  const c = await need(db, id);
  fn(c);
  await save(db);
  return view(c, date);
}
const newStudent = (s) => ({ _id: uid(), name: s.name, studentId: s.studentId, dept: s.dept, course: s.course || '' });
const checkDate = (date) => {
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate())) throw new Error('That day has not happened yet.');
};

// ================= classes =================
// GET /api/classes
export async function listClasses() {
  if (!USE_MOCK) return (await http('/classes')).map(cacheClass);
  await wait();
  return (await mine(await load())).map((c) => view(c));
}

// GET /api/classes/:id            today
// GET /api/classes/:id?date=...   a past day (read only; status null = no record that day)
// Offline (real server): today's last saved copy, with offline: true.
export async function getClass(id, date) {
  if (!USE_MOCK) {
    try {
      return cacheClass(await http(url(id) + q(date)));
    } catch (e) {
      const c = e.status === 0 && !date && (await cachedClass(id));
      if (c) return { ...c, offline: true };
      throw e;
    }
  }
  checkDate(date);
  await wait(120);
  return view(await need(await load(), id), date || localDate());
}

// POST /api/classes   body { course, code, section, days:[..], startTime:"13:00", endTime:"16:00", lateAfter: 15,
//                            times: [{ day: "Monday", startTime, endTime }, ...] (only for "non-uniform time", else []) }
export async function createClass(form) {
  if (!USE_MOCK) return http('/classes', { method: 'POST', body: form });
  await wait();
  const db = await load();
  const cls = {
    _id: uid(), owner: await me(), ...form, pinned: false, att: {},
    students: SAMPLE_STUDENTS.map(([name, studentId, dept, course]) => newStudent({ name, studentId, dept, course })),
  };
  db.classes.push(cls);
  await save(db);
  return view(cls);
}

// PATCH /api/classes/:id   body { lateAfter }   (minutes after the start a scan still counts as Present)
//   Edit class: body { course, code, section, days, startTime, endTime, times, lateAfter } - all of it is replaced.
//   Attendance already taken stays.
const EDIT_KEYS = ['course', 'code', 'section', 'days', 'startTime', 'endTime', 'times', 'lateAfter'];
export async function updateClass(id, patch, date) {
  const body = Object.fromEntries(EDIT_KEYS.filter((k) => k in patch).map((k) => [k, patch[k]]));
  if (!USE_MOCK) return http(url(id) + q(date), { method: 'PATCH', body });
  return mutate(id, (c) => { Object.assign(c, body); }, 80, date);
}

// DELETE /api/classes/:id   -> { ok: true }
export async function deleteClass(id) {
  if (!USE_MOCK) return http(url(id), { method: 'DELETE' });
  await wait();
  const db = await load();
  await need(db, id);
  db.classes = db.classes.filter((c) => c._id !== id);
  await save(db);
  return { ok: true };
}

// PATCH /api/classes/:id/pin   body { pinned: true|false }
export const setPinned = (id, pinned) =>
  USE_MOCK ? mutate(id, (c) => { c.pinned = !!pinned; }) : http(url(id) + '/pin', { method: 'PATCH', body: { pinned } });

// ================= students =================
// POST /api/classes/:id/students   body { name, studentId, dept, course? }
export const addStudent = (id, s) =>
  USE_MOCK
    ? mutate(id, (c) => {
        if (c.students.some((x) => x.studentId === s.studentId)) throw new Error('That student ID is already in this class');
        c.students.push(newStudent(s));
      })
    : http(url(id) + '/students', { method: 'POST', body: s });

// POST /api/classes/:id/students/import   body { students: [{ name, studentId, dept, course }] }
// -> { added, skipped: [{ row, student_id, reason }], class }
export async function importStudents(id, students) {
  if (!USE_MOCK) return http(url(id) + '/students/import', { method: 'POST', body: { students } });
  let added = 0;
  const skipped = [];
  const cls = await mutate(id, (c) => {
    const have = new Set(c.students.map((x) => x.studentId));
    students.forEach((s, i) => {
      if (have.has(s.studentId)) return skipped.push({ row: i + 1, student_id: s.studentId, reason: 'Already in this class.' });
      have.add(s.studentId);
      c.students.push(newStudent(s));
      added++;
    });
  }, 200);
  return { added, skipped, class: cls };
}

// PATCH /api/classes/:id/students/:sid   body { status, date? }   (Present | Late | Excuse | Absent; today or a past day)
export async function setStatus(id, sid, status, date) {
  if (!USE_MOCK) return http(url(id, sid), { method: 'PATCH', body: { status, date } });
  if (!STATUSES.includes(status)) throw new Error('Invalid status');
  checkDate(date);
  return mutate(id, (c) => {
    if (!c.students.some((s) => s._id === sid)) throw new Error('Student not found in this class');
    setDay(c, sid, status, date || localDate());
  }, 80, date);
}

// DELETE /api/classes/:id/students/:sid
export const removeStudent = (id, sid, date) =>
  USE_MOCK
    ? mutate(id, (c) => { c.students = c.students.filter((s) => s._id !== sid); }, 80, date)
    : http(url(id, sid) + q(date), { method: 'DELETE' });

// ================= scanning =================
// POST /api/classes/:id/scan   body { studentId, name, dept, course, add? }  -> { student, class, already, offline? }
// `s` is what src/qr.js read from the student's ID QR. The student is found by ID INSIDE THIS
// CLASS and marked Present or Late by the time. Not in the class -> error with code NOT_IN_CLASS;
// call again with { add: true } to add them and mark them in one go. Closed -> ATTENDANCE_CLOSED.
// Server can't be reached -> the scan is saved on the phone (offline.js) and sent later.
export async function scanStudent(id, s, { add = false } = {}) {
  if (!USE_MOCK) {
    try {
      const r = await http(url(id) + '/scan', { method: 'POST', body: { ...s, add } });
      cacheClass(r.class);
      flushScans().catch(() => {}); // we're online: send anything saved earlier
      return r;
    } catch (e) {
      if (e.status !== 0) throw e;
      return scanOffline(id, s, add, e);
    }
  }
  await wait(120);
  const db = await load();
  const c = await need(db, id);
  const d = localDate();
  if (closedAtMin(timesOn(c, d), c.closed?.[d], c.reopened?.[d])) throw closedErr();
  let stu = c.students.find((x) => x.studentId === s.studentId);
  if (!stu) {
    if (!add) throw notInClass();
    stu = newStudent(s);
    c.students.push(stu);
  }
  const already = here(c.att?.[d]?.[stu._id]);
  if (!already) {
    setDay(c, stu._id, statusByTime(c.starts?.[d] || timesOn(c, d).startTime, new Date(), graceOf(c)));
    c.scanAt = { ...c.scanAt, [d]: { ...c.scanAt?.[d], [stu._id]: minToTime(nowMin()) } };
    flagProxyMock(db, c, stu, d);
  }
  await save(db);
  const cls = view(c);
  return { student: cls.students.find((x) => x._id === stu._id), class: cls, already };
}

// fake-data version of the proxy-scan warning: same school ID scanned today in another class whose time overlaps
const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const overlaps = (a, b) => Math.max(toMinutes(a.startTime), toMinutes(b.startTime)) < Math.min(toMinutes(a.endTime), toMinutes(b.endTime));
function flagProxyMock(db, c, stu, d) {
  for (const o of db.classes) {
    const mine = timesOn(c, d), theirs = timesOn(o, d);
    if (o === c || !theirs.startTime || !theirs.endTime || !overlaps(mine, theirs)) continue;
    const twin = o.students.find((x) => x.studentId === stu.studentId);
    const time = twin && o.scanAt?.[d]?.[twin._id];
    if (!time || !here(o.att?.[d]?.[twin._id])) continue;
    const same = o.owner === c.owner;
    const mark = (k, sid, flag) => { k.flags = { ...k.flags, [d]: { ...k.flags?.[d], [sid]: flag } }; };
    mark(c, stu._id, { time, sameTeacher: same, label: same ? `${o.code} - Section ${o.section}` : null });
    mark(o, twin._id, { time: c.scanAt[d][stu._id], sameTeacher: same, label: same ? `${c.code} - Section ${c.section}` : null });
    return;
  }
}

// No connection: check the last saved roster on the phone, save the scan, show a best guess.
async function scanOffline(id, s, add, networkError) {
  const cls = await cachedClass(id);
  if (!cls || cls.today !== localDate()) throw networkError; // never opened today with a connection: can't check the roster
  if (cls.session?.closed || closedAtMin(cls, cls.session?.closedTime, cls.session?.reopened)) throw closedErr();
  const known = cls.students.find((x) => x.studentId === s.studentId);
  if (!known && !add) throw notInClass();

  const already = !!known && here(known.status);
  const status = already ? known.status : statusByTime(cls.session?.startTime || cls.startTime, new Date(), cls.session?.lateAfter);
  const student = { ...(known || { _id: `offline-${s.studentId}`, ...s }), status };
  if (!already) await queueScan(id, s, add && !known);
  const next = { ...cls, offline: true, students: known ? cls.students.map((x) => (x === known ? student : x)) : [...cls.students, student] };
  cacheClass(next);
  return { student, class: next, already, offline: true };
}

// ================= today's session =================
// POST /api/classes/:id/start   "Start attendance" now (the teacher is late): Present/Late counts from now.
// The end time stays the same. Pressed before the scheduled start = keeps the schedule.
export async function startAttendance(id) {
  if (!USE_MOCK) return http(url(id) + '/start', { method: 'POST' });
  return mutate(id, (c) => {
    const t = timesOn(c, localDate());
    if (classEnded(t)) throw fail('This class has already ended for today.', 'CLASS_ENDED');
    const [h, m] = t.startTime.split(':').map(Number);
    const start = minToTime(Math.max(nowMin(), h * 60 + m));
    setFor(c, 'starts', start === t.startTime ? undefined : start);
  });
}

// DELETE /api/classes/:id/start   back to the scheduled start time for today
export async function resetStart(id) {
  if (!USE_MOCK) return http(url(id) + '/start', { method: 'DELETE' });
  return mutate(id, (c) => setFor(c, 'starts', undefined));
}

// POST /api/classes/:id/close    stop scanning for today (students not scanned stay Absent)
export async function closeAttendance(id) {
  if (!USE_MOCK) return http(url(id) + '/close', { method: 'POST' });
  return mutate(id, (c) => { setFor(c, 'closed', minToTime(nowMin())); setFor(c, 'reopened', undefined); });
}

// POST /api/classes/:id/reopen   allow scanning again (also after the end time)
export async function reopenAttendance(id) {
  if (!USE_MOCK) return http(url(id) + '/reopen', { method: 'POST' });
  return mutate(id, (c) => { setFor(c, 'closed', undefined); setFor(c, 'reopened', true); });
}

// ================= history / export =================
// GET /api/classes/:id/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
// -> { from, to, dates: [{ date, startTime, adjusted, present, late, excuse, absent, total }],
//      students: [{ _id, name, studentId, dept, course, statuses: { [date]: status } }] }
export async function getHistory(id, from, to) {
  if (!USE_MOCK) return http(`${url(id)}/attendance?from=${enc(from)}&to=${enc(to)}`);
  await wait(150);
  const c = await need(await load(), id);
  const days = Object.keys(c.att || {}).filter((d) => d >= from && d <= to && Object.keys(c.att[d]).length).sort();
  const ids = new Set(c.students.map((s) => s._id));
  return {
    from, to,
    dates: days.map((d) => {
      const n = { Present: 0, Late: 0, Excuse: 0, Absent: 0 };
      // a mock day only stores students whose status was set; everyone else that day was Absent
      c.students.forEach((s) => { n[c.att[d][s._id] || 'Absent'] += 1; });
      return { date: d, startTime: c.starts?.[d] || timesOn(c, d).startTime, adjusted: !!c.starts?.[d], present: n.Present, late: n.Late, excuse: n.Excuse, absent: n.Absent, total: ids.size };
    }),
    students: [...c.students].sort((a, b) => a.name.localeCompare(b.name)).map(({ status, ...s }) => ({
      ...s, course: s.course || '', statuses: Object.fromEntries(days.map((d) => [d, c.att[d][s._id] || 'Absent'])),
    })),
  };
}

// ready-made ranges for the History screen: [from, to]
export const ranges = (today = localDate()) => ({
  week: [addDays(today, -6), today],
  month: [today.slice(0, 8) + '01', today],
  d30: [addDays(today, -29), today],
  year: [addDays(today, -365), today],
});
