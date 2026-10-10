import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Txt from './Txt';
import { C, F, FS } from '../theme';

// variants: pill (big, gradient) | small (gradient, square) | ghost (outlined) | ghostSm | solid | danger
const V = {
  pill: { wrap: { alignSelf: 'center', width: '60%', minWidth: 180, maxWidth: 320 }, box: { borderRadius: 999, paddingVertical: 10 }, text: { color: '#fff', fontSize: FS.lg }, grad: true },
  small: { wrap: { alignSelf: 'center', minWidth: 130 }, box: { borderRadius: 4, paddingVertical: 8, paddingHorizontal: 16 }, text: { color: '#fff', fontSize: FS.md }, grad: true },
  ghost: { wrap: { alignSelf: 'center', width: '70%', minWidth: 200, maxWidth: 360 }, box: { borderWidth: 1.5, borderColor: C.orange, borderRadius: 6, paddingVertical: 9, backgroundColor: C.paper }, text: { fontSize: FS.lg } },
  ghostSm: { wrap: {}, box: { borderWidth: 1.5, borderColor: C.orange, borderRadius: 6, paddingVertical: 7, paddingHorizontal: 14 }, text: { fontSize: FS.md } },
  solid: { wrap: {}, box: { backgroundColor: C.orange, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 }, text: { color: '#fff', fontSize: FS.md } },
  danger: { wrap: {}, box: { backgroundColor: C.red, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16 }, text: { color: '#fff', fontSize: FS.md } },
};

export default function Btn({ title, onPress, variant = 'pill', disabled, icon, style }) {
  const v = V[variant];
  const inner = (
    <View style={S.row}>
      <Txt style={[{ fontFamily: F.medium }, v.text]}>{title}</Txt>
      {icon}
    </View>
  );
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: !!disabled }} hitSlop={4}
      style={({ pressed }) => [{ opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }, v.wrap, style]}>
      {v.grad ? (
        <LinearGradient colors={[C.orange2, C.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={v.box}>{inner}</LinearGradient>
      ) : (
        <View style={v.box}>{inner}</View>
      )}
    </Pressable>
  );
}

const S = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 } });
