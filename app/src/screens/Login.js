// LOGIN SCREEN
//   texts  -> src/content.js  (T.login, T.brand, T.footer)
//   images -> src/assets.js   (IMG.loginLogo, IMG.authBackground)
//   fonts/sizes -> src/theme.js (script = "Welcome", brand = logo text)
import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import Btn from '../components/Btn';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { useAuth } from '../context/AuthContext';
import { MIN_PASSWORD } from '../constants';
import { IMG } from '../assets';
import { T } from '../content';
import { C, F, FS } from '../theme';

export default function Login({ navigation }) {
  const L = T.login;
  const { login } = useAuth();
  const [f, setF] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(false);
  const { busy, err, setErr, run } = useSubmit();
  const pwRef = useRef(null);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  const submit = () => {
    const email = f.email.trim().toLowerCase();
    if (!email || !f.password) return setErr(L.errEmpty);
    if (f.password.length < MIN_PASSWORD) return setErr(L.errShort(MIN_PASSWORD));
    run(() => login({ email, password: f.password, remember })); // success -> App.js swaps in the app screens
  };

  return (
    <AuthShell center cardStyle={S.card}>
      <View style={S.brand}>
        <Image source={IMG.loginLogo} style={S.logo} resizeMode="contain" />
        <Txt style={S.brandText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.1}>{T.brand.a}<Text style={{ color: C.orange }}>{T.brand.b}</Text></Txt>
      </View>
      <Txt style={S.title}>{L.title}</Txt>
      <Txt style={S.sub}>{L.subtitle}</Txt>

      <Field big label={L.email} icon="mail" placeholder={L.emailPh} keyboardType="email-address" autoComplete="email" maxLength={254} value={f.email} onChangeText={set('email')} next={pwRef} />
      <Field big label={L.password} icon="lock" secure placeholder={L.passwordPh} autoComplete="current-password" maxLength={128} inputRef={pwRef} onGo={submit}
        hint={L.hint(MIN_PASSWORD)} value={f.password} onChangeText={set('password')} />
      <Txt style={S.forgot} onPress={() => navigation.navigate('ForgotPassword', { email: f.email.trim() })} accessibilityRole="link">{L.forgot}</Txt>

      <Pressable style={S.check} onPress={() => setRemember(!remember)} accessibilityRole="checkbox" accessibilityState={{ checked: remember }} accessibilityLabel={L.remember}>
        <View style={[S.box, remember && { backgroundColor: C.orange }]}>{remember && <Icon n="check" size={11} color="#fff" />}</View>
        <Txt style={{ fontSize: FS.sm }}>{L.remember}</Txt>
      </Pressable>

      {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
      <Btn title={busy ? L.busy : L.button} onPress={submit} disabled={busy} style={S.btn} />


      <Txt style={S.alt}>{L.noAccount}<Text style={{ color: C.orange }} onPress={() => navigation.navigate('Register')}>{L.signUp}</Text></Txt>
    </AuthShell>
  );
}

const S = StyleSheet.create({
  card: { paddingHorizontal: 24, paddingVertical: 34 }, // taller than Register's card
  brand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 10 },
  // the GAKUPRES logo (Pixelify Sans, like the top bar) is a little bigger than "Welcome": same font size, but
  // Pixelify letters are taller than Caveat Brush ones, so it reads larger. The cap picture is 1.5x the text size.
  logo: { width: Math.round(FS.script * 1.5), height: Math.round(FS.script * 1.5) },
  brandText: { fontFamily: F.pixel, fontSize: FS.script, flexShrink: 1, includeFontPadding: false },
  title: { fontFamily: F.script, fontSize: FS.script, color: C.orange, textAlign: 'center' },
  sub: { fontSize: FS.sm, color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  forgot: { fontSize: FS.sm, color: C.orange, textAlign: 'right', marginTop: -4, marginBottom: 10, paddingVertical: 4 },
  box: { width: 15, height: 15, borderWidth: 1.5, borderColor: C.orange, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  err: { color: C.red, fontSize: FS.md, marginBottom: 8 },
  alt: { fontSize: FS.sm, textAlign: 'center', marginTop: 22 },
  btn: { marginTop: 4 },
});
