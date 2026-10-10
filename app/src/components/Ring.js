import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Txt from './Txt';
import { C, F, sc } from '../theme';

// little progress circle with "3/5" in the middle.
// The number is a normal Text laid over the circle (centered by layout, not by guessing an SVG
// baseline), and it shrinks to fit when the numbers get long ("28/30").
export default function Ring({ done, total, size = sc(44) }) {
  const stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = total ? Math.min(done / total, 1) : 0;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${done} of ${total} present`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#FFD9C2" strokeWidth={stroke} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.orange} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, S.center, { padding: stroke + 3 }]} pointerEvents="none">
        <Txt style={[S.num, { fontSize: Math.round(size * 0.23), lineHeight: Math.round(size * 0.3) }]}
          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1}>
          {done}/{total}
        </Txt>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: F.semi, color: C.ink, textAlign: 'center', includeFontPadding: false, textAlignVertical: 'center' },
});
