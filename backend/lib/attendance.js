// Shared attendance logic used by every route: who owns a class, a day's session + records,
// Present / Late by time, open / closed scanning, history, import, and the JSON shape the app reads.
const mongoose = require('mongoose');
const Class = require('../models/Class');
const Student = require('../models/Student');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');

const STATUSES = ['Present', 'Late', 'Excuse', 'Absent'];
const COUNTS_AS_HERE = ['Present', 'Late'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MAX_IMPORT = 1000;       // students per import
const MAX_STUDENTS = 1000;     // students per class (keeps one account from filling the database)
const MAX_CLASSES = 100;       // classes per teacher
const MAX_RANGE_DAYS = 366;    // history / export range
const OFFLINE_DAYS = 7;        // how old an offline scan may be when it finally reaches the server

// Default minutes after the class start time a scan still counts as Present (after that = Late).
// Each class can override it (late_after).
const defaultLateAfter = () => {
  const n = Number(process.env.LATE_AFTER_MINUTES);
  return Number.isFinite(n) && n >= 0 ? n : 15;
};
const lateFor = (cls) => (Number.isInteger(cls.late_after) ? cls.late_after : defaultLateAfter());

// An error that the error handler in server.js turns into  { message, code }  with this status
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Wrap async route handlers so a thrown error reaches the error handler instead of hanging the request
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ---------- input helpers ----------
// text from the app or a class list file: hidden control characters (tabs, line breaks, ...) become spaces.
// Also invisible direction marks (U+202E can show "Ana" as "anA" and hide what was really typed).
// lines = true keeps normal line breaks (the bio).
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u200b\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;
const CONTROL_BUT_NL = /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/g;
const str = (v, max = 100, lines = false) => (typeof v === 'string' || typeof v === 'number'
  ? String(v).replace(/\r\n?/g, '\n').replace(lines ? CONTROL_BUT_NL : CONTROL, ' ').replace(/ {2,}/g, ' ').trim().slice(0, max)
  : '');
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const dayNum = (d) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;              // "2026-10-08" -> day number
const fromDayNum = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const validDate = (d) => DATE.test(d || '') && fromDayNum(dayNum(d)) === d; // rejects 2026-02-31

// Late grace minutes sent by the app (Create Class / class settings)
function lateAfterField(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 120) throw new HttpError(400, 'Late after must be 0 to 120 minutes.');
  return n;
}

// ---------- the teacher's local date and time ----------
// The app sends its own clock in X-Local-Date ("2026-10-08") and X-Local-Time ("13:05"), so the
// day and the Present/Late decision follow the teacher's phone even when the server runs in
// another time zone (cloud hosting = UTC). Falls back to the server's own clock.
// The phone's date is only trusted within a day of the real date (every time zone on Earth fits
// in that), so "today" can't be moved to some other week by changing the phone's clock.
function localNow(req) {
  const now = new Date();
  let date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  let minutes = now.getHours() * 60 + now.getMinutes();

  const d = req.get('X-Local-Date');
  const t = req.get('X-Local-Time');
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / DAY_MS;
  if (validDate(d) && Math.abs(dayNum(d) - todayUtc) <= 1) {
    date = d;
    if (TIME.test(t || '')) minutes = toMinutes(t);
  }
  return { date, minutes };
}

// A day the teacher asks to look at / edit (?date=). Today or earlier only.
function pastOrToday(d, now, label = 'date') {
  if (!validDate(d)) throw new HttpError(400, `Invalid ${label}. Use YYYY-MM-DD.`);
  if (d > now.date) throw new HttpError(400, 'That day has not happened yet.');
  return d;
}

// On time (or within the grace minutes) = Present, later = Late
function statusByTime(startTime, minutes, grace = defaultLateAfter()) {
  if (!TIME.test(startTime || '')) return 'Present';
  return minutes <= toMinutes(startTime) + grace ? 'Present' : 'Late';
}

// The class's schedule on one date: that weekday's own times ("non-uniform time"), else the class times.
//   "2026-10-12" (a Monday) -> { start_time: "08:00", end_time: "09:00" }
const weekday = (date) => DAYS[(new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7];
function scheduleOn(cls, date) {
  const t = (cls.times || []).find((x) => x.day === weekday(date));
  return t ? { start_time: t.start_time, end_time: t.end_time } : { start_time: cls.start_time, end_time: cls.end_time };
}

// The start time that counts that day: the "Start attendance" time if the teacher pressed it, else the schedule
const startFor = (cls, session, date) => (session && TIME.test(session.start_time || '') ? session.start_time : scheduleOn(cls, date).start_time);

// Is scanning closed at `minutes` on that date?
//   closed by the teacher at closed_time, or automatically at that day's end time (unless reopened)
function isClosed(cls, session, minutes, date) {
  if (session && TIME.test(session.closed_time || '') && minutes >= toMinutes(session.closed_time)) return true;
  return !(session && session.reopened) && minutes >= toMinutes(scheduleOn(cls, date).end_time);
}

// ---------- ownership ----------
async function ownedClass(req, id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'Class not found.');
  const cls = await Class.findById(id);
  // a class that belongs to another teacher looks exactly like a missing one
  if (!cls || String(cls.teacher_id) !== String(req.user.id)) throw new HttpError(404, 'Class not found.');
  return cls;
}

// ---------- a day's session + one record per student ----------
const isDuplicate = (e) => e && (e.code === 11000 || (Array.isArray(e.writeErrors) && e.writeErrors.every((w) => w.code === 11000)));

async function getSession(classId, date) {
  const find = () => AttendanceSession.findOneAndUpdate(
    { class_id: classId, date },
    { $setOnInsert: { class_id: classId, date } },
    { upsert: true, new: true },
  );
  try {
    return await find();
  } catch (e) {
    if (isDuplicate(e)) return find(); // two requests created it at the same moment - just read it
    throw e;
  }
}

// Makes sure every student of the class has a record for `date` (new students start Absent),
// cleans up records of removed students, and returns the roster sorted by name.
async function roster(cls, date) {
  const session = await getSession(cls._id, date);
  const [students, records] = await Promise.all([
    Student.find({ class_id: cls._id }).sort({ full_name: 1 }),
    AttendanceRecord.find({ session_id: session._id }),
  ]);

  const byStudent = new Map(records.map((r) => [String(r.student_id), r]));
  const missing = students
    .filter((s) => !byStudent.has(String(s._id)))
    .map((s) => ({ session_id: session._id, student_id: s._id, status: 'Absent' }));
  if (missing.length) {
    await AttendanceRecord.insertMany(missing, { ordered: false }).catch((e) => {
      if (!isDuplicate(e)) throw e;
    });
    const fresh = await AttendanceRecord.find({ session_id: session._id, student_id: { $in: missing.map((m) => m.student_id) } });
    fresh.forEach((r) => byStudent.set(String(r.student_id), r));
  }

  const ids = new Set(students.map((s) => String(s._id)));
  const orphans = records.filter((r) => !ids.has(String(r.student_id))).map((r) => r._id);
  if (orphans.length) await AttendanceRecord.deleteMany({ _id: { $in: orphans } });

  const list = students.map((s) => ({ student: s, record: byStudent.get(String(s._id)) }));
  const present = list.filter((x) => x.record && COUNTS_AS_HERE.includes(x.record.status)).length;
  if (session.total_students !== list.length || session.present_count !== present) {
    session.total_students = list.length;
    session.present_count = present;
    await session.save();
  }
  return { session, list };
}

// A past day, read only: nothing is created. Students without a record that day get status null
// ("no attendance taken" - e.g. they were added later, or the class didn't meet).
// (.lean() = plain objects: faster, since nothing here is saved)
async function rosterReadOnly(cls, date) {
  const [session, students] = await Promise.all([
    AttendanceSession.findOne({ class_id: cls._id, date }).lean(),
    Student.find({ class_id: cls._id }).sort({ full_name: 1 }).lean(),
  ]);
  const records = session ? await AttendanceRecord.find({ session_id: session._id }).lean() : [];
  const byStudent = new Map(records.map((r) => [String(r.student_id), r]));
  return { session, list: students.map((s) => ({ student: s, record: byStudent.get(String(s._id)) || null })) };
}

// ---------- JSON the app reads ----------
const studentJson = ({ student, record }, readOnly) => ({
  _id: String(student._id),
  full_name: student.full_name,
  student_id: student.student_id,
  department: student.department,
  course: student.course || '',
  status: record ? record.status : readOnly ? null : 'Absent',
  record_id: record ? String(record._id) : null,
  // proxy-scan warning (see flagProxyScan)
  conflict: record && record.conflict
    ? { time: record.conflict.time, same_teacher: !!record.conflict.same_teacher, other_label: record.conflict.other_label || null }
    : null,
});

// `session` = that day's attendance: which start time counts, the grace minutes, and whether
// scanning is open. `now` decides "closed" for today; past days are always closed.
const classJson = (cls, list, date, session, now) => {
  const today = !now || date === now.date;
  const closedNow = today ? (now ? isClosed(cls, session, now.minutes, date) : false) : true;
  const sched = scheduleOn(cls, date);
  return {
    _id: String(cls._id),
    course: cls.course,
    code: cls.code,
    section: cls.section,
    days: cls.days,
    start_time: sched.start_time, // that day's times (same every day unless the class has `times`)
    end_time: sched.end_time,
    times: (cls.times || []).map((t) => ({ day: t.day, start_time: t.start_time, end_time: t.end_time })),
    late_after: lateFor(cls),
    pinned: !!cls.pinned,
    date,
    today: now ? now.date : date,
    session: {
      date,
      exists: !!session,
      start_time: startFor(cls, session, date),
      adjusted: startFor(cls, session, date) !== sched.start_time,
      late_after: lateFor(cls),
      closed: closedNow,
      closed_time: (session && session.closed_time) || null,
      reopened: !!(session && session.reopened),
    },
    students: list.map((x) => studentJson(x, !today)),
  };
};

// The class with the roster of `date` (default today). Today creates what's missing; past days are read only.
async function fullClass(cls, now, date = now.date) {
  if (date === now.date) {
    const { session, list } = await roster(cls, date);
    return classJson(cls, list, date, session, now);
  }
  const { session, list } = await rosterReadOnly(cls, date);
  return classJson(cls, list, date, session, now);
}

// ---------- students ----------
function studentFields(body) {
  const s = {
    full_name: str(body.full_name ?? body.name, 80),
    student_id: str(body.student_id ?? body.studentId, 30),
    department: str(body.department ?? body.dept, 40),
    course: str(body.course, 40),
  };
  if (!s.full_name || !s.student_id || !s.department) {
    throw new HttpError(400, 'Name, student ID and department are required.');
  }
  if (!/^[A-Za-z0-9#][A-Za-z0-9#-]*$/.test(s.student_id) || !/[A-Za-z0-9]/.test(s.student_id)) {
    throw new HttpError(400, 'Student ID can only have letters, numbers, # and dashes.');
  }
  return s;
}

async function addStudent(cls, body) {
  const s = studentFields(body);
  if (await Student.exists({ class_id: cls._id, student_id: s.student_id })) {
    throw new HttpError(409, 'That student ID is already in this class.', 'ALREADY_IN_CLASS');
  }
  if (await Student.countDocuments({ class_id: cls._id }) >= MAX_STUDENTS) {
    throw new HttpError(400, `A class can have at most ${MAX_STUDENTS} students.`, 'CLASS_FULL');
  }
  // qr_code is unique in the database, so it includes the full class id
  return Student.create({ ...s, class_id: cls._id, qr_code: `GAKU-${s.student_id}-${cls._id}` });
}

// Many students at once (class list file). Bad rows and IDs already in the class are skipped, not fatal.
// rows: [{ full_name, student_id, department, course }]  -> { added, skipped: [{ row, student_id, reason }] }
async function importStudents(cls, rows) {
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'The file has no students.');
  if (rows.length > MAX_IMPORT) throw new HttpError(400, `At most ${MAX_IMPORT} students per file.`);

  const existing = new Set((await Student.find({ class_id: cls._id }, 'student_id')).map((s) => s.student_id));
  const skipped = [];
  const docs = [];
  rows.forEach((raw, i) => {
    let s;
    try {
      s = studentFields(raw && typeof raw === 'object' ? raw : {});
    } catch (e) {
      skipped.push({ row: i + 1, student_id: str(raw?.student_id ?? raw?.studentId, 30), reason: e.message });
      return;
    }
    if (existing.has(s.student_id)) {
      skipped.push({ row: i + 1, student_id: s.student_id, reason: 'Already in this class.' });
      return;
    }
    if (existing.size >= MAX_STUDENTS) {
      skipped.push({ row: i + 1, student_id: s.student_id, reason: `Class is full (${MAX_STUDENTS} students).` });
      return;
    }
    existing.add(s.student_id); // also catches the same ID twice in one file
    docs.push({ ...s, class_id: cls._id, qr_code: `GAKU-${s.student_id}-${cls._id}` });
  });

  if (docs.length) {
    await Student.insertMany(docs, { ordered: false }).catch((e) => {
      if (!isDuplicate(e)) throw e;
    });
  }
  return { added: docs.length, skipped };
}

async function removeStudent(cls, studentDbId) {
  if (!mongoose.isValidObjectId(studentDbId)) throw new HttpError(404, 'Student not found.');
  const student = await Student.findOneAndDelete({ _id: studentDbId, class_id: cls._id });
  if (!student) throw new HttpError(404, 'Student not found.');
  await AttendanceRecord.deleteMany({ student_id: student._id });
}

// Change a status on `date` (today or a past day - the teacher correcting the record)
async function setStatus(cls, studentDbId, status, date) {
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status. Use: Present, Late, Excuse, or Absent.');
  const { list } = await roster(cls, date);
  const row = list.find((x) => String(x.student._id) === String(studentDbId));
  if (!row) throw new HttpError(404, 'Student not found in this class.');
  row.record.status = status;
  row.record.manually_overridden = true;
  await row.record.save();
}

// ---------- QR scan ----------
// body { student_id, add?, full_name?, department?, course?, at?: { date, time } }
//   student in the class           -> marked Present / Late by time (or "already" if they were)
//   not in the class and add=true  -> added, then marked
//   not in the class               -> 404 NOT_IN_CLASS (the app then asks "add them?")
//   scanning closed                -> 409 ATTENDANCE_CLOSED
// `at` = when the scan really happened, for scans saved on the phone while offline (max OFFLINE_DAYS old).
function scanTime(body, now) {
  const at = body.at;
  if (!at || typeof at !== 'object') return now;
  const date = str(at.date, 10), time = str(at.time, 5);
  if (!validDate(date) || !TIME.test(time)) throw new HttpError(400, 'Invalid scan time.');
  if (date > now.date || (date === now.date && toMinutes(time) > now.minutes + 5)) throw new HttpError(400, 'Scan time is in the future.');
  if (dayNum(now.date) - dayNum(date) > OFFLINE_DAYS) throw new HttpError(400, `Offline scans older than ${OFFLINE_DAYS} days can't be saved.`, 'SCAN_TOO_OLD');
  return { date, minutes: toMinutes(time) };
}

// ---------- proxy-scan warning ----------
// A student can't be in two places at once. If the same school ID was already scanned today in
// ANOTHER class whose time overlaps this one, both scans are flagged (someone may be scanning a
// copied ID for a friend). Another teacher's class name is never shown, only the time.
const overlaps = (a, b) => // a, b = { start_time, end_time } of one day
  Math.max(toMinutes(a.start_time), toMinutes(b.start_time)) < Math.min(toMinutes(a.end_time), toMinutes(b.end_time));
const label = (c) => `${c.code} - Section ${c.section}`;

async function flagProxyScan(cls, student, record, when) {
  const twins = await Student.find({ student_id: student.student_id, class_id: { $ne: cls._id } }, '_id class_id');
  for (const twin of twins) {
    const other = await Class.findById(twin.class_id);
    if (!other) continue;
    const mine = scheduleOn(cls, when.date), theirsAt = scheduleOn(other, when.date);
    if (!TIME.test(theirsAt.start_time || '') || !TIME.test(theirsAt.end_time || '') || !overlaps(mine, theirsAt)) continue;
    const session = await AttendanceSession.findOne({ class_id: other._id, date: when.date }, '_id');
    if (!session) continue;
    const theirs = await AttendanceRecord.findOne({
      session_id: session._id, student_id: twin._id, scan_time: { $ne: null }, status: { $in: COUNTS_AS_HERE },
    });
    if (!theirs) continue;
    const same = String(other.teacher_id) === String(cls.teacher_id);
    record.conflict = { time: theirs.scan_time, other_class: other._id, same_teacher: same, other_label: same ? label(other) : undefined };
    theirs.conflict = { time: record.scan_time, other_class: cls._id, same_teacher: same, other_label: same ? label(cls) : undefined };
    await Promise.all([record.save(), theirs.save()]);
    return; // one warning is enough
  }
}

async function scan(cls, body, now) {
  const when = scanTime(body, now);
  const studentId = str(body.student_id ?? body.studentId, 30);
  if (!studentId) throw new HttpError(400, 'Wrong QR, please try again.', 'BAD_QR');

  // closed? (checked before anything is created, so a closed class can't get new students by scanning)
  const existingSession = await AttendanceSession.findOne({ class_id: cls._id, date: when.date });
  if (isClosed(cls, existingSession, when.minutes, when.date)) {
    throw new HttpError(409, 'Attendance is closed for this class.', 'ATTENDANCE_CLOSED');
  }

  let student = await Student.findOne({ class_id: cls._id, student_id: studentId });
  if (!student) {
    if (!body.add) throw new HttpError(404, 'Student not in class.', 'NOT_IN_CLASS');
    student = await addStudent(cls, { ...body, student_id: studentId });
  }

  const { session, list } = await roster(cls, when.date);
  const row = list.find((x) => String(x.student._id) === String(student._id));
  const already = COUNTS_AS_HERE.includes(row.record.status);
  if (!already) {
    row.record.status = statusByTime(startFor(cls, session, when.date), when.minutes, lateFor(cls));
    row.record.scanned_at = new Date();
    row.record.scan_time = hhmm(when.minutes);
    row.record.manually_overridden = false;
    await row.record.save();
    await AttendanceSession.updateOne({ _id: row.record.session_id }, { $inc: { present_count: 1 } });
    await flagProxyScan(cls, student, row.record, when);
  }
  const view = when.date === now.date ? classJson(cls, list, now.date, session, now) : await fullClass(cls, now);
  return { student: studentJson(row), already, class: view };
}

// ---------- "Start attendance" (the teacher is running late) ----------
// Today's start moves to NOW, so Present / Late counts from when the teacher actually started.
// The end time never moves. Earlier than the schedule = keeps the schedule.
async function startAttendance(cls, now) {
  const sched = scheduleOn(cls, now.date);
  if (now.minutes >= toMinutes(sched.end_time)) {
    throw new HttpError(400, 'This class has already ended for today.', 'CLASS_ENDED');
  }
  const { session } = await roster(cls, now.date);
  const start = Math.max(now.minutes, toMinutes(sched.start_time));
  session.start_time = start === toMinutes(sched.start_time) ? null : hhmm(start);
  session.started_at = new Date();
  await session.save();
}

// back to the class's normal start time for today
async function resetStart(cls, now) {
  const { session } = await roster(cls, now.date);
  session.start_time = null;
  session.started_at = null;
  await session.save();
}

// ---------- close / reopen scanning for today ----------
// Students who weren't scanned simply stay Absent (everyone starts Absent).
async function closeAttendance(cls, now) {
  const { session } = await roster(cls, now.date);
  session.closed_time = hhmm(now.minutes);
  session.reopened = false;
  await session.save();
}

async function reopenAttendance(cls, now) {
  const { session } = await roster(cls, now.date);
  session.closed_time = null;
  session.reopened = true; // stays open even after the end time
  await session.save();
}

// ---------- history / export ----------
// Every day with attendance between from and to (inclusive), and each student's status per day.
// -> { from, to, dates: [{ date, start_time, adjusted, present, late, excuse, absent, total }],
//      students: [{ _id, full_name, student_id, department, course, statuses: { [date]: status } }] }
async function history(cls, now, fromQ, toQ) {
  const to = toQ ? pastOrToday(str(toQ, 10), now, 'end date') : now.date;
  const from = fromQ ? pastOrToday(str(fromQ, 10), now, 'start date') : fromDayNum(dayNum(to) - 29);
  if (from > to) throw new HttpError(400, 'The start date is after the end date.');
  if (dayNum(to) - dayNum(from) + 1 > MAX_RANGE_DAYS) throw new HttpError(400, `Pick at most ${MAX_RANGE_DAYS} days.`);

  const [sessions, students] = await Promise.all([
    AttendanceSession.find({ class_id: cls._id, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean(),
    Student.find({ class_id: cls._id }).sort({ full_name: 1 }).lean(),
  ]);
  const records = await AttendanceRecord.find({ session_id: { $in: sessions.map((s) => s._id) } }, 'session_id student_id status').lean();
  const dateOf = new Map(sessions.map((s) => [String(s._id), s.date]));

  const statuses = new Map(students.map((s) => [String(s._id), {}]));
  const counts = new Map(sessions.map((s) => [s.date, { Present: 0, Late: 0, Excuse: 0, Absent: 0 }]));
  for (const r of records) {
    const date = dateOf.get(String(r.session_id));
    const st = statuses.get(String(r.student_id));
    if (!st) continue; // record of a removed student
    st[date] = r.status;
    counts.get(date)[r.status] += 1;
  }

  return {
    from,
    to,
    dates: sessions.map((s) => {
      const c = counts.get(s.date);
      return {
        date: s.date,
        start_time: startFor(cls, s, s.date),
        adjusted: startFor(cls, s, s.date) !== scheduleOn(cls, s.date).start_time,
        present: c.Present, late: c.Late, excuse: c.Excuse, absent: c.Absent,
        total: c.Present + c.Late + c.Excuse + c.Absent,
      };
    }),
    students: students.map((s) => ({
      _id: String(s._id),
      full_name: s.full_name,
      student_id: s.student_id,
      department: s.department,
      course: s.course || '',
      statuses: statuses.get(String(s._id)),
    })),
  };
}

// ---------- class delete (everything that belongs to it goes too) ----------
async function deleteClassDeep(cls) {
  const sessions = await AttendanceSession.find({ class_id: cls._id }, '_id');
  await AttendanceRecord.deleteMany({ session_id: { $in: sessions.map((s) => s._id) } });
  await AttendanceSession.deleteMany({ class_id: cls._id });
  await Student.deleteMany({ class_id: cls._id });
  await cls.deleteOne();
}

module.exports = {
  STATUSES, DAYS, TIME, MAX_CLASSES, HttpError, scheduleOn, wrap, str, toMinutes, localNow, pastOrToday, statusByTime, lateAfterField,
  ownedClass, roster, fullClass, classJson, addStudent, importStudents, removeStudent, setStatus, scan,
  startAttendance, resetStart, closeAttendance, reopenAttendance, history, deleteClassDeep,
};
