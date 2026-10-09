// Everything the app needs about a class, in one place. Every reply that shows a class includes
// a day's roster (students + their status that day), so the app never needs a second request.
const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const authMiddleware = require('../middleware/auth');
const A = require('../lib/attendance');

const { HttpError, wrap, str } = A;
router.use(authMiddleware, authMiddleware.verified, authMiddleware.only('Educator', 'Admin'));

// the class with today's roster, or the roster of ?date=YYYY-MM-DD / body.date (a past day)
const reply = (cls, req, now = A.localNow(req)) => A.fullClass(cls, now, dayOf(req, now));
const dayOf = (req, now) => {
  const d = req.query.date ?? req.body?.date;
  return d === undefined || d === '' ? now.date : A.pastOrToday(str(d, 10), now);
};

// ─────────────────────────────────────────
// POST /api/classes
// body { course, code, section, days: ["Monday", ...] or "Monday,Wednesday", start_time: "13:00", end_time: "16:00",
//        late_after?: 15, times?: [{ day: "Monday", start_time, end_time }, ...] }
// times = "non-uniform time": one start/end for EVERY picked day (then start_time / end_time can be left out)
// ─────────────────────────────────────────
const EDITABLE = ['course', 'code', 'section', 'days', 'start_time', 'end_time', 'times'];

// The class fields from a request body, checked: used by create and by edit.
function classFields(b) {
  const days = (Array.isArray(b.days) ? b.days : String(b.days || '').split(','))
    .map((d) => String(d).trim())
    .filter((d) => A.DAYS.includes(d));
  const fields = {
    course: str(b.course, 40),
    code: str(b.code, 40),
    section: str(b.section, 40),
    days: [...new Set(days)].join(','),
    start_time: str(b.start_time, 5),
    end_time: str(b.end_time, 5),
  };

  // non-uniform time: one entry per picked day, in week order; the class times become the first day's
  let times = [];
  if (Array.isArray(b.times) && b.times.length) {
    const picked = fields.days.split(',').filter(Boolean);
    times = A.DAYS.filter((d) => picked.includes(d)).map((day) => {
      const t = b.times.find((x) => x && x.day === day) || {};
      const start_time = str(t.start_time, 5), end_time = str(t.end_time, 5);
      if (!A.TIME.test(start_time) || !A.TIME.test(end_time)) throw new HttpError(400, `Set the start and end time for ${day}.`);
      if (A.toMinutes(end_time) <= A.toMinutes(start_time)) throw new HttpError(400, `${day}: end time must be after start time.`);
      return { day, start_time, end_time };
    });
    if (times.length) Object.assign(fields, { start_time: times[0].start_time, end_time: times[0].end_time });
  }

  if (Object.values(fields).some((v) => !v)) throw new HttpError(400, 'Fill in every field first.');
  if (!A.TIME.test(fields.start_time) || !A.TIME.test(fields.end_time)) throw new HttpError(400, 'Times must look like 13:00.');
  if (A.toMinutes(fields.end_time) <= A.toMinutes(fields.start_time)) throw new HttpError(400, 'End time must be after start time.');
  fields.times = times;
  return fields;
}

router.post('/', wrap(async (req, res) => {
  const b = req.body;
  const fields = classFields(b);
  if (await Class.countDocuments({ teacher_id: req.user.id }) >= A.MAX_CLASSES) {
    throw new HttpError(400, `You can have at most ${A.MAX_CLASSES} classes. Delete old ones first.`, 'TOO_MANY_CLASSES');
  }
  const cls = await Class.create({ ...fields, late_after: A.lateAfterField(b.late_after), teacher_id: req.user.id });
  const now = A.localNow(req);
  res.status(201).json({ message: 'Class created.', class: A.classJson(cls, [], now.date, null, now) });
}));

// ─────────────────────────────────────────
// GET /api/classes
// All classes of the logged-in teacher, each with today's roster
// ─────────────────────────────────────────
router.get('/', wrap(async (req, res) => {
  const now = A.localNow(req);
  const classes = await Class.find({ teacher_id: req.user.id }).sort({ pinned: -1, createdAt: -1 });
  res.json(await Promise.all(classes.map((c) => A.fullClass(c, now))));
}));

// ─────────────────────────────────────────
// GET /api/classes/:id            today's roster
// GET /api/classes/:id?date=YYYY-MM-DD   a past day (read only; status null = no record that day)
// ─────────────────────────────────────────
router.get('/:id', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  res.json(await reply(cls, req));
}));

// ─────────────────────────────────────────
// PATCH /api/classes/:id   body { late_after } and/or the class fields (course, code, section, days, start_time,
//                          end_time, times) - "Edit class"
// ─────────────────────────────────────────
router.patch('/:id', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  // "Edit class": sending any of these replaces all of them (same checks as create).
  // Attendance already taken stays as it is; a "Start attendance" time pressed today stays too.
  if (EDITABLE.some((k) => k in req.body)) Object.assign(cls, classFields(req.body));
  if ('late_after' in req.body) cls.late_after = A.lateAfterField(req.body.late_after);
  await cls.save();
  res.json({ message: 'Class updated.', class: await reply(cls, req) });
}));

// ─────────────────────────────────────────
// DELETE /api/classes/:id   (also deletes its students and all attendance)
// ─────────────────────────────────────────
router.delete('/:id', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  await A.deleteClassDeep(cls);
  res.json({ message: 'Class deleted.' });
}));

// ─────────────────────────────────────────
// PATCH /api/classes/:id/pin   body { pinned: true | false }
// ─────────────────────────────────────────
router.patch('/:id/pin', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  cls.pinned = !!req.body.pinned;
  await cls.save();
  res.json({ message: 'Pin updated.', class: await A.fullClass(cls, A.localNow(req)) });
}));

// ─────────────────────────────────────────
// GET /api/classes/:id/attendance?from=YYYY-MM-DD&to=YYYY-MM-DD   history + export data (default: last 30 days)
// ─────────────────────────────────────────
router.get('/:id/attendance', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  res.json(await A.history(cls, A.localNow(req), req.query.from, req.query.to));
}));

// ─────────────────────────────────────────
// POST /api/classes/:id/students   body { full_name, student_id, department, course? }
// ─────────────────────────────────────────
router.post('/:id/students', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  await A.addStudent(cls, req.body);
  res.status(201).json({ message: 'Student added.', class: await A.fullClass(cls, A.localNow(req)) });
}));

// ─────────────────────────────────────────
// POST /api/classes/:id/students/import   body { students: [{ full_name, student_id, department, course }] }
// -> { added, skipped: [{ row, student_id, reason }], class }
// ─────────────────────────────────────────
router.post('/:id/students/import', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const result = await A.importStudents(cls, req.body.students);
  res.json({ ...result, class: await A.fullClass(cls, A.localNow(req)) });
}));

// ─────────────────────────────────────────
// PATCH /api/classes/:id/students/:sid   body { status, date? }   (today, or a past day to correct it)
// ─────────────────────────────────────────
router.patch('/:id/students/:sid', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const now = A.localNow(req);
  const date = dayOf(req, now);
  await A.setStatus(cls, req.params.sid, req.body.status, date);
  res.json({ message: 'Status updated.', class: await A.fullClass(cls, now, date) });
}));

// ─────────────────────────────────────────
// DELETE /api/classes/:id/students/:sid
// ─────────────────────────────────────────
router.delete('/:id/students/:sid', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  await A.removeStudent(cls, req.params.sid);
  res.json({ message: 'Student removed.', class: await reply(cls, req) });
}));

// ─────────────────────────────────────────
// POST /api/classes/:id/scan
// body { student_id, add?, full_name?, department?, course?, at?: { date, time } }  -> { student, already, class }
// Marks the student Present or Late by the time. 404 code NOT_IN_CLASS if the ID isn't in the
// class; send again with add: true (+ name, department, course) to add them and mark them.
// 409 ATTENDANCE_CLOSED after the end time or "Close attendance". `at` = offline scan's real time.
// ─────────────────────────────────────────
router.post('/:id/scan', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  res.json(await A.scan(cls, req.body, A.localNow(req)));
}));

// ─────────────────────────────────────────
// POST   /api/classes/:id/start   "Start attendance" now (teacher is late): Present/Late counts from now
// DELETE /api/classes/:id/start   back to the scheduled start time for today
// The end time never changes.
// ─────────────────────────────────────────
router.post('/:id/start', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const now = A.localNow(req);
  await A.startAttendance(cls, now);
  res.json({ message: 'Attendance started.', class: await A.fullClass(cls, now) });
}));

router.delete('/:id/start', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const now = A.localNow(req);
  await A.resetStart(cls, now);
  res.json({ message: 'Start time reset.', class: await A.fullClass(cls, now) });
}));

// ─────────────────────────────────────────
// POST /api/classes/:id/close    stop scanning for today (unscanned students stay Absent)
// POST /api/classes/:id/reopen   allow scanning again (even after the end time)
// ─────────────────────────────────────────
router.post('/:id/close', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const now = A.localNow(req);
  await A.closeAttendance(cls, now);
  res.json({ message: 'Attendance closed.', class: await A.fullClass(cls, now) });
}));

router.post('/:id/reopen', wrap(async (req, res) => {
  const cls = await A.ownedClass(req, req.params.id);
  const now = A.localNow(req);
  await A.reopenAttendance(cls, now);
  res.json({ message: 'Attendance reopened.', class: await A.fullClass(cls, now) });
}));

module.exports = router;
