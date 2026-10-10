import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Icon from './Icon';
import Txt from './Txt';
import Dialog, { DialogActions } from './Dialog';
import Btn from './Btn';
import { plainBox } from './Plain';
import { T } from '../content';
import { fmtTime, from24, to24 } from '../utils';
import { C, F, FS } from '../theme';

const ITEM = 40;
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// Scrolling list of numbers that LOOPS (... 11 12 1 2 ... / ... 58 59 00 01 ...); tap one to pick it.
// How: the numbers are drawn several times in a row and the list starts in the middle copy. When scrolling
// stops, it quietly jumps back to the same spot in the middle copy (looks identical), so you never reach an end.
// Columns are NARROW so the time reads "8:05 pm" with no big gaps.
const LOOP_PX = 4000; // at least this much list above and below the middle copy, so even a hard fling can't hit an end
function Wheel({ data, selected, onSelect, pad }) {
  const ref = useRef(null);
  const copyH = data.length * ITEM;
  const copies = Math.max(5, 2 * Math.ceil(LOOP_PX / copyH) + 1); // odd: same number of copies on both sides
  const midTop = Math.floor(copies / 2) * copyH;
  const momentum = useRef(false);
  const y = useRef(0);

  const jump = () => ref.current?.scrollTo({ y: midTop + (data.indexOf(selected) - 2) * ITEM, animated: false });
  // back into the middle copy, same numbers on screen
  const recenter = () => {
    const to = midTop + ((((y.current - midTop) % copyH) + copyH) % copyH);
    if (Math.abs(to - y.current) > 1) ref.current?.scrollTo({ y: to, animated: false });
  };

  return (
    <ScrollView ref={ref} onLayout={jump} style={S.wheel} showsVerticalScrollIndicator={false} nestedScrollEnabled
      scrollEventThrottle={32}
      onScroll={(e) => { y.current = e.nativeEvent.contentOffset.y; }}
      onMomentumScrollBegin={() => { momentum.current = true; }}
      onMomentumScrollEnd={() => { momentum.current = false; recenter(); }}
      // finger lifted without a fling: no momentum event follows, so recenter here (after a moment, in case one does)
      onScrollEndDrag={() => setTimeout(() => { if (!momentum.current) recenter(); }, 120)}>
      {Array.from({ length: copies }, (_, c) => (
        // screen readers only see the middle copy
        <View key={c} importantForAccessibility={c === Math.floor(copies / 2) ? 'auto' : 'no-hide-descendants'}
          accessibilityElementsHidden={c !== Math.floor(copies / 2)}>
          {data.map((v) => (
            <Pressable key={v} onPress={() => onSelect(v)} style={[S.item, v === selected && S.itemOn]}>
              <Txt style={[S.num, v === selected && S.numOn]}>{pad ? String(v).padStart(2, '0') : v}</Txt>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// Tap the box -> popup with hour / minute / am-pm. Saved as "13:00".
// suggest = where the popup starts when nothing is picked yet (End time: one hour after the start)
export default function TimeField({ value, onChange, title, suggest }) {
  const L = T.createClass;
  const [open, setOpen] = useState(false);
  const [h, setH] = useState(8), [m, setM] = useState(0), [pm, setPm] = useState(false);

  useEffect(() => { if (open) { const t = from24(value || suggest); setH(t.h); setM(t.m); setPm(t.pm); } }, [open]);

  return (
    <>
      <Pressable style={[plainBox, S.box]} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={title}>
        <Txt style={[S.val, !value && { color: C.placeholder }]}>{value ? fmtTime(value) : L.timePh}</Txt>
        <Icon n="clock" size={14} />
      </Pressable>
      {open && (
        <Dialog title={title} onClose={() => setOpen(false)}>
          <Txt style={S.preview}>{fmtTime(to24(h, m, pm))}</Txt>
          <View style={S.cols}>
            <Wheel data={HOURS} selected={h} onSelect={setH} />
            <Txt style={S.colon}>:</Txt>
            <Wheel data={MINUTES} selected={m} onSelect={setM} pad />
            <View style={S.ampm}>
              {[false, true].map((isPm) => (
                <Pressable key={String(isPm)} onPress={() => setPm(isPm)} style={[S.apBtn, pm === isPm && S.itemOn]}>
                  <Txt style={[S.apText, pm === isPm && S.numOn]}>{isPm ? 'pm' : 'am'}</Txt>
                </Pressable>
              ))}
            </View>
          </View>
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={() => setOpen(false)} />
            <Btn variant="solid" title={L.setTime} onPress={() => { onChange(to24(h, m, pm)); setOpen(false); }} />
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

const S = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  val: { fontSize: FS.md, textAlign: 'left', flex: 1 },
  preview: { fontFamily: F.semi, fontSize: FS.pageTitle, textAlign: 'center' },
  cols: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  wheel: { height: ITEM * 5, width: 52 },
  colon: { fontFamily: F.semi, fontSize: FS.banner, width: 8, textAlign: 'center' },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  itemOn: { backgroundColor: '#ffe3d1' },
  num: { fontSize: FS.banner, color: C.muted },
  numOn: { color: C.orange, fontFamily: F.bold },
  ampm: { marginLeft: 14, gap: 8 },
  apBtn: { width: 54, height: ITEM, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5, borderColor: C.line },
  apText: { fontSize: FS.base, color: C.muted },
});
