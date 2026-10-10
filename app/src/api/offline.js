// OFFLINE SCANS (real server only). When the server can't be reached, a scan is saved on the phone
// with the time it really happened, and sent later: the server then marks Present / Late by THAT time.
// Sent automatically when the scanner or a class page is open and the server answers again.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { http } from './http';
import { localDate, localTime } from '../utils';

const KEY = 'gp_offline_scans';
const read = async () => {
  try { return JSON.parse(await AsyncStorage.getItem(KEY)) || []; } catch { return []; }
};
const write = (list) => AsyncStorage.setItem(KEY, JSON.stringify(list));

// screens can listen for changes (to show "3 scans waiting")
const listeners = new Set();
export const onQueueChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const notify = async () => { const list = await read(); listeners.forEach((fn) => fn(list)); };

// forget everything saved offline (account deleted)
export const clearScans = async () => { await write([]); notify(); };

export const pendingScans = async (classId) => (await read()).filter((x) => !classId || x.classId === classId);

// s = { studentId, name, dept, course } from the QR. The same student, class and day is saved only once.
export async function queueScan(classId, s, add) {
  const now = new Date();
  const at = { date: localDate(now), time: localTime(now) };
  const list = await read();
  if (!list.some((x) => x.classId === classId && x.s.studentId === s.studentId && x.at.date === at.date)) {
    list.push({ id: `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`, classId, s, add: !!add, at });
    await write(list);
  }
  notify();
}

// Sends everything waiting. Stops at the first "still offline". Scans the server refuses
// (attendance closed, too old, student removed...) are dropped - retrying would never work.
// -> { sent, dropped: [{ item, message }] }
let running = null;
export function flushScans() {
  if (running) return running;
  running = (async () => {
    let list = await read();
    let sent = 0;
    const dropped = [];
    for (const item of [...list]) {
      try {
        await http(`/classes/${encodeURIComponent(item.classId)}/scan`, { method: 'POST', body: { ...item.s, add: item.add }, at: item.at });
        sent++;
      } catch (e) {
        if (e.status === 0 || e.status >= 500 || e.status === 401 || e.status === 429) break; // try again later
        dropped.push({ item, message: e.message });
      }
      list = list.filter((x) => x.id !== item.id);
      await write(list);
    }
    if (sent || dropped.length) notify();
    return { sent, dropped };
  })().finally(() => { running = null; });
  return running;
}
