// FAKE database saved on the phone so the app works with no backend. Delete when the server is real.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gp_mock_db';
export const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
export const load = async () => JSON.parse((await AsyncStorage.getItem(KEY)) || '{"users":[],"classes":[]}');
export const save = (db) => AsyncStorage.setItem(KEY, JSON.stringify(db));
export const uid = () => Math.random().toString(36).slice(2, 10);

// [name, ID number printed in the student's ID QR, department, course]
export const SAMPLE_STUDENTS = [
  ['Juan Dela Cruz', '00001111', 'CCS', 'BSIT'],
  ['Maria Santos', '00001112', 'CCS', 'BSIT'],
  ['Carlo Reyes', '00001113', 'CCS', 'BSCS'],
  ['Angela Lim', '00001114', 'CCS', 'BSIT'],
  ['Miguel Tan', '00001115', 'CCS', 'BSIS'],
];
