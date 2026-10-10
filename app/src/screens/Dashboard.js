// DASHBOARD (class list)
//   texts  -> src/content.js  (T.dashboard, T.brand)
//   images -> src/assets.js   (IMG.headerLogo, IMG.emptyState)
//   top bar + avatar menu -> src/components/Header.js | card layout -> src/components/ClassCard.js
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import ClassCard from '../components/ClassCard';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import { listClasses, setPinned } from '../api/classApi';
import { flushScans } from '../api/offline';
import { USE_MOCK } from '../api/http';
import { IMG } from '../assets';
import { T } from '../content';
import { C, FS, column, fabRight } from '../theme';

export default function Dashboard({ navigation }) {
  const L = T.dashboard;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [classes, setClasses] = useState(null);
  const [err, setErr] = useState('');

  // reload whenever this screen comes back into view (after scanning, creating, deleting...)
  useFocusEffect(useCallback(() => {
    let live = true;
    const load = () => listClasses().then((c) => { if (live) { setClasses(c); setErr(''); } }).catch((e) => { if (live) { setErr(e.message); setClasses((p) => p || []); } });
    load();
    // send scans saved while offline, then show the new numbers
    if (!USE_MOCK) flushScans().then(({ sent }) => sent && load()).catch(() => {});
    return () => { live = false; };
  }, []));

  // pinned first; the sort is stable so the rest keep their order
  const sorted = useMemo(() => classes && [...classes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)), [classes]);

  const open = useCallback((id) => navigation.navigate('ClassDetail', { id }), [navigation]);
  const pin = useCallback(async (id, pinned) => {
    try {
      const updated = await setPinned(id, pinned);
      setClasses((cs) => cs.map((c) => (c._id === id ? updated : c)));
    } catch (e) { setErr(e.message); }
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Header />
      {!!err && <Txt style={[S.err, column]} accessibilityRole="alert">{err}</Txt>}
      {sorted === null ? (
        <Txt style={S.muted}>{L.loading}</Txt>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c._id}
          renderItem={({ item }) => <ClassCard c={item} onOpen={open} onPin={pin} />}
          contentContainerStyle={[column, { padding: 16, paddingBottom: insets.bottom + 100, flexGrow: 1 }]}
          ListEmptyComponent={!err && (
            <View style={S.empty}>
              {IMG.emptyState ? (
                <Image source={IMG.emptyState} style={S.emptyImg} resizeMode="contain" />
              ) : (
                <View style={S.qrFrame}><Icon n="qr" size={64} color={C.ink} /></View>
              )}
              <Txt style={{ fontSize: FS.sm }}>{L.empty}</Txt>
            </View>
          )}
        />
      )}
      <Pressable style={({ pressed }) => [S.fab, { bottom: insets.bottom + 24, right: fabRight(width) }, pressed && { opacity: 0.85 }]}
        onPress={() => navigation.navigate('CreateClass')} accessibilityRole="button" accessibilityLabel={L.create} hitSlop={6}>
        <Icon n="plus" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const S = StyleSheet.create({
  muted: { textAlign: 'center', padding: 40, color: C.muted },
  err: { color: C.red, fontSize: FS.md, padding: 16, paddingBottom: 0 },
  empty: { alignItems: 'center', marginTop: 70 },
  emptyImg: { width: 160, height: 160, marginBottom: 12 },
  qrFrame: { width: 96, height: 140, borderWidth: 2, borderColor: C.orange, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  fab: { position: 'absolute', width: 48, height: 48, borderRadius: 8, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});
