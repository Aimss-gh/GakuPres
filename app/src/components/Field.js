import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Icon from './Icon';
import Txt from './Txt';
import { C, F, FS, MAX_FONT_SCALE } from '../theme';

// Login/Register input: label, leading icon, optional password eye, optional hint line.
// big = taller box and more space below (Login)
// Keyboard flow: inputRef = this box's ref; next = the ref of the box after it ("Next" key jumps there);
// onGo = what the last box's "Go" key does (usually the form's submit).
export default function Field({ label, icon, secure, hint, big, children, inputRef, next, onGo, ...rest }) {
  const [show, setShow] = useState(false);
  return (
    <View style={[S.wrap, big && S.wrapBig]}>
      <Txt style={S.label}>{label}</Txt>
      <View style={[S.box, big && S.boxBig]}>
        {icon && <Icon n={icon} size={15} />}
        {children || (
          <TextInput ref={inputRef} style={S.input} maxFontSizeMultiplier={MAX_FONT_SCALE} placeholderTextColor={C.placeholder} autoCapitalize="none"
            secureTextEntry={secure && !show} accessibilityLabel={label}
            returnKeyType={next ? 'next' : onGo ? 'go' : 'done'} submitBehavior={next ? 'submit' : 'blurAndSubmit'}
            onSubmitEditing={next ? () => next.current?.focus() : onGo} {...rest} />
        )}
        {secure && (
          <Pressable onPress={() => setShow(!show)} hitSlop={10} accessibilityLabel={show ? 'Hide password' : 'Show password'}>
            <Icon n={show ? 'eyeOff' : 'eye'} size={15} />
          </Pressable>
        )}
      </View>
      {!!hint && <Txt style={S.hint}>{hint}</Txt>}
    </View>
  );
}

const S = StyleSheet.create({
  wrap: { marginBottom: 10 },
  label: { fontSize: FS.xs, fontFamily: F.semi, color: C.orange, marginBottom: 3 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: C.line, borderRadius: 8, paddingHorizontal: 10, minHeight: 42, backgroundColor: C.paper },
  wrapBig: { marginBottom: 16 },
  boxBig: { minHeight: 50, borderRadius: 10, paddingHorizontal: 12 },
  input: { flex: 1, fontFamily: F.body, fontSize: FS.md, color: C.ink, paddingVertical: 0 },
  hint: { fontSize: FS.xs, color: C.hint, marginTop: 3 },
});
