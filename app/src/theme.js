// FONTS, TEXT SIZES and COLORS. Change a value here and the whole app follows.
import { Dimensions } from 'react-native';

export const C = {
  orange: '#ff6417', orange2: '#ff8a2b', cream: '#fff8ec', paper: '#fffdf7', ink: '#2a1a10',
  line: '#ff9b66', red: '#e5312d', green: '#22c55e', muted: '#8a6a55', hint: '#b4470c',
  amber: '#d97706', grey: '#6b7280', placeholder: '#b9a090',
};

// Font NAMES. They must match what App.js loads (useFonts). React Native has no fontWeight for
// custom fonts, so "bolder" = pick a different name below.
export const F = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  xbold: 'Inter_800ExtraBold',
  script: 'CaveatBrush_400Regular', // "Welcome" / "Register"
  pixel: 'PixelifySans_700Bold',    // GAKUPRES on the top bar and the Login card
};

// Screen-size scaling: phones (~390 wide) use the numbers as written, bigger screens (tablets)
// get up to 25% more. Never smaller, so text stays readable on small phones.
const { width: W, height: H } = Dimensions.get('window');
const GROW = Math.min(Math.max(Math.min(W, H) / 390, 1), 1.25);
export const sc = (n) => Math.round(n * GROW);

// Text sizes in px (written for a normal phone; scaled with sc above)
const BASE_FS = {
  xs: 10, sm: 11, md: 12, lg: 13, base: 14,
  logo: 20, brand: 20, banner: 22, pageTitle: 26, scanTitle: 22, script: 34,
};
export const FS = Object.fromEntries(Object.entries(BASE_FS).map(([k, v]) => [k, sc(v)]));

// Biggest the phone's "large text" accessibility setting may make our text (keeps layouts intact)
export const MAX_FONT_SCALE = 1.35;

export const statusColor = { Present: C.ink, Late: C.amber, Excuse: C.grey, Absent: C.red };
// stronger colors for the scanner's result card
export const statusTint = { Present: C.green, Late: C.amber, Excuse: C.grey, Absent: C.red };

// Layout helpers.
export const MAX_W = 560;                                          // max content width on wide screens
// style for a centered column that never grows wider than MAX_W
export const column = { width: '100%', maxWidth: MAX_W, alignSelf: 'center' };
// distance from the right edge for floating buttons, so they stay next to the centered column
export const fabRight = (screenW) => Math.max(18, (screenW - MAX_W) / 2 + 18);
