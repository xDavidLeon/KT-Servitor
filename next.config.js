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
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
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
    runtimeCaching,
    workboxOptions: {
      // Don't auto-skip waiting - let user control when to update
      skipWaiting: false,
      clientsClaim: false,
      // Note: The service worker needs to listen for SKIP_WAITING messages
      // This is handled by the useServiceWorkerUpdate hook which sends the message
      // and the service worker should call skipWaiting() when it receives it
    }
  });
  module.exports = withPWA(baseConfig);
}