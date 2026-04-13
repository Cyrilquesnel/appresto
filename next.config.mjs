// @ts-check
import withPWA from '@ducanh2912/next-pwa'

const nextConfig = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    exclude: [/sw-custom\.js/],
  },
})({
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
})

export default nextConfig
