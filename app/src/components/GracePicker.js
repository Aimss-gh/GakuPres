import { Pressable, StyleSheet, View } from 'react-native';
import Txt from './Txt';
import { GRACE_CHOICES } from '../constants';
import { C, F, FS } from '../theme';

// Row of "0 5 10 15 20 30" minute chips: how long after the start a scan still counts as Present.
export default function GracePicker({ value, onChange }) {
  return (
    <View style={S.row} accessibilityRole="radiogroup">
      {GRACE_CHOICES.map((n) => {
        const on = n === value;
        return (
          <Pressable key={n} onPress={() => onChange(n)} style={[S.chip, on && S.on]} hitSlop={4}
            accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${n} minutes`}>
            <Txt style={[S.text, on && S.textOn]}>{n}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 44, minHeight: 36, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1.5, borderColor: C.line, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: C.orange, borderColor: C.orange },
  text: { fontSize: FS.md },
  textOn: { color: '#fff', fontFamily: F.semi },
});
