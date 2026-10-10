// The ONLY place that talks to the network. Every other api file goes through this.
//
//   real mode : http() -> adapter.handle() -> raw fetch to the Express backend
//   mock mode : authApi.js / classApi.js never call http(), they use mockDb.js directly
import { getToken } from './session';
import { handle as adapterHandle } from './adapter';
import { localDate, localTime } from '../utils';

// Fake-data mode: works only while developing (__DEV__). A real app build is ALWAYS in real mode.
export const USE_MOCK = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
const BASE = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const TIMEOUT_MS = 15000;
// A real build must point at the hosted server (eas.json -> EXPO_PUBLIC_API_URL, https).
const BAD_BUILD_URL = !__DEV__ && (/CHANGE-ME/.test(BASE) || !BASE.startsWith('https://'));

// AuthContext registers a function here that logs the user out when the server answers 401
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

const fail = (message, status, code) => Object.assign(new Error(message), { status, code });

// One HTTP call. Returns parsed JSON, or throws an Error with .status and .code
// (the backend sends codes like NOT_IN_CLASS so the app can react to them).
async function raw(path, { method = 'GET', body } = {}) {
  if (BAD_BUILD_URL) throw fail('This app build has no valid server address (needs https). Set EXPO_PUBLIC_API_URL in eas.json and build again.', 0);
  const token = await getToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    const now = new Date();
    res = await fetch(BASE + path, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        // the phone's own day and clock: the server uses them for "today" and Present/Late
        'X-Local-Date': localDate(now),
        'X-Local-Time': localTime(now),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw fail('The server took too long to answer', 0);
    throw fail('Cannot reach the server. Same wifi? Right IP in .env?', 0);
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) onUnauthorized();
  if (!res.ok) throw fail(data.message || 'Something went wrong', res.status, data.code);
  return data;
}

export const http = (path, opts = {}) => adapterHandle(path, opts, raw);
