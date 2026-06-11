module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: [],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@sentry/.*|@shopify/react-native-skia|react-native-reanimated|react-native-gesture-handler))',
  ],
  testMatch: ['**/?(*.)+(test).ts?(x)'],
};
