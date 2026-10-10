import { DAYS, LATE_AFTER_MIN, MASK_ID_DIGITS } from './constants';

export const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

const pad = (n) => String(n).padStart(2, '0');

// "13:00" -> "1:00 pm"  (one tight string - no spaces between the numbers)
export const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'pm' : 'am'}`;
};
// hour(1-12) + minute + pm? -> "13:00"  (the format saved and sent to the server)
export const to24 = (h, m, pm) => `${pad((h % 12) + (pm ? 12 : 0))}:${pad(m)}`;
export const from24 = (t) => {
  if (!t) return { h: 8, m: 0, pm: false };
  const [h, m] = t.split(':').map(Number);
  return { h: h % 12 || 12, m, pm: h >= 12 };
};

// ['Wednesday'] -> "Wednesday"   ['Wednesday','Monday'] -> "Mon/Wed"
export const fmtDays = (d) => {
  const list = (Array.isArray(d) ? d : [d]).filter(Boolean).sort((a, b) => DAYS.indexOf(a) - DAYS.indexOf(b));
  return list.length === 1 ? list[0] : list.map((x) => x.slice(0, 3)).join('/');
};

// "Mon/Wed, 1:00 pm - 3:00 pm", or one line per day for a class with a different time each day:
// "Mon 8:00 am - 9:00 am\nWed 1:00 pm - 3:00 pm"
export const schedule = (c) => (c.times?.length
  ? [...c.times].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day))
    .map((t) => `${t.day.slice(0, 3)} ${fmtTime(t.startTime)} - ${fmtTime(t.endTime)}`).join('\n')
  : `${fmtDays(c.days)}, ${fmtTime(c.startTime)} - ${fmtTime(c.endTime)}`);
export const presentCount = (students) => students.filter((s) => s.status === 'Present' || s.status === 'Late').length;

// ---- dates and times on THIS phone (the server is told these, see api/http.js) ----
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // "2026-10-08"
export const localTime = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;                       // "13:05"
export const fmtDateMDY = (d = new Date()) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;   // "10/08/2026"
export const today = (d = new Date()) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

// only show real image data as a profile picture (never a random URL)
export const safeImg = (u) => (typeof u === 'string' && /^data:image\/(jpeg|png);base64,/.test(u) ? u : null);

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const isTime = (t) => /^\d{2}:\d{2}$/.test(t || '');
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();
export const minToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; // 800 -> "13:20"

// On time (or within LATE_AFTER_MIN minutes of the start) = Present, later = Late
export const statusByTime = (startTime, d = new Date(), grace = LATE_AFTER_MIN) => {
  if (!isTime(startTime)) return 'Present';
  return nowMin(d) <= toMin(startTime) + grace ? 'Present' : 'Late';
};

// ---- today's attendance session (class.session = { startTime, adjusted, lateAfter }) ----
export const startToday = (c) => c?.session?.startTime || c?.startTime;          // the start time that counts today
const grace = (c) => c?.session?.lateAfter ?? LATE_AFTER_MIN;
export const lateAfterTime = (c) => {                                              // "1:35 pm" = scans after this are Late
  const t = startToday(c);
  return isTime(t) ? fmtTime(minToTime(Math.min(toMin(t) + grace(c), 23 * 60 + 59))) : '';
};
// past the late mark of the schedule, "Start attendance" not pressed yet, and the class isn't over
export const runningLate = (c, d = new Date()) =>
  !!c && !c.session?.adjusted && isTime(c.startTime) && isTime(c.endTime) &&
  nowMin(d) > toMin(c.startTime) + grace(c) && nowMin(d) < toMin(c.endTime);
export const classEnded = (c, d = new Date()) => !!c && isTime(c.endTime) && nowMin(d) >= toMin(c.endTime);

// is scanning closed at minute `m` today? closed by the teacher at closedTime, or at the end time unless reopened
export const closedAtMin = (c, closedTime, reopened, m = nowMin()) =>
  (isTime(closedTime) && m >= toMin(closedTime)) || (!reopened && isTime(c.endTime) && m >= toMin(c.endTime));

// ---- days as "YYYY-MM-DD" text (local) ----
export const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return localDate(d); };
// the class's times on one date: that weekday's own times ("non-uniform time"), else the class times
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const timesOn = (c, date) => {
  const t = (c?.times || []).find((x) => x.day === WEEK[parseDay(date).getDay()]);
  return t ? { startTime: t.startTime, endTime: t.endTime } : { startTime: c?.startTime, endTime: c?.endTime };
};
export const fmtDay = (s) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseDay(s).getDay()]}, ${today(parseDay(s))}`; // "Thu, Oct 8, 2026"

// The first MASK_ID_DIGITS digits become ONE #:  "00001111" -> "#1111", "2021-0001" -> "#-0001"
// (MASK_ID_DIGITS in constants.js). A # already in the ID counts as hidden, so "####1111" -> "#1111" too.
export const maskId = (id) => {
  let left = MASK_ID_DIGITS;
  let placed = false;
  return String(id ?? '').replace(/[\d#]/g, (ch) => {
    if (left-- <= 0) return ch;
    if (placed) return '';
    placed = true;
    return '#';
  });
};
