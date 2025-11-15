const isProd = process.env.NODE_ENV === 'production';

const JSON_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const runtimeCaching = [
  {
    urlPattern: ({ url }) => url.pathname.endsWith('.json'),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'json-data-cache',
      cacheableResponse: { statuses: [0, 200] },
      expiration: {
        maxEntries: 300,
        maxAgeSeconds: JSON_CACHE_MAX_AGE_SECONDS
      }
    }
  },
  {
    urlPattern: /^https?.*/,
    handler: 'NetworkFirst',
    options: { cacheName: 'http-cache' }
  }
];

const baseConfig = {
  reactStrictMode: true,
  // An empty turbopack config silences the warning in Next 16
  turbopack: {},
  i18n: {
    locales: ['en', 'fr', 'es'],
    defaultLocale: 'en'
  },
  async rewrites() {
    return [
      {
        source: '/sitemap.xml',
        destination: '/api/sitemap.xml'
      }
    ]
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
    runtimeCaching
  });
  module.exports = withPWA(baseConfig);
}