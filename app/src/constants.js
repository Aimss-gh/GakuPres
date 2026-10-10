// Switches and data values.
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']; // sent to the server as-is
export const STATUSES = ['Present', 'Late', 'Excuse', 'Absent'];                                   // sent to the server as-is
export const MIN_PASSWORD = 8;

// Web address of the privacy policy (PRIVACY.md, published e.g. on the school site or GitHub Pages).
// The app stores require it. Empty = the "Privacy policy" links are hidden.
export const PRIVACY_URL = '';

// Late grace choices (minutes after the start time a scan still counts as Present), in Create Class + class page
export const GRACE_CHOICES = [0, 5, 10, 15, 20, 30];

// QR scanner
export const SCAN_COOLDOWN_MS = 3000; // ignore the same QR again for this long (the ID is still in front of the camera)

// Minutes after the class start time a scan still counts as Present (later = Late).
// Fake-data mode uses this number; the real server uses LATE_AFTER_MINUTES in its .env (default 15).
export const LATE_AFTER_MIN = 15;

// How many of the FIRST digits of a student ID are replaced by a single # on screen (00001111 -> #1111).
// Only the display changes: the full ID is still saved and matched. 0 = show IDs as they are.
export const MASK_ID_DIGITS = 4;
