import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import Txt from './Txt';
import Popover, { MenuBox, MenuItem, useAnchor } from './Popover';
import { useAuth } from '../context/AuthContext';
import { IMG } from '../assets';
import { T } from '../content';
import { C, F, FS } from '../theme';
import { safeImg } from '../utils';
import { pendingScans } from '../api/offline';

// Orange top bar.
//  - with `title`: big back arrow on the left + title perfectly CENTERED   (Create Class)
//  - without:      logo + avatar menu                                        (Dashboard)
// Logo: IMG.headerLogo (assets.js) or the text from T.brand (content.js).
export default function Header({ title }) {
  const nav = useNavigation();
  const { user, logout } = useAuth();
  const avatar = safeImg(user?.avatar);
  const insets = useSafeAreaInsets();
  const a = useAnchor();
  const pick = (fn) => () => { a.close(); fn(); };
  const M = T.dashboard.menu;
  // scans saved offline belong to this login: warn before logging out with some not uploaded
  const safeLogout = async () => {
    const n = (await pendingScans().catch(() => [])).length;
    if (!n) return logout();
    Alert.alert(T.dashboard.logoutTitle, T.dashboard.logoutBody(n), [
      { text: T.common.cancel, style: 'cancel' },
      { text: M.logout, style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <LinearGradient colors={[C.orange, '#ff7a1f']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[S.bar, { paddingTop: insets.top + 14 }]}>
      {title ? (
        // [back][   title   ][empty]: the two side slots are the same width, so the title sits in the
        // exact middle of the screen on every phone (no floating overlay)
        <View style={S.row}>
          <Pressable onPress={() => nav.goBack()} hitSlop={14} style={S.side} accessibilityLabel="Back"><Icon n="back" size={26} color="#fff" /></Pressable>
          <Txt style={S.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityRole="header">{title}</Txt>
          <View style={S.side} />
        </View>
      ) : (
        <View style={S.row}>
          <View style={S.brand} accessibilityRole="header" accessibilityLabel={T.brand.a + T.brand.b}>
            {IMG.headerLogo && <Image source={IMG.headerLogo} resizeMode="contain" style={S.logoImg} />}
            <Txt style={S.logo} maxFontSizeMultiplier={1.2}>{T.brand.a}<Text style={{ color: '#fff' }}>{T.brand.b}</Text></Txt>
          </View>
          <Pressable ref={a.ref} collapsable={false} onPress={a.open} hitSlop={8} style={S.avatar} accessibilityLabel="Profile menu">
            {avatar ? <Image source={{ uri: avatar }} style={S.avatarImg} /> : <Icon n="user" size={16} color={C.ink} />}
          </Pressable>
          <Popover pos={a.pos} onClose={a.close}>
            <MenuBox style={{ width: 150 }}>
              <MenuItem icon="msg" label={M.feedback} onPress={pick(() => nav.navigate('Feedback'))} />
              <MenuItem icon="sliders" label={M.settings} onPress={pick(() => nav.navigate('Settings'))} />
              <MenuItem icon="out" label={M.logout} onPress={pick(safeLogout)} />
            </MenuBox>
          </Popover>
        </View>
      )}
    </LinearGradient>
  );
}

const S = StyleSheet.create({
  bar: { paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: '#ffffff66' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 30 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { fontFamily: F.pixel, fontSize: FS.logo, color: C.ink, letterSpacing: 1, includeFontPadding: false },
  logoImg: { height: FS.logo + 12, width: FS.logo + 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 32, height: 32 },
  side: { width: 40, justifyContent: 'center' },
  title: { flex: 1, fontFamily: F.medium, fontSize: FS.pageTitle, color: '#fff', textAlign: 'center', includeFontPadding: false },
});