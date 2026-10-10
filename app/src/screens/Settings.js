// SETTINGS - same look as the dashboard: orange top bar, cream background, orange banner card,
// bordered cards. Change name, profile picture and bio.
//   texts -> src/content.js (T.settings) | open with navigation.navigate('Settings') (avatar menu in Header.js)
//   Needs: npx expo install expo-image-picker expo-image-manipulator
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import Btn from '../components/Btn';
import Icon from '../components/Icon';
import Txt from '../components/Txt';
import Dialog, { DialogActions } from '../components/Dialog';
import Field from '../components/Field';
import useSubmit from '../hooks/useSubmit';
import { useAuth } from '../context/AuthContext';
import { T } from '../content';
import { C, F, FS, MAX_W, sc } from '../theme';
import { safeImg } from '../utils';
import { PRIVACY_URL } from '../constants';

const BIO_MAX = 150;
const AVATAR_PX = 256; // profile pictures are stored at this size (about 15-30 KB)

export default function Settings() {
  const L = T.settings;
  const insets = useSafeAreaInsets();
  const { user, updateProfile, deleteAccount } = useAuth();
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(safeImg(user?.avatar));
  const [saved, setSaved] = useState(false);
  const { busy, err, setErr, run } = useSubmit();
  const dirty = (fn) => (v) => { fn(v); setSaved(false); };

  const pick = async () => {
    const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!p.granted) return setErr(L.photoPerm);
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (r.canceled || !r.assets?.[0]?.uri) return;
    // Re-draw it as a small 256x256 JPEG: always small enough for the server (a big phone photo
    // was too big before), and whatever file was picked, only plain picture pixels are sent.
    try {
      const img = await ImageManipulator.manipulate(r.assets[0].uri).resize({ width: AVATAR_PX, height: AVATAR_PX }).renderAsync();
      const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!out.base64) throw new Error();
      setErr('');
      setSaved(false);
      setAvatar(`data:image/jpeg;base64,${out.base64}`);
    } catch {
      setErr(L.photoBad);
    }
  };

  const save = () => {
    const n = name.trim();
    if (!n) return setErr(L.errName);
    run(async () => {
      await updateProfile({ name: n, bio: bio.trim().slice(0, BIO_MAX), avatar });
      setSaved(true);
    });
  };

  // delete account: asks for the password; on success AuthContext logs out and the login screen shows
  const confirmDelete = async () => {
    if (!delPw) return setDelErr(L.errPassword);
    setDeleting(true);
    setDelErr('');
    try { await deleteAccount(delPw); }
    catch (e) { setDelErr(e.message); setDeleting(false); }
  };
  const closeDelete = () => { if (!deleting) { setDelOpen(false); setDelPw(''); setDelErr(''); } };

  const av = sc(92);
  return (
    <View style={{ flex: 1 }}>
      <Header title={L.title} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[S.wrap, { paddingBottom: insets.bottom + 30 }]}
        >

          {/* orange banner, like the class page */}
          <View style={S.banner}>
            <Pressable onPress={pick} accessibilityLabel={L.photo}>
              <View style={[S.avatar, { width: av, height: av, borderRadius: av / 2 }]}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={{ width: av, height: av }} />
                ) : (
                  <Icon n="user" size={av / 2} color={C.orange} />
                )}
              </View>
            </Pressable>
            <Txt style={S.bannerName} numberOfLines={1}>{user?.name}</Txt>
            <Txt style={S.bannerSub} numberOfLines={1}>{user?.email}</Txt>
            <Pressable onPress={pick}><Txt style={S.change}>{L.photo}</Txt></Pressable>
          </View>

          {/* bordered card, like a class card */}
          <View style={S.card}>
            <Txt style={S.label}>{L.name}</Txt>
            <TextInput
              style={S.input}
              value={name}
              onChangeText={dirty(setName)}
              placeholder={L.namePh}
              placeholderTextColor={C.placeholder}
              maxLength={80}
              autoCapitalize="words"
              autoComplete="name"
            />
            <Txt style={[S.label, { marginTop: 12 }]}>{L.bio}</Txt>
            <TextInput
              style={[S.input, S.bio]}
              value={bio}
              onChangeText={dirty(setBio)}
              placeholder={L.bioPh}
              placeholderTextColor={C.placeholder}
              maxLength={BIO_MAX}
              multiline
              textAlignVertical="top"
            />
            <Txt style={S.count}>{bio.length}/{BIO_MAX}</Txt>
          </View>

          {!!err && <Txt style={S.err} accessibilityRole="alert">{err}</Txt>}
          {saved && !err && <Txt style={S.ok}>{L.saved}</Txt>}
          <Btn variant="small" title={busy ? L.saving : L.save} onPress={save} disabled={busy} />

          {!!PRIVACY_URL && (
            <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
              <Txt style={S.privacy}>{L.privacy}</Txt>
            </Pressable>
          )}

          <View style={S.danger}>
            <Txt style={S.dangerTitle}>{L.danger}</Txt>
            <Txt style={S.dangerBody}>{L.dangerBody}</Txt>
            <Btn variant="danger" title={L.danger} onPress={() => setDelOpen(true)} style={{ alignSelf: 'flex-start' }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {delOpen && (
        <Dialog title={L.deleteTitle} onClose={closeDelete}>
          <Txt style={{ fontSize: FS.md }}>{L.deleteBody}</Txt>
          <Field label={T.login.password} icon="lock" secure placeholder={L.deletePh} autoComplete="current-password" maxLength={128}
            value={delPw} onChangeText={(v) => { setDelPw(v); setDelErr(''); }} />
          {!!delErr && <Txt style={S.err} accessibilityRole="alert">{delErr}</Txt>}
          <DialogActions>
            <Btn variant="ghostSm" title={T.common.cancel} onPress={closeDelete} disabled={deleting} />
            <Btn variant="danger" title={deleting ? L.deleting : L.deleteBtn} onPress={confirmDelete} disabled={deleting} />
          </DialogActions>
        </Dialog>
      )}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { padding: 16, paddingTop: 18, gap: 14, width: '100%', maxWidth: MAX_W, alignSelf: 'center' },
  banner: { backgroundColor: C.orange, borderRadius: 6, padding: 20, alignItems: 'center', gap: 4 },
  avatar: { backgroundColor: C.cream, borderWidth: 3, borderColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bannerName: { fontFamily: F.bold, fontSize: FS.banner, color: '#fff', marginTop: 8 },
  bannerSub: { fontFamily: F.body, fontSize: FS.base, color: '#ffffffd9' },
  change: { fontFamily: F.body, fontSize: FS.base, color: '#fff', textDecorationLine: 'underline', marginTop: 6 },
  card: { backgroundColor: C.paper, borderWidth: 1.5, borderColor: C.line, borderRadius: 6, padding: 14 },
  label: { fontSize: FS.sm, marginBottom: 4 },
  input: { borderWidth: 1.5, borderColor: C.line, borderRadius: 6, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 8, fontFamily: F.body, fontSize: FS.md, color: C.ink },
  bio: { minHeight: sc(84) },
  count: { fontFamily: F.body, fontSize: FS.xs, color: C.muted, textAlign: 'right', marginTop: 4 },
  err: { color: C.red, fontSize: FS.md },
  ok: { color: C.green, fontSize: FS.md },
  privacy: { fontSize: FS.md, color: C.orange, textDecorationLine: 'underline', marginTop: 12 },
  danger: { marginTop: 24, padding: 14, gap: 8, borderWidth: 1.5, borderColor: C.red, borderRadius: 6, backgroundColor: '#fff5f4' },
  dangerTitle: { fontFamily: F.semi, fontSize: FS.base, color: C.red },
  dangerBody: { fontSize: FS.sm, color: C.muted },
});