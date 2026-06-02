const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

// @supabase/supabase-js 2.x 가 사용하는 import(/* webpackIgnore: true */ ...) 구문을
// Hermes가 파싱하지 못하는 문제 해결.
// Metro 기본값은 node_modules를 Babel로 변환하지 않으므로, @supabase를 예외 목록에 추가해
// babel-preset-expo가 dynamic import → require() 로 변환하게 한다.
config.transformIgnorePatterns = [
  'node_modules/(?!(' +
    'react-native|@react-native|@react-native-community|' +
    'expo|@expo|@unimodules|unimodules|' +
    'react-navigation|@react-navigation|' +
    'sentry-expo|native-base|@sentry|' +
    'react-native-reanimated|react-native-safe-area-context|' +
    'react-native-gesture-handler|react-native-screens|' +
    '@supabase' +
  ')/)',
];

module.exports = config;
