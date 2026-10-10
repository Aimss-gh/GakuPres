import { StyleSheet, TextInput, View } from 'react-native';
import Txt from './Txt';
import { C, F, FS, MAX_FONT_SCALE } from '../theme';

// label on top + bordered input (Create Class, Add Student). Pass children to put something else in the box.
export default function Plain({ label, children, ...rest }) {
  return (
    <View style={S.wrap}>
      <Txt style={S.label}>{label}</Txt>
      {children || <TextInput style={S.input} maxFontSizeMultiplier={MAX_FONT_SCALE} placeholderTextColor={C.placeholder} {...rest} />}
    </View>
  );
}

export const plainBox = { borderWidth: 1.5, borderColor: C.line, borderRadius: 5, backgroundColor: C.paper, paddingHorizontal: 8, minHeight: 40, justifyContent: 'center' };

const S = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: FS.sm },
  input: { ...plainBox, fontFamily: F.body, fontSize: FS.md, color: C.ink, paddingVertical: 6 },
});
