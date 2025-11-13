const isProd = process.env.NODE_ENV === 'production';

const baseConfig = {
  reactStrictMode: true,
  // An empty turbopack config silences the warning in Next 16
  turbopack: {},
  i18n: {
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en'
  }
};

if (!isProd) {
  // Dev: no next-pwa -> no webpack config -> Turbopack runs
  module.exports = baseConfig;
} else {
  // Prod: enable PWA (webpack build is fine)
  const withPWA = require('next-pwa')({
    dest: 'public',
    disable: false,
    runtimeCaching: [
      {
        urlPattern: /^https?.*/,
        handler: 'NetworkFirst',
        options: { cacheName: 'http-cache' }
      }
    ]
  });
  module.exports = withPWA(baseConfig);
}