// VERIFY EMAIL - shown after sign-up (and at login) until the 6-digit code from the email is entered.
// App.js shows ONLY this screen while user.verified === false; the server keeps classes locked until then.
//   texts -> src/content.js (T.verify) | card -> components/AuthShell.js
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import AuthShell from '../components/AuthShell';
import Field from '../components/Field';
import Btn from '../components/Btn';
import Txt from '../components/Txt';
import useSubmit from '../hooks/useSubmit';
import { useAuth } from '../context/AuthContext';
import { T } from '../content';
import { C, F, FS } from '../theme';

const WAIT_S = 15; // same as the server (RESEND_SECONDS in backend routes/auth.js): 15 seconds between codes

export default function VerifyEmail() {
  const L = T.verify;
  const { user, codeSentAt, verifyEmail, resendCode, changeEmail, logout } = useAuth();
  const [code, setCode] = useState('');
  const [info, setInfo] = useState('');
  const [editing, setEditing] = useState(false); // "Wrong email?" box open
  const [email, setEmail] = useState(user?.email || '');
  const [now, setNow] = useState(Date.now());
  const { busy, err, setErr, run } = useSubmit();

  // countdown for "Send a new code"
  const left = Math.max(0, Math.ceil((codeSentAt + WAIT_S * 1000 - now) / 1000));
  useEffect(() => {
    if (!left) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  const verify = () => {
    const c = code.trim();
    if (!/^\d{6}$/.test(c)) return setErr(L.errCode);
    setInfo('');
    run(() => verifyEmail(c)); // success -> App.js shows the dashboard
  };
  const resend = () => run(async () => { setInfo(await resendCode()); setCode(''); setNow(Date.now()); });
  const saveEmail = () => {
    const e = email.trim().toLowerCase();
    if (!e) return setErr(L.errEmail);
    run(async () => { setInfo(await changeEmail(e)); setEditing(false); setCode(''); setNow(Date.now()); });
  };

  return (
    <AuthShell center cardStyle={S.card}>
      <Txt style={S.title}>{L.title}</Txt>
      <Txt style={S.sub}>{L.sentTo}<Text style={S.email}>{user?.email}</Text>{L.sentTo2}</Txt>

      {editing ? (
        <>
          <Field big label={L.newEmail} icon="mail" placeholder={T.login.emailPh} keyboardType="email-address" autoComplete="email"
            maxLength={254} value={email} onChangeText={(v) => { setEmail(v); setErr(''); }} onGo={saveEmail} />
          {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
          <Btn title={busy ? L.sending : left ? L.waitBtn(left) : L.sendHere} onPress={saveEmail} disabled={busy || left > 0} style={S.btn} />
          <Txt style={S.alt}><Text style={S.link} onPress={() => { setEditing(false); setErr(''); }}>{T.common.cancel}</Text></Txt>
        </>
      ) : (
        <>
          <Field big label={L.code} icon="lock" placeholder="123456" keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode"
            maxLength={6} value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '')); setErr(''); }} onGo={verify} />
          {!!info && !err && <Txt style={S.info}>{info}</Txt>}
          {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
          <Btn title={busy ? L.checking : L.verify} onPress={verify} disabled={busy} style={S.btn} />
          <Txt style={S.alt}>
            {left
              ? <Text style={{ color: C.muted }}>{L.resendIn(left)}</Text>
              : <Text style={S.link} onPress={busy ? undefined : resend} accessibilityRole="button">{L.resend}</Text>}
          </Txt>
          <Txt style={S.alt}>{L.wrong}<Text style={S.link} onPress={() => { setEditing(true); setErr(''); setInfo(''); }} accessibilityRole="button">{L.change}</Text></Txt>
        </>
      )}
      <Txt style={S.alt}><Text style={S.link} onPress={logout} accessibilityRole="button">{L.logout}</Text></Txt>
    </AuthShell>
  );
}

const S = StyleSheet.create({
  card: { paddingHorizontal: 24, paddingVertical: 34 }, // same as Login / Register
  title: { fontFamily: F.script, fontSize: FS.script, color: C.orange, textAlign: 'center' },
  sub: { fontSize: FS.sm, color: C.muted, textAlign: 'center', marginTop: 4, marginBottom: 24 },
  email: { fontFamily: F.semi, color: C.ink },
  info: { color: C.green, fontSize: FS.md, marginBottom: 8 },
  err: { color: C.red, fontSize: FS.md, marginBottom: 8 },
  btn: { marginTop: 4 },
  alt: { fontSize: FS.sm, textAlign: 'center', marginTop: 18 },
  link: { color: C.orange },
});
