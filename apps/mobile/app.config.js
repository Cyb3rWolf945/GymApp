/* global module, process */
// Wraps app.json. The Google Sign-In config plugin throws without the iOS URL scheme, so it is only added when the
// scheme is set (owner step, see #89). Without it the app still builds; native Google sign-in is then simply off.
module.exports = ({ config }) => {
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]] : [])],
  };
};
