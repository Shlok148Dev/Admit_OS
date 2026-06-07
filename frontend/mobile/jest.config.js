module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@exponent/.*|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ],

  moduleNameMapper: {
    "^react-native-css-interop/jsx-runtime$": "react/jsx-runtime",
    "^react-native-css-interop/jsx-dev-runtime$": "react/jsx-dev-runtime",
    // Mock CSS imports for Tailwind
    "\\.css$": "identity-obj-proxy"
  }
};
