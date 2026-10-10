// ADAPTER: the ONLY file that knows the real backend's field names.
// The screens and classApi.js call app-style requests (/classes/:id/scan, ...); http.js hands
// every request here, this file renames the fields for the backend and renames the reply back.
//
//   app shape    : class = { _id, course, code, section, days:[..], startTime, endTime, times:[..], lateAfter, pinned,
//                            date, today, session: {..}, students:[{ _id, name, studentId, dept, course, status }] }
//   backend shape: snake_case (full_name, student_id, department, start_time ...), days as
//                  "Monday,Wednesday" text. Every class reply already includes that day's roster.

// ---------- backend -> app ----------
const mapUser = (u = {}) => ({
  _id: String(u._id ?? u.id ?? ''),
  name: u.full_name ?? u.name ?? '',
  email: u.email ?? '',
  role: u.user_type ?? u.role ?? 'Educator',
  bio: u.bio ?? '',
  avatar: u.avatar ?? null,
  verified: u.email_verified ?? u.verified ?? true, // false = must enter the emailed code first (VerifyEmail screen)
});

const mapStudent = (s = {}) => ({
  _id: String(s._id),
  name: s.full_name ?? '',
  studentId: s.student_id ?? '',
  dept: s.department ?? '',
  course: s.course ?? '',
  status: s.status === undefined ? 'Absent' : s.status, // null = no record that (past) day
  // proxy-scan warning: also scanned in another class at the same time that day
  conflict: s.conflict ? { time: s.conflict.time, sameTeacher: !!s.conflict.same_teacher, label: s.conflict.other_label || null } : null,
});

const mapClass = (c = {}) => ({
  _id: String(c._id),
  course: c.course ?? '',
  code: c.code ?? '',
  section: c.section ?? '',
  days: (Array.isArray(c.days) ? c.days : String(c.days ?? '').split(',')).map((d) => String(d).trim()).filter(Boolean),
  startTime: c.start_time ?? '', // the times of THAT day (`date`): same every day unless `times` has entries
  endTime: c.end_time ?? '',
  times: (c.times ?? []).map((t) => ({ day: t.day, startTime: t.start_time, endTime: t.end_time })), // per day, or []
  lateAfter: c.late_after ?? 15,
  pinned: !!c.pinned,
  date: c.date ?? '',     // the day this roster is for
  today: c.today ?? '',   // the server's "today" (same as the phone's)
  // that day's attendance: which start time counts (moved by "Start attendance"), grace minutes, open/closed
  session: {
    startTime: c.session?.start_time ?? c.start_time ?? '',
    adjusted: !!c.session?.adjusted,
    lateAfter: c.session?.late_after ?? c.late_after ?? 15,
    closed: !!c.session?.closed,
    closedTime: c.session?.closed_time ?? null,
    reopened: !!c.session?.reopened,
    exists: c.session?.exists ?? true,
  },
  students: (c.students ?? []).map(mapStudent),
});

const mapHistory = (h = {}) => ({
  from: h.from,
  to: h.to,
  dates: (h.dates ?? []).map((d) => ({
    date: d.date, startTime: d.start_time, adjusted: !!d.adjusted,
    present: d.present, late: d.late, excuse: d.excuse, absent: d.absent, total: d.total,
  })),
  students: (h.students ?? []).map((s) => ({ ...mapStudent(s), statuses: s.statuses ?? {} })),
});

// ---------- app -> backend ----------
const studentBody = (s = {}) => ({ full_name: s.name, student_id: s.studentId, department: s.dept, course: s.course });

// ---------- the entry point (called by http.js) ----------
export async function handle(path, { method = 'GET', body, at } = {}, raw) {
  const b = body || {};
  const [p] = path.split('?'); // the query string (?date=...) goes to the server as-is

  // ---- auth ----
  if (p === '/auth/login') {
    const d = await raw(path, { method, body: { email: b.email, password: b.password, remember: !!b.remember } });
    return { token: d.token, user: mapUser(d.user) };
  }
  if (p === '/auth/register') {
    const d = await raw(path, { method, body: { full_name: b.name, email: b.email, password: b.password } });
    return { token: d.token, user: mapUser(d.user) };
  }
  if (p === '/auth/forgot') return raw(path, { method: 'POST', body: { email: b.email } }); // -> { message }
  if (p === '/auth/reset') {
    const d = await raw(path, { method: 'POST', body: { email: b.email, code: b.code, password: b.password } });
    return { token: d.token, user: mapUser(d.user) };
  }
  if (p === '/auth/verify') {
    const d = await raw(path, { method: 'POST', body: { code: b.code } });
    return { user: mapUser(d.user) };
  }
  if (p === '/auth/verify/resend') return raw(path, { method: 'POST' }); // -> { message }
  if (p === '/auth/verify/email') {
    const d = await raw(path, { method: 'POST', body: { email: b.email } });
    return { message: d.message, user: mapUser(d.user) };
  }
  if (p === '/auth/me') {
    if (method === 'DELETE') { await raw(path, { method, body: { password: b.password } }); return { ok: true }; }
    const d = method === 'PATCH'
      ? await raw(path, { method, body: { full_name: b.name, bio: b.bio, avatar: b.avatar } })
      : await raw(path);
    return { user: mapUser(d.user) };
  }
  if (p === '/auth/logout') return { ok: true }; // the backend has no logout; the app deletes its own token
  if (p === '/feedback') {
    return raw(path, { method: 'POST', body: { kind: b.kind, message: b.message, app_version: b.appVersion, platform: b.platform } });
  }

  // ---- classes ----
  if (p === '/classes') {
    if (method === 'POST') {
      const d = await raw(path, {
        method,
        body: {
          course: b.course, code: b.code, section: b.section, days: b.days,
          start_time: b.startTime, end_time: b.endTime, late_after: b.lateAfter,
          times: (b.times ?? []).map((t) => ({ day: t.day, start_time: t.startTime, end_time: t.endTime })),
        },
      });
      return mapClass(d.class);
    }
    const list = await raw(path);
    return (Array.isArray(list) ? list : []).map(mapClass);
  }

  const m = p.match(/^\/classes\/([^/]+)(?:\/(pin|scan|start|close|reopen|attendance|students)(?:\/([^/]+))?)?$/);
  if (!m) return raw(path, { method, body });
  const part = m[2], sub = m[3];

  if (!part) {
    if (method === 'DELETE') { await raw(path, { method }); return { ok: true }; }
    if (method === 'PATCH') {
      // late-after minutes, and/or the whole class when it's edited (Edit class)
      const body = { late_after: b.lateAfter };
      if ('course' in b) {
        Object.assign(body, {
          course: b.course, code: b.code, section: b.section, days: b.days, start_time: b.startTime, end_time: b.endTime,
          times: (b.times ?? []).map((t) => ({ day: t.day, start_time: t.startTime, end_time: t.endTime })),
        });
      }
      return mapClass((await raw(path, { method, body })).class);
    }
    return mapClass(await raw(path));
  }
  if (part === 'attendance') return mapHistory(await raw(path));
  if (part === 'start' || part === 'close' || part === 'reopen') return mapClass((await raw(path, { method })).class);
  if (part === 'pin') return mapClass((await raw(path, { method, body: { pinned: !!b.pinned } })).class);
  if (part === 'students') {
    if (sub === 'import') {
      const d = await raw(path, { method: 'POST', body: { students: (b.students ?? []).map(studentBody) } });
      return { added: d.added, skipped: d.skipped ?? [], class: mapClass(d.class) };
    }
    const sent = method === 'POST' ? studentBody(b) : method === 'PATCH' ? { status: b.status, date: b.date } : undefined;
    return mapClass((await raw(path, { method, body: sent })).class);
  }

  // part === 'scan'   (`at` = when an offline scan really happened)
  const d = await raw(path, {
    method: 'POST',
    body: { student_id: b.studentId, add: !!b.add, ...studentBody(b), ...(at && { at }) },
  });
  return { student: mapStudent(d.student), class: mapClass(d.class), already: !!d.already };
}
