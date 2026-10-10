import { Text } from 'react-native';
import { C, F, FS, MAX_FONT_SCALE } from '../theme';

// ALL text goes through this, so the default font / size / color is set in one place (theme.js)
export default function Txt({ style, ...p }) {
  return <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...p} style={[{ fontFamily: F.body, fontSize: FS.base, color: C.ink }, style]} />;
}
