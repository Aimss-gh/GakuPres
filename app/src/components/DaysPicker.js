import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import Txt from './Txt';
import { plainBox } from './Plain';
import { DAYS } from '../constants';
import { T } from '../content';
import { fmtDays } from '../utils';
import { C, FS } from '../theme';

// Dropdown with a checkbox per day. Everything is LEFT aligned: checkbox first, then the day name.
export default function DaysPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);

  return (
    <View>
      <Pressable style={[plainBox, S.btn]} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Txt style={[S.val, !value.length && { color: C.placeholder }]}>{value.length ? fmtDays(value) : T.createClass.daysPh}</Txt>
        <Icon n={open ? 'chevUp' : 'chev'} size={15} />
      </Pressable>
      {open && (
        <View style={S.list}>
          {DAYS.map((d) => {
            const on = value.includes(d);
            return (
              <Pressable key={d} style={S.item} onPress={() => toggle(d)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={d}>
                <View style={[S.box, on && S.boxOn]}>{on && <Icon n="check" size={12} color="#fff" />}</View>
                <Txt style={S.label}>{d}</Txt>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  val: { fontSize: FS.md, textAlign: 'left', flex: 1 },
  list: { alignItems: 'stretch', marginTop: 4, padding: 6, backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.orange, borderRadius: 6 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10, paddingVertical: 8, paddingHorizontal: 6 },
  box: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: C.orange },
  label: { fontSize: FS.md, textAlign: 'left', flex: 1 },
});
