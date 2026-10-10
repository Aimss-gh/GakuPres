// Builds the Android app only for real phones (ARM). By default the APK also carries code for x86
// computer emulators, which no phone uses and which makes the download much bigger.
const { withGradleProperties } = require('expo/config-plugins');

const ARCHS = 'armeabi-v7a,arm64-v8a';

module.exports = (config) => withGradleProperties(config, (cfg) => {
  const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'reactNativeArchitectures'));
  props.push({ type: 'property', key: 'reactNativeArchitectures', value: ARCHS });
  cfg.modResults = props;
  return cfg;
});
